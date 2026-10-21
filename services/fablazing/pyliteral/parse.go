// Package pyliteral parses the Python literal text FaBlazing uses for its deck
// columns: dicts, lists, strings, numbers, True, False and None. It also
// accepts JSON, in case the export switches format.
package pyliteral

import (
	"fmt"
	"strconv"
	"strings"
)

// Parse reads exactly one literal. Dicts become map[string]any, lists []any,
// whole numbers int64 and other numbers float64.
func Parse(s string) (any, error) {
	p := &parser{s: s}
	v, err := p.value()
	if err != nil {
		return nil, err
	}
	p.space()
	if p.i != len(p.s) {
		return nil, p.fail("unexpected text after value")
	}
	return v, nil
}

type parser struct {
	s string
	i int
}

var words = []struct {
	text string
	v    any
}{{"True", true}, {"False", false}, {"None", nil}, {"true", true}, {"false", false}, {"null", nil}}

func (p *parser) fail(msg string) error {
	return fmt.Errorf("pyliteral: %s at offset %d", msg, p.i)
}

func (p *parser) space() {
	for p.i < len(p.s) && strings.IndexByte(" \t\r\n", p.s[p.i]) >= 0 {
		p.i++
	}
}

func (p *parser) value() (any, error) {
	p.space()
	if p.i >= len(p.s) {
		return nil, p.fail("unexpected end")
	}
	switch c := p.s[p.i]; {
	case c == '{':
		return p.dict()
	case c == '[':
		return p.list()
	case c == '\'' || c == '"':
		return p.str()
	case c == '-' || (c >= '0' && c <= '9'):
		return p.number()
	}
	for _, w := range words {
		if strings.HasPrefix(p.s[p.i:], w.text) {
			p.i += len(w.text)
			return w.v, nil
		}
	}
	return nil, p.fail("unexpected character")
}

func (p *parser) dict() (any, error) {
	p.i++ // {
	m := map[string]any{}
	p.space()
	if p.i < len(p.s) && p.s[p.i] == '}' {
		p.i++
		return m, nil
	}
	for {
		p.space()
		if p.i >= len(p.s) || (p.s[p.i] != '\'' && p.s[p.i] != '"') {
			return nil, p.fail("expected string key")
		}
		k, err := p.str()
		if err != nil {
			return nil, err
		}
		p.space()
		if p.i >= len(p.s) || p.s[p.i] != ':' {
			return nil, p.fail("expected ':'")
		}
		p.i++
		v, err := p.value()
		if err != nil {
			return nil, err
		}
		m[k.(string)] = v
		if done, err := p.next('}'); err != nil || done {
			return m, err
		}
	}
}

func (p *parser) list() (any, error) {
	p.i++ // [
	l := []any{}
	p.space()
	if p.i < len(p.s) && p.s[p.i] == ']' {
		p.i++
		return l, nil
	}
	for {
		v, err := p.value()
		if err != nil {
			return nil, err
		}
		l = append(l, v)
		if done, err := p.next(']'); err != nil || done {
			return l, err
		}
	}
}

// next consumes a ',' (more to come) or the closing bracket (done).
func (p *parser) next(close byte) (bool, error) {
	p.space()
	if p.i >= len(p.s) {
		return false, p.fail("unexpected end")
	}
	switch p.s[p.i] {
	case ',':
		p.i++
		p.space()
		if p.i < len(p.s) && p.s[p.i] == close { // trailing comma
			p.i++
			return true, nil
		}
		return false, nil
	case close:
		p.i++
		return true, nil
	}
	return false, p.fail("expected ',' or closing bracket")
}

func (p *parser) str() (any, error) {
	quote := p.s[p.i]
	p.i++
	var b strings.Builder
	for p.i < len(p.s) {
		c := p.s[p.i]
		switch {
		case c == quote:
			p.i++
			return b.String(), nil
		case c == '\\' && p.i+1 < len(p.s):
			p.i++
			switch e := p.s[p.i]; e {
			case 'n':
				b.WriteByte('\n')
			case 't':
				b.WriteByte('\t')
			case 'u', 'x':
				n := 4
				if e == 'x' {
					n = 2
				}
				if p.i+n >= len(p.s) {
					return nil, p.fail("short escape")
				}
				r, err := strconv.ParseUint(p.s[p.i+1:p.i+1+n], 16, 32)
				if err != nil {
					return nil, p.fail("bad escape")
				}
				b.WriteRune(rune(r))
				p.i += n
			default: // \\ \' \" and anything else: the character itself
				b.WriteByte(e)
			}
			p.i++
		default:
			b.WriteByte(c)
			p.i++
		}
	}
	return nil, p.fail("unterminated string")
}

func (p *parser) number() (any, error) {
	start := p.i
	if p.s[p.i] == '-' {
		p.i++
	}
	isFloat := false
	for p.i < len(p.s) {
		c := p.s[p.i]
		if c == '.' || c == 'e' || c == 'E' || c == '+' || (c == '-' && isFloat) {
			isFloat = true
		} else if c < '0' || c > '9' {
			break
		}
		p.i++
	}
	text := p.s[start:p.i]
	if !isFloat {
		if n, err := strconv.ParseInt(text, 10, 64); err == nil {
			return n, nil
		}
	}
	f, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return nil, p.fail("bad number")
	}
	return f, nil
}
