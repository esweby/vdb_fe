// Package skill compares each player's Viserai record with their record on
// other heroes, to tell a weak hero from weak pilots (UNVERIFIED; see
// docs/viserai-ceiling.md). The other heroes face a different field, so the
// gap is an association, not the hero's cost.
package skill

import (
	"encoding/csv"
	"fmt"
	"io"
	"math/rand/v2"
	"sort"
	"strconv"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Record is a count of sides and wins.
type Record struct{ Games, Wins int }

func (r Record) Rate() float64 { return float64(r.Wins) / float64(r.Games) }

func (r *Record) add(won bool) {
	r.Games++
	if won {
		r.Wins++
	}
}

// Player is one player's Viserai record and their record on other heroes.
type Player struct {
	Player         game.PlayerHash
	Viserai, Other Record
}

// Records is every player with a Viserai side. Viserai sides in others are
// skipped, so the caller can pass every hero's sides there.
func Records(viserai, others []game.Side) []Player {
	per := map[game.PlayerHash]*Player{}
	for _, s := range viserai {
		p := per[s.Player]
		if p == nil {
			p = &Player{Player: s.Player}
			per[s.Player] = p
		}
		p.Viserai.add(s.Won)
	}
	for _, s := range others {
		if p := per[s.Player]; p != nil && !game.IsViserai(s.Hero) {
			p.Other.add(s.Won)
		}
	}
	out := make([]Player, 0, len(per))
	for _, p := range per {
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Player < out[j].Player })
	return out
}

func enough(players []Player, minEach int) []Player {
	var out []Player
	for _, p := range players {
		if p.Viserai.Games >= minEach && p.Other.Games >= minEach {
			out = append(out, p)
		}
	}
	return out
}

// Gap is the mean of each player's Viserai rate minus their other-hero rate,
// with a 95% bootstrap interval over players.
type Gap struct {
	Players             int
	Viserai, Other, Gap float64
	Low, High           float64
}

// Paired is the gap over players with at least minEach sides on both.
func Paired(players []Player, minEach, resamples int, seed uint64) Gap {
	ps := enough(players, minEach)
	if len(ps) == 0 {
		return Gap{}
	}
	g := Gap{Players: len(ps)}
	diffs := make([]float64, len(ps))
	for i, p := range ps {
		g.Viserai += p.Viserai.Rate() / float64(len(ps))
		g.Other += p.Other.Rate() / float64(len(ps))
		diffs[i] = p.Viserai.Rate() - p.Other.Rate()
		g.Gap += diffs[i] / float64(len(ps))
	}
	rng := rand.New(rand.NewPCG(seed, seed))
	boot := make([]float64, resamples)
	for b := range boot {
		for range diffs {
			boot[b] += diffs[rng.IntN(len(diffs))] / float64(len(diffs))
		}
	}
	sort.Float64s(boot)
	if resamples > 0 {
		g.Low, g.High = boot[int(0.025*float64(resamples))], boot[min(resamples-1, int(0.975*float64(resamples)))]
	}
	return g
}

// Band is the players whose other-hero rate is in [From, To), with their
// Viserai sides pooled and each player's Viserai rate averaged.
type Band struct {
	From, To   float64
	Players    int
	Viserai    Record
	PlayerRate float64
}

// Bands splits players with at least minEach sides on both at cuts; the last
// band runs to 1 inclusive.
func Bands(players []Player, minEach int, cuts []float64) []Band {
	edges := append(append([]float64{0}, cuts...), 1)
	bands := make([]Band, len(edges)-1)
	for i := range bands {
		bands[i].From, bands[i].To = edges[i], edges[i+1]
	}
	for _, p := range enough(players, minEach) {
		i := sort.SearchFloat64s(cuts, p.Other.Rate())
		if i < len(cuts) && cuts[i] == p.Other.Rate() {
			i++
		}
		b := &bands[i]
		b.Players++
		b.Viserai.Games += p.Viserai.Games
		b.Viserai.Wins += p.Viserai.Wins
		b.PlayerRate += p.Viserai.Rate()
	}
	for i := range bands {
		if bands[i].Players > 0 {
			bands[i].PlayerRate /= float64(bands[i].Players)
		}
	}
	return bands
}

// Row is one kept side of a full day, kept small so a day's file isn't stored whole.
type Row struct {
	Date           string
	Format         int
	Player         game.PlayerHash
	Hero, Opponent string
	Won, Fatigue   bool
}

// Side is the row as a side, without cards or turns.
func (r Row) Side() game.Side {
	return game.Side{Player: r.Player, Hero: r.Hero, Opponent: r.Opponent, Won: r.Won, Fatigue: r.Fatigue}
}

var header = []string{"date", "format", "player", "hero", "opponent", "won", "fatigue"}

// WriteRows writes rows as CSV with a header.
func WriteRows(w io.Writer, rows []Row) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(header); err != nil {
		return err
	}
	for _, r := range rows {
		rec := []string{r.Date, strconv.Itoa(r.Format), string(r.Player), r.Hero, r.Opponent, strconv.FormatBool(r.Won), strconv.FormatBool(r.Fatigue)}
		if err := cw.Write(rec); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

// ReadRows reads what WriteRows wrote.
func ReadRows(r io.Reader) ([]Row, error) {
	recs, err := csv.NewReader(r).ReadAll()
	if err != nil {
		return nil, err
	}
	if len(recs) == 0 {
		return nil, nil
	}
	var out []Row
	for n, rec := range recs[1:] {
		if len(rec) != len(header) {
			return nil, fmt.Errorf("row %d: want %d fields, got %d", n+2, len(header), len(rec))
		}
		f, err1 := strconv.Atoi(rec[1])
		won, err2 := strconv.ParseBool(rec[5])
		tired, err3 := strconv.ParseBool(rec[6])
		if err1 != nil || err2 != nil || err3 != nil {
			return nil, fmt.Errorf("row %d: bad format, won or fatigue", n+2)
		}
		out = append(out, Row{Date: rec[0], Format: f, Player: game.PlayerHash(rec[2]), Hero: rec[3], Opponent: rec[4], Won: won, Fatigue: tired})
	}
	return out, nil
}
