// Package measure compares chain outcomes with the life totals held level, so
// a chain that is mostly played from ahead doesn't look better than it is.
// The results are associations, not causes.
package measure

import (
	"math"
	"sort"
)

// LifeBucket groups a life difference (own life minus the opponent's) going
// into a turn.
func LifeBucket(diff int) string {
	switch {
	case diff <= -10:
		return "behind 10+"
	case diff <= -3:
		return "behind 3-9"
	case diff <= 2:
		return "level"
	case diff <= 9:
		return "ahead 3-9"
	default:
		return "ahead 10+"
	}
}

// Buckets lists the life buckets in order, for printing.
var Buckets = []string{"behind 10+", "behind 3-9", "level", "ahead 3-9", "ahead 10+"}

// Outcome is one side's result, its group (such as "complete") and its life bucket.
type Outcome struct {
	Group, Bucket string
	Won           bool
	Damage        int // damage dealt on the turn being compared
}

// Comparison is group A against group B.
type Comparison struct {
	NA, NB     int     // sides in each group
	RawA, RawB float64 // win rates, ignoring life totals
	// Adjusted is A's win rate minus B's within each life bucket, averaged with
	// weights by the bucket's size. Only buckets that have both groups count.
	Adjusted float64
	Margin   float64 // 95% margin of error on Adjusted (Wald, normal approximation)
	Compared int     // sides in the buckets that were compared
	// DamageA and DamageB are mean damage over all sides in each group.
	DamageA, DamageB float64
	PerBucket        map[string][2]Tally
}

// Tally counts sides and wins.
type Tally struct{ N, Wins int }

func (t Tally) rate() float64 { return float64(t.Wins) / float64(t.N) }

// Compare adjusts A against B for life totals.
func Compare(outcomes []Outcome, a, b string) Comparison {
	c := Comparison{PerBucket: map[string][2]Tally{}}
	var winsA, winsB, dmgA, dmgB int
	for _, o := range outcomes {
		i := -1
		switch o.Group {
		case a:
			i = 0
			c.NA++
			dmgA += o.Damage
			if o.Won {
				winsA++
			}
		case b:
			i = 1
			c.NB++
			dmgB += o.Damage
			if o.Won {
				winsB++
			}
		}
		if i < 0 {
			continue
		}
		t := c.PerBucket[o.Bucket]
		t[i].N++
		if o.Won {
			t[i].Wins++
		}
		c.PerBucket[o.Bucket] = t
	}
	if c.NA > 0 {
		c.RawA, c.DamageA = float64(winsA)/float64(c.NA), float64(dmgA)/float64(c.NA)
	}
	if c.NB > 0 {
		c.RawB, c.DamageB = float64(winsB)/float64(c.NB), float64(dmgB)/float64(c.NB)
	}
	for _, t := range c.PerBucket {
		if t[0].N > 0 && t[1].N > 0 {
			c.Compared += t[0].N + t[1].N
		}
	}
	if c.Compared == 0 {
		return c
	}
	var variance float64
	for _, t := range c.PerBucket {
		if t[0].N == 0 || t[1].N == 0 {
			continue
		}
		w := float64(t[0].N+t[1].N) / float64(c.Compared)
		pa, pb := t[0].rate(), t[1].rate()
		c.Adjusted += w * (pa - pb)
		variance += w * w * (pa*(1-pa)/float64(t[0].N) + pb*(1-pb)/float64(t[1].N))
	}
	c.Margin = 1.96 * math.Sqrt(variance)
	return c
}

// Median of whole numbers; NaN when there are none.
func Median(xs []int) float64 {
	if len(xs) == 0 {
		return math.NaN()
	}
	s := append([]int(nil), xs...)
	sort.Ints(s)
	m := len(s) / 2
	if len(s)%2 == 1 {
		return float64(s[m])
	}
	return float64(s[m-1]+s[m]) / 2
}
