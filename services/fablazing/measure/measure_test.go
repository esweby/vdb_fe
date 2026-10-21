package measure

import (
	"math"
	"testing"
)

func TestLifeBucket(t *testing.T) {
	for diff, want := range map[int]string{-20: "behind 10+", -10: "behind 10+", -9: "behind 3-9", -3: "behind 3-9", -2: "level", 0: "level", 2: "level", 3: "ahead 3-9", 9: "ahead 3-9", 10: "ahead 10+", 25: "ahead 10+"} {
		if got := LifeBucket(diff); got != want {
			t.Errorf("LifeBucket(%d) = %q, want %q", diff, got, want)
		}
	}
}

func outcomes(group, bucket string, wins, n int) []Outcome {
	var o []Outcome
	for i := 0; i < n; i++ {
		o = append(o, Outcome{Group: group, Bucket: bucket, Won: i < wins})
	}
	return o
}

func TestCompareAdjustsForLifeTotals(t *testing.T) {
	// Within each bucket the two groups win equally often, but "complete" is
	// mostly played from ahead. The raw rates differ; the adjusted difference is 0.
	var o []Outcome
	o = append(o, outcomes("complete", "ahead 10+", 80, 100)...)
	o = append(o, outcomes("complete", "behind 10+", 2, 10)...)
	o = append(o, outcomes("setup", "ahead 10+", 8, 10)...)
	o = append(o, outcomes("setup", "behind 10+", 20, 100)...)
	c := Compare(o, "complete", "setup")
	if c.NA != 110 || c.NB != 110 {
		t.Fatalf("counts %d, %d", c.NA, c.NB)
	}
	if math.Abs(c.RawA-82.0/110) > 1e-9 || math.Abs(c.RawB-28.0/110) > 1e-9 {
		t.Fatalf("raw rates %v, %v", c.RawA, c.RawB)
	}
	if math.Abs(c.Adjusted) > 1e-9 {
		t.Fatalf("adjusted difference %v, want 0", c.Adjusted)
	}
	if c.Margin <= 0 {
		t.Fatalf("margin %v should be positive", c.Margin)
	}
}

func TestCompareFindsARealDifference(t *testing.T) {
	var o []Outcome
	o = append(o, outcomes("complete", "level", 60, 100)...)
	o = append(o, outcomes("setup", "level", 40, 100)...)
	c := Compare(o, "complete", "setup")
	if math.Abs(c.Adjusted-0.2) > 1e-9 {
		t.Fatalf("adjusted %v, want 0.2", c.Adjusted)
	}
	// Wald margin for 0.6 v 0.4 with 100 each: 1.96 * sqrt(0.24/100 + 0.24/100) ≈ 0.136.
	if math.Abs(c.Margin-0.1358) > 0.001 {
		t.Fatalf("margin %v, want about 0.136", c.Margin)
	}
}

func TestCompareSkipsBucketsWithOnlyOneGroup(t *testing.T) {
	var o []Outcome
	o = append(o, outcomes("complete", "level", 5, 10)...)
	o = append(o, outcomes("setup", "level", 5, 10)...)
	o = append(o, outcomes("complete", "ahead 10+", 10, 10)...) // no "setup" here to compare with
	c := Compare(o, "complete", "setup")
	if c.Adjusted != 0 || c.Compared != 20 {
		t.Fatalf("got adjusted %v over %d sides, want 0 over 20", c.Adjusted, c.Compared)
	}
}

func TestMedian(t *testing.T) {
	if got := Median([]int{3, 1, 2}); got != 2 {
		t.Errorf("odd: %v", got)
	}
	if got := Median([]int{4, 1, 2, 3}); got != 2.5 {
		t.Errorf("even: %v", got)
	}
	if got := Median(nil); !math.IsNaN(got) {
		t.Errorf("empty: %v", got)
	}
}
