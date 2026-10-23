// Package observed computes the observed side of the engine calibration
// (docs/engine-calibration.md): per turn index, the distributions of arcane
// damage, damage dealt and damage threatened for Viserai, and the turn index of
// the first traverse to the Usurper. It's pure, and the rows are associations.
//
// Who counts: detailed Viserai sides of games with at least MinTurns turn
// indexes, leaving out abandoned early concessions, with each player's
// earliest PlayerCap sides per day and format.
package observed

import (
	"math"
	"sort"
	"strconv"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Options for one computation.
type Options struct {
	MinTurns    int
	Concession  game.ConcessionRule
	PlayerCap   int // per day and format; 0 for no cap
	TurnIndexes int // turn indexes reported, from 0
}

// Dist is a distribution of whole numbers: Counts[v] sides had value v.
// Percentiles are nearest-rank.
type Dist struct {
	N      int   `json:"n"`
	Counts []int `json:"counts"`
	Median int   `json:"median"`
	P2_5   int   `json:"p2_5"`
	P97_5  int   `json:"p97_5"`
}

// Turn is one turn index's distributions.
type Turn struct {
	TurnIndex  int  `json:"turn_index"`
	Arcane     Dist `json:"arcane_damage_dealt"`
	Damage     Dist `json:"damage_dealt"`
	Threatened Dist `json:"damage_threatened"`
}

// FirstTraverse is the turn index of each side's first TRANSFORM to the
// Usurper. The percentiles are over the sides that traversed.
type FirstTraverse struct {
	Sides       int   `json:"sides"`
	Never       int   `json:"never"`
	ByTurnIndex []int `json:"by_turn_index"`
	Median      int   `json:"median"`
	P2_5        int   `json:"p2_5"`
	P97_5       int   `json:"p97_5"`
}

// Group is one population's distributions.
type Group struct {
	Sides         int           `json:"sides"`
	ByTurn        []Turn        `json:"by_turn"`
	FirstTraverse FirstTraverse `json:"first_traverse"`
}

// Counts says what was left out and why. Each Viserai side counts once, in
// this order: abandoned, without detail, short, capped, kept.
type Counts struct {
	Games         int `json:"games"`
	ViseraiSides  int `json:"viserai_sides"`
	Abandoned     int `json:"abandoned"`
	WithoutDetail int `json:"without_detail"`
	Short         int `json:"short"`
	Capped        int `json:"capped"`
	Kept          int `json:"kept"`
}

// Result is the observed side.
type Result struct {
	Counts        Counts           `json:"counts"`
	Pooled        Group            `json:"pooled"`
	ByFormat      map[string]Group `json:"by_format"`
	ByFirstPlayer map[string]Group `json:"by_first_player"`
	ByOpponent    map[string]Group `json:"by_opponent"`
}

type capKey struct {
	player game.PlayerHash
	day    string
	format int
}

// Observer collects sides one batch of games at a time, so a month of files
// needn't be in memory at once. The cap is per day and format, so a day and
// format must not be split across batches (each FaBlazing file is one).
type Observer struct {
	o                        Options
	c                        Counts
	pooled                   *collector
	byFormat, byFirst, byOpp map[string]*collector
	perPlayer                map[capKey]int
}

// New starts an Observer.
func New(o Options) *Observer {
	return &Observer{o: o, pooled: &collector{}, byFormat: map[string]*collector{}, byFirst: map[string]*collector{}, byOpp: map[string]*collector{}, perPlayer: map[capKey]int{}}
}

// Compute builds the observed distributions from one batch of games.
func Compute(games []game.Game, o Options) Result {
	ob := New(o)
	ob.Add(games)
	return ob.Result()
}

// Add collects a batch of games, earliest first.
func (ob *Observer) Add(games []game.Game) {
	ordered := append([]game.Game(nil), games...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].CreatedAt != ordered[j].CreatedAt {
			return ordered[i].CreatedAt < ordered[j].CreatedAt
		}
		return ordered[i].GUID < ordered[j].GUID
	})
	o, c := ob.o, &ob.c
	for _, g := range ordered {
		c.Games++
		abandoned := g.Abandoned(o.Concession)
		for _, s := range g.Sides {
			// The cap counts every side a player has that day, as aggregate does.
			capped := false
			if s.Player != "" && o.PlayerCap > 0 {
				k := capKey{s.Player, day(g.CreatedAt), g.Format}
				ob.perPlayer[k]++
				capped = ob.perPlayer[k] > o.PlayerCap
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
				ob.pooled.add(s)
				group(ob.byFormat, strconv.Itoa(g.Format)).add(s)
				group(ob.byFirst, strconv.Itoa(s.FirstPlayer)).add(s)
				group(ob.byOpp, opponent(s.Opponent)).add(s)
			}
		}
	}
}

// Result is the distributions so far.
func (ob *Observer) Result() Result {
	n := ob.o.TurnIndexes
	return Result{
		Counts:        ob.c,
		Pooled:        ob.pooled.group(n),
		ByFormat:      groups(ob.byFormat, n),
		ByFirstPlayer: groups(ob.byFirst, n),
		ByOpponent:    groups(ob.byOpp, n),
	}
}

func day(createdAt string) string {
	if len(createdAt) >= 10 {
		return createdAt[:10]
	}
	return createdAt
}

// opponent counts Viserai as one hero, whichever side it ended on.
func opponent(hero string) string {
	if game.IsViserai(hero) {
		return "viserai"
	}
	return hero
}

type collector struct {
	sides                      int
	arcane, damage, threatened map[int][]int
	firstTraverse              []int
	never                      int
}

func group(m map[string]*collector, k string) *collector {
	if m[k] == nil {
		m[k] = &collector{}
	}
	return m[k]
}

func (c *collector) add(s game.Side) {
	if c.arcane == nil {
		c.arcane, c.damage, c.threatened = map[int][]int{}, map[int][]int{}, map[int][]int{}
	}
	c.sides++
	for i, t := range s.TurnStats {
		if !t.Recorded {
			continue
		}
		c.arcane[i] = append(c.arcane[i], t.ArcaneDealt)
		c.damage[i] = append(c.damage[i], t.DamageDealt)
		c.threatened[i] = append(c.threatened[i], t.DamageThreatened)
	}
	for _, e := range s.Log {
		if e.Action == "TRANSFORM" && e.Card == "viserai_usurper" {
			c.firstTraverse = append(c.firstTraverse, e.Turn)
			return
		}
	}
	c.never++
}

func (c *collector) group(turnIndexes int) Group {
	g := Group{Sides: c.sides, ByTurn: make([]Turn, turnIndexes)}
	for i := range g.ByTurn {
		g.ByTurn[i] = Turn{TurnIndex: i, Arcane: dist(c.arcane[i]), Damage: dist(c.damage[i]), Threatened: dist(c.threatened[i])}
	}
	d := dist(c.firstTraverse)
	g.FirstTraverse = FirstTraverse{Sides: c.sides, Never: c.never, ByTurnIndex: d.Counts, Median: d.Median, P2_5: d.P2_5, P97_5: d.P97_5}
	return g
}

func groups(m map[string]*collector, turnIndexes int) map[string]Group {
	out := make(map[string]Group, len(m))
	for k, c := range m {
		out[k] = c.group(turnIndexes)
	}
	return out
}

// dist counts whole numbers (negatives are counted as 0) and takes
// nearest-rank percentiles.
func dist(xs []int) Dist {
	d := Dist{N: len(xs), Counts: []int{}}
	if len(xs) == 0 {
		return d
	}
	sorted := append([]int(nil), xs...)
	for i, x := range sorted {
		if x < 0 {
			sorted[i] = 0
		}
	}
	sort.Ints(sorted)
	d.Counts = make([]int, sorted[len(sorted)-1]+1)
	for _, x := range sorted {
		d.Counts[x]++
	}
	rank := func(p float64) int {
		r := int(math.Ceil(p * float64(len(sorted))))
		return sorted[max(r, 1)-1]
	}
	d.Median, d.P2_5, d.P97_5 = rank(0.5), rank(0.025), rank(0.975)
	return d
}
