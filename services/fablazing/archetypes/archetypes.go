// Package archetypes groups real Viserai decklists into archetypes by the cards
// they share, and tallies each archetype's results and the cards that go with
// winning inside it. A spike to help find a deck: the archetypes are clusters,
// not named by a player, and every figure is an association, not a cause.
//
// Clustering is k-means on card inclusion (a list runs a card or doesn't),
// over the cards in at least MinShare of the kept lists, seeded with
// k-means++ and restarted a few times, keeping the tightest. It's
// deterministic for a given Seed.
package archetypes

import (
	"math"
	"math/rand/v2"
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Options for one computation.
type Options struct {
	MinTurns   int
	Concession game.ConcessionRule
	PlayerCap  int     // per day and format; 0 for no cap
	K          int     // archetypes to look for (empty ones are dropped)
	MinShare   float64 // fewest lists, as a share, a card needs to count for clustering
	MinSample  int     // fewest sides with, and without, a card for its lift
	Seed       uint64
}

// restarts is how many k-means runs are tried; the tightest is kept.
const restarts = 10

// iterations caps one k-means run.
const iterations = 100

// Counts says which Viserai sides were kept, and why the rest weren't.
type Counts struct{ Games, ViseraiSides, Abandoned, WithoutDetail, Short, Capped, Kept int }

// Tally is how many kept sides had something, and how many of them won.
type Tally struct{ Sides, Wins int }

// Lift is one card's results inside an archetype: the sides running it and
// the sides that don't.
type Lift struct {
	Card          string
	With, Without Tally
}

// Archetype is one cluster of lists. Inclusion is the share of its lists
// running each card. Lift is the cards with MinSample sides both with and
// without them, the biggest win-rate gain first.
type Archetype struct {
	Sides, Wins int
	Players     int     // distinct players behind its sides
	MeanCards   float64 // copies per list, which can include the sideboard
	ByFormat    map[int]Tally
	ByFirst     map[string]Tally // "first" or "second"
	Inclusion   map[string]float64
	Lift        []Lift
}

// Result is the archetypes, largest first. Inclusion is over every kept list.
// Spread is the clustering's mean squared distance from a list to its
// archetype's centre: lower is tighter, for comparing values of K.
type Result struct {
	Counts     Counts
	Archetypes []Archetype
	Inclusion  map[string]float64
	Spread     float64
}

// Core is the cards in at least share of the archetype's lists, by name.
func (a Archetype) Core(share float64) []string {
	var out []string
	for c, v := range a.Inclusion {
		if v >= share {
			out = append(out, c)
		}
	}
	sort.Strings(out)
	return out
}

// Distinctive is up to n cards the archetype runs more than lists overall,
// the biggest difference first.
func (a Archetype) Distinctive(overall map[string]float64, n int) []string {
	var out []string
	for c, v := range a.Inclusion {
		if v > overall[c] {
			out = append(out, c)
		}
	}
	diff := func(c string) float64 { return a.Inclusion[c] - overall[c] }
	sort.Slice(out, func(i, j int) bool {
		if di, dj := diff(out[i]), diff(out[j]); di != dj {
			return di > dj
		}
		return out[i] < out[j]
	})
	if len(out) > n {
		out = out[:n]
	}
	return out
}

type capKey struct {
	player game.PlayerHash
	day    string
	format int
}

// kept is the kept Viserai sides: detailed, at least MinTurns long, not
// abandoned, and within each player's earliest PlayerCap sides per day and
// format.
func kept(games []game.Game, o Options) ([]game.Side, []int, Counts) {
	ordered := append([]game.Game(nil), games...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].CreatedAt != ordered[j].CreatedAt {
			return ordered[i].CreatedAt < ordered[j].CreatedAt
		}
		return ordered[i].GUID < ordered[j].GUID
	})
	var sides []game.Side
	var formats []int
	var c Counts
	perPlayer := map[capKey]int{}
	for _, g := range ordered {
		c.Games++
		abandoned := g.Abandoned(o.Concession)
		for _, s := range g.Sides {
			capped := false
			if s.Player != "" && o.PlayerCap > 0 {
				k := capKey{s.Player, day(g.CreatedAt), g.Format}
				perPlayer[k]++
				capped = perPlayer[k] > o.PlayerCap
			}
			if !game.IsViserai(s.Hero) {
				continue
			}
			c.ViseraiSides++
			switch {
			case abandoned:
				c.Abandoned++
			case !s.Detailed:
				c.WithoutDetail++
			case s.Turns < o.MinTurns:
				c.Short++
			case capped:
				c.Capped++
			default:
				c.Kept++
				sides = append(sides, s)
				formats = append(formats, g.Format)
			}
		}
	}
	return sides, formats, c
}

// Compute clusters the kept Viserai sides' lists into archetypes.
func Compute(games []game.Game, o Options) Result {
	sides, formats, counts := kept(games, o)
	r := Result{Counts: counts, Inclusion: map[string]float64{}}
	if len(sides) == 0 {
		return r
	}
	lists := make([]map[string]bool, len(sides))
	for i, s := range sides {
		lists[i] = map[string]bool{}
		for _, c := range s.Cards {
			if c.Copies > 0 {
				lists[i][c.ID] = true
			}
		}
	}
	r.Inclusion = inclusion(lists, nil)

	var dims []string
	for c, v := range r.Inclusion {
		if v >= o.MinShare {
			dims = append(dims, c)
		}
	}
	sort.Strings(dims)
	points := make([][]float64, len(lists))
	for i, l := range lists {
		points[i] = make([]float64, len(dims))
		for d, c := range dims {
			if l[c] {
				points[i][d] = 1
			}
		}
	}

	assign, spread := cluster(points, o.K, o.Seed)
	r.Spread = spread
	members := map[int][]int{}
	for i, a := range assign {
		members[a] = append(members[a], i)
	}
	groups := make([][]int, 0, len(members))
	for _, m := range members {
		groups = append(groups, m)
	}
	sort.Slice(groups, func(i, j int) bool {
		if len(groups[i]) != len(groups[j]) {
			return len(groups[i]) > len(groups[j])
		}
		return groups[i][0] < groups[j][0]
	})
	for _, m := range groups {
		r.Archetypes = append(r.Archetypes, archetype(m, sides, formats, lists, o))
	}
	return r
}

// inclusion is the share of lists (all, or only those in members) running each card.
func inclusion(lists []map[string]bool, members []int) map[string]float64 {
	if members == nil {
		members = make([]int, len(lists))
		for i := range members {
			members[i] = i
		}
	}
	count := map[string]int{}
	for _, i := range members {
		for c := range lists[i] {
			count[c]++
		}
	}
	out := make(map[string]float64, len(count))
	for c, k := range count {
		out[c] = float64(k) / float64(len(members))
	}
	return out
}

func archetype(members []int, sides []game.Side, formats []int, lists []map[string]bool, o Options) Archetype {
	a := Archetype{ByFormat: map[int]Tally{}, ByFirst: map[string]Tally{}, Inclusion: inclusion(lists, members)}
	with := map[string]Tally{}
	players := map[game.PlayerHash]bool{}
	var all Tally
	for _, i := range members {
		s := sides[i]
		players[s.Player] = true
		for _, c := range s.Cards {
			a.MeanCards += float64(c.Copies)
		}
		win := 0
		if s.Won {
			win = 1
		}
		all = Tally{all.Sides + 1, all.Wins + win}
		f := a.ByFormat[formats[i]]
		a.ByFormat[formats[i]] = Tally{f.Sides + 1, f.Wins + win}
		order := "second"
		if s.WentFirst() {
			order = "first"
		}
		t := a.ByFirst[order]
		a.ByFirst[order] = Tally{t.Sides + 1, t.Wins + win}
		for c := range lists[i] {
			w := with[c]
			with[c] = Tally{w.Sides + 1, w.Wins + win}
		}
	}
	a.Sides, a.Wins = all.Sides, all.Wins
	a.Players = len(players)
	a.MeanCards /= float64(len(members))
	for c, w := range with {
		without := Tally{all.Sides - w.Sides, all.Wins - w.Wins}
		if w.Sides >= o.MinSample && without.Sides >= o.MinSample {
			a.Lift = append(a.Lift, Lift{c, w, without})
		}
	}
	gain := func(l Lift) float64 {
		return float64(l.With.Wins)/float64(l.With.Sides) - float64(l.Without.Wins)/float64(l.Without.Sides)
	}
	sort.Slice(a.Lift, func(i, j int) bool {
		if gi, gj := gain(a.Lift[i]), gain(a.Lift[j]); gi != gj {
			return gi > gj
		}
		return a.Lift[i].Card < a.Lift[j].Card
	})
	return a
}

// cluster runs k-means restarts times from k-means++ seeds and returns the
// tightest assignment and its mean squared distance.
func cluster(points [][]float64, k int, seed uint64) ([]int, float64) {
	k = max(1, min(k, len(points)))
	rng := rand.New(rand.NewPCG(seed, seed))
	var best []int
	bestCost := math.Inf(1)
	for range restarts {
		assign, cost := kmeans(points, seeds(points, k, rng))
		if cost < bestCost {
			best, bestCost = assign, cost
		}
	}
	return best, bestCost / float64(len(points))
}

// seeds picks k starting centres by k-means++: each new one is a point drawn
// with weight its squared distance to the nearest centre so far.
func seeds(points [][]float64, k int, rng *rand.Rand) [][]float64 {
	centres := [][]float64{append([]float64(nil), points[rng.IntN(len(points))]...)}
	near := make([]float64, len(points))
	for i, p := range points {
		near[i] = dist(p, centres[0])
	}
	for len(centres) < k {
		total := 0.0
		for _, d := range near {
			total += d
		}
		pick := rng.IntN(len(points))
		if total > 0 {
			x := rng.Float64() * total
			for i, d := range near {
				if x -= d; x < 0 {
					pick = i
					break
				}
			}
		}
		c := append([]float64(nil), points[pick]...)
		centres = append(centres, c)
		for i, p := range points {
			near[i] = min(near[i], dist(p, c))
		}
	}
	return centres
}

func kmeans(points [][]float64, centres [][]float64) ([]int, float64) {
	assign := make([]int, len(points))
	for i := range assign {
		assign[i] = -1
	}
	var cost float64
	for range iterations {
		changed := false
		cost = 0
		for i, p := range points {
			bestC, bestD := 0, math.Inf(1)
			for c, centre := range centres {
				if d := dist(p, centre); d < bestD {
					bestC, bestD = c, d
				}
			}
			cost += bestD
			if assign[i] != bestC {
				assign[i], changed = bestC, true
			}
		}
		if !changed {
			break
		}
		for c := range centres {
			sum := make([]float64, len(points[0]))
			size := 0
			for i, p := range points {
				if assign[i] != c {
					continue
				}
				size++
				for d, v := range p {
					sum[d] += v
				}
			}
			if size == 0 {
				continue // an empty centre stays put and is dropped if still empty
			}
			for d := range sum {
				sum[d] /= float64(size)
			}
			centres[c] = sum
		}
	}
	return assign, cost
}

func dist(a, b []float64) float64 {
	s := 0.0
	for i := range a {
		d := a[i] - b[i]
		s += d * d
	}
	return s
}

func day(createdAt string) string {
	if len(createdAt) >= 10 {
		return createdAt[:10]
	}
	return createdAt
}
