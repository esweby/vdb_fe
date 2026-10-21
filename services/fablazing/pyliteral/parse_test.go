package pyliteral

import (
	"reflect"
	"testing"
)

func TestParse(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want any
	}{
		{"int", "42", int64(42)},
		{"negative int", "-4", int64(-4)},
		{"float", "0.25", 0.25},
		{"single-quoted string", "'murmuring_gloomblade_red'", "murmuring_gloomblade_red"},
		{"double-quoted string with apostrophe", `"Fyendal's Spring Tunic"`, "Fyendal's Spring Tunic"},
		{"escaped quote", `'it\'s'`, "it's"},
		{"booleans and None", "[True, False, None]", []any{true, false, nil}},
		{"empty containers", "{'a': [], 'b': {}}", map[string]any{"a": []any{}, "b": map[string]any{}}},
		{"turn log", "[[0, 'cull_red', 'INSTANT'], [1, 'x', 'M']]", []any{[]any{int64(0), "cull_red", "INSTANT"}, []any{int64(1), "x", "M"}}},
		{"nested dict", "{'turns': 2, 'character': [{'cardId': 'v', 'numCopies': 1}]}", map[string]any{"turns": int64(2), "character": []any{map[string]any{"cardId": "v", "numCopies": int64(1)}}}},
		{"also accepts JSON", `{"turns": 2, "ok": true, "x": null}`, map[string]any{"turns": int64(2), "ok": true, "x": nil}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Parse(c.in)
			if err != nil {
				t.Fatalf("Parse(%q) error: %v", c.in, err)
			}
			if !reflect.DeepEqual(got, c.want) {
				t.Fatalf("Parse(%q) = %#v, want %#v", c.in, got, c.want)
			}
		})
	}
}

func TestParseRejectsMalformed(t *testing.T) {
	for _, in := range []string{"", "{'a': 1", "[1, 2", "'open", "{'a' 1}", "nonsense", "[1] extra"} {
		if _, err := Parse(in); err == nil {
			t.Errorf("Parse(%q) should fail", in)
		}
	}
}
