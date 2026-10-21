// Package game reads FaBlazing's daily CSV of Talishar games into typed games
// and player-sides. Field meanings are in docs/fablazing-data-dictionary.md.
package game

import (
	"encoding/csv"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	"github.com/esweby/vdb_fe/services/fablazing/pyliteral"
)

// Game is one row of the CSV: a game between two player-sides.
type Game struct {
	GUID      string
	ID        string // Talishar's room number; reused across games, so not a key
	Format    int
	CreatedAt string
	Conceded  bool
	Sides     [2]Side
}

// Side is one player's view of a game.
type Side struct {
	Hero     string // the side the hero ended the game on, e.g. viserai_usurper
	Opponent string
	// Player is the hashed player name, used only to cap one player's weight.
	Player PlayerHash
	Won    bool
	Turns  int
	// FirstPlayer is the raw field (1 or 2). What it refers to is unconfirmed.
	FirstPlayer int
	Character   []string // hero, weapons and equipment ids
	// Detailed is false when the side has only the game summary: no cards,
	// log or turn stats.
	Detailed  bool
	Cards     []Card
	Log       []Event
	TurnStats []TurnStats // indexed by turn number
}

// PlayerHash is a hashed player name from the CSV. It's used only for capping
// one player's weight and never shown: printing or marshalling it hides it.
type PlayerHash string

const hidden = "[player]"

func (PlayerHash) String() string                { return hidden }
func (PlayerHash) MarshalJSON() ([]byte, error)  { return []byte(`"` + hidden + `"`), nil }
func (PlayerHash) MarshalText() ([]byte, error)  { return []byte(hidden), nil }
func (PlayerHash) Format(f fmt.State, verb rune) { fmt.Fprint(f, hidden) }

// Card is one row of cardResults.
type Card struct {
	ID                                        string
	Copies, Pitch                             int
	Played, Pitched, Blocked, Hits, Discarded int
}

// Event is one turnLog entry: [turn, cardId, action].
type Event struct {
	Turn   int
	Card   string
	Action string
}

// TurnStats is one turnResults entry.
type TurnStats struct {
	DamageDealt, DamageTaken     int
	LifeAtEnd, OpponentLifeAtEnd int
	HasLife                      bool
	Recorded                     bool // the turn is in turnResults
}

// LifeDiffBefore is the side's life minus the opponent's going into a turn:
// level at turn 0 (both start on the same life in Classic Constructed), then
// the totals at the end of the turn before. ok is false without turn stats.
func (s Side) LifeDiffBefore(turn int) (diff int, ok bool) {
	if len(s.TurnStats) == 0 || turn < 0 {
		return 0, false
	}
	if turn == 0 {
		return 0, true
	}
	if turn-1 >= len(s.TurnStats) || !s.TurnStats[turn-1].HasLife {
		return 0, false
	}
	t := s.TurnStats[turn-1]
	return t.LifeAtEnd - t.OpponentLifeAtEnd, true
}

// IsViserai reports whether a hero id is Viserai on either side.
func IsViserai(hero string) bool { return strings.HasPrefix(hero, "viserai_") }

// ConcessionRule decides when a concession is an abandoned game rather than a
// result: conceded within MaxTurns while the loser's life was above MaxLife.
type ConcessionRule struct{ MaxTurns, MaxLife int }

// Abandoned reports whether the game is an early concession by a player who
// hadn't taken real damage. A loser whose life is unknown counts as abandoned.
func (g Game) Abandoned(r ConcessionRule) bool {
	if !g.Conceded || g.Sides[0].Turns > r.MaxTurns {
		return false
	}
	life, ok := g.loserLife()
	return !ok || life > r.MaxLife
}

func (g Game) loserLife() (int, bool) {
	for i, s := range g.Sides {
		if s.Won {
			continue
		}
		if t, ok := last(s.TurnStats); ok {
			return t.LifeAtEnd, true
		}
		if t, ok := last(g.Sides[1-i].TurnStats); ok {
			return t.OpponentLifeAtEnd, true
		}
	}
	return 0, false
}

func last(ts []TurnStats) (TurnStats, bool) {
	for i := len(ts) - 1; i >= 0; i-- {
		if ts[i].HasLife {
			return ts[i], true
		}
	}
	return TurnStats{}, false
}

// ReadAll reads every game. A GUID that appears more than once keeps its
// latest copy by created_at. Games come back in created_at order.
func ReadAll(r io.Reader) ([]Game, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	head, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("reading header: %w", err)
	}
	col := map[string]int{}
	for i, h := range head {
		col[h] = i
	}
	for _, need := range []string{"game_guid", "game_id", "format", "deck1_json", "deck2_json", "created_at", "conceded"} {
		if _, ok := col[need]; !ok {
			return nil, fmt.Errorf("missing column %q", need)
		}
	}
	latest := map[string]Game{}
	for line := 2; ; line++ {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", line, err)
		}
		g, err := parseRow(rec, col)
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", line, err)
		}
		if prev, ok := latest[g.GUID]; !ok || g.CreatedAt > prev.CreatedAt {
			latest[g.GUID] = g
		}
	}
	games := make([]Game, 0, len(latest))
	for _, g := range latest {
		games = append(games, g)
	}
	sort.Slice(games, func(i, j int) bool { return games[i].CreatedAt < games[j].CreatedAt })
	return games, nil
}

func parseRow(rec []string, col map[string]int) (Game, error) {
	get := func(k string) string {
		if i := col[k]; i < len(rec) {
			return rec[i]
		}
		return ""
	}
	format, err := strconv.Atoi(get("format"))
	if err != nil {
		return Game{}, fmt.Errorf("format: %w", err)
	}
	g := Game{GUID: get("game_guid"), ID: get("game_id"), Format: format, CreatedAt: get("created_at"), Conceded: get("conceded") == "True"}
	for i, k := range []string{"deck1_json", "deck2_json"} {
		v, err := pyliteral.Parse(get(k))
		if err != nil {
			return Game{}, fmt.Errorf("%s: %w", k, err)
		}
		m, ok := v.(map[string]any)
		if !ok {
			return Game{}, fmt.Errorf("%s is not a dict", k)
		}
		g.Sides[i] = parseSide(m)
		g.Sides[i].Player = PlayerHash(get([]string{"player1_name", "player2_name"}[i]))
	}
	return g, nil
}

func parseSide(m map[string]any) Side {
	s := Side{
		Hero: str(m["playerHero"]), Opponent: str(m["opposingHero"]),
		Won: num(m["result"]) == 1, Turns: num(m["turns"]), FirstPlayer: num(m["firstPlayer"]),
	}
	for _, c := range list(m["character"]) {
		s.Character = append(s.Character, cardID(dict(c)["cardId"]))
	}
	cards, ok := m["cardResults"].([]any)
	if !ok {
		return s
	}
	s.Detailed = true
	for _, c := range cards {
		d := dict(c)
		s.Cards = append(s.Cards, Card{
			ID: cardID(d["cardId"]), Copies: num(d["numCopies"]), Pitch: num(d["pitchValue"]),
			Played: num(d["played"]), Pitched: num(d["pitched"]), Blocked: num(d["blocked"]),
			Hits: num(d["hits"]), Discarded: num(d["discarded"]),
		})
	}
	for _, e := range list(m["turnLog"]) {
		if l := list(e); len(l) >= 3 {
			s.Log = append(s.Log, Event{Turn: num(l[0]), Card: cardID(l[1]), Action: str(l[2])})
		}
	}
	turns := dict(m["turnResults"])
	if len(turns) > 0 {
		s.TurnStats = make([]TurnStats, s.Turns)
	}
	for k, v := range turns {
		n, err := strconv.Atoi(strings.TrimPrefix(k, "turn_"))
		if err != nil || n < 0 {
			continue
		}
		for n >= len(s.TurnStats) {
			s.TurnStats = append(s.TurnStats, TurnStats{})
		}
		d := dict(v)
		_, hasLife := d["lifeAtTurnEnd"]
		s.TurnStats[n] = TurnStats{
			DamageDealt: num(d["damageDealt"]), DamageTaken: num(d["damageTaken"]),
			LifeAtEnd: num(d["lifeAtTurnEnd"]), OpponentLifeAtEnd: num(d["opponentLifeAtTurnEnd"]), HasLife: hasLife, Recorded: true,
		}
	}
	return s
}

// cardID drops the ~BLIND suffix Talishar adds to some card ids in the log.
func cardID(v any) string { return strings.TrimSuffix(str(v), "~BLIND") }

func str(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case int64:
		return strconv.FormatInt(x, 10)
	}
	return ""
}

func num(v any) int {
	switch x := v.(type) {
	case int64:
		return int(x)
	case float64:
		return int(x)
	case string:
		n, _ := strconv.Atoi(x)
		return n
	}
	return 0
}

func list(v any) []any {
	l, _ := v.([]any)
	return l
}

func dict(v any) map[string]any {
	d, _ := v.(map[string]any)
	return d
}
