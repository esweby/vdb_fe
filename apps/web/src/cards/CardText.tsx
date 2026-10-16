import type { ReactNode } from "react";
import styles from "./CardText.module.css";

/**
 * The dataset's symbol codes and what they stand for. {x} is printed as a red circle with an X
 * (maintainer, 16 Oct 2026): in "{x}{x}{r}" the {r} is the minimum cost and each {x} is a
 * resource you may also pay.
 */
const SYMBOLS: Record<string, { glyph: string; name: string }> = {
  p: { glyph: "⚔", name: "power" },
  d: { glyph: "⛨", name: "defense" },
  r: { glyph: "●", name: "resource" },
  h: { glyph: "♥", name: "life" },
  i: { glyph: "✋", name: "intellect" },
  c: { glyph: "☯", name: "chi" },
  t: { glyph: "↷", name: "tap" },
  u: { glyph: "↶", name: "untap" },
  x: { glyph: "⊗", name: "optional resource" },
};

function withSymbols(text: string, key: string): ReactNode[] {
  return text.split(/(\{[a-z]\})/).map((part, i) => {
    const symbol = SYMBOLS[part.slice(1, -1)];
    if (!symbol || !/^\{[a-z]\}$/.test(part)) return part;
    return (
      <span
        key={`${key}-${i}`}
        role="img"
        aria-label={symbol.name}
        title={symbol.name}
        className={styles.symbol}
        data-symbol={part.slice(1, -1)}
      >
        {symbol.glyph}
      </span>
    );
  });
}

/** Card text as it's printed: symbols for the dataset's codes, keywords in bold. */
export function CardText(props: { text: string; keywords?: string[] }) {
  const { text } = props;
  const keywords = props.keywords ?? [];
  if (keywords.length === 0) return <>{withSymbols(text, "t")}</>;
  const escaped = [...keywords]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  return (
    <>
      {text
        .split(pattern)
        .map((part, i) =>
          i % 2 === 1 ? (
            <strong key={i}>{part}</strong>
          ) : (
            withSymbols(part, String(i))
          ),
        )}
    </>
  );
}
