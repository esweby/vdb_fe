import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { TYPE_LABELS } from "../cards/filterCards.ts";
import { variantName } from "./deckRules.ts";
import styles from "./CardTile.module.css";

const GEAR = ["weapon", "equipment"];

/** The type line, e.g. "Shadow Runeblade Action", or "Runeblade Weapon · Sword · 2H". */
export function typeLine(card: CardSummary) {
  const base = [
    ...card.talents,
    ...card.classes,
    TYPE_LABELS[card.type] ?? card.type,
  ].join(" ");
  return GEAR.includes(card.type) && card.subtypes.length > 0
    ? [base, ...card.subtypes].join(" · ")
    : base;
}

/**
 * A card-shaped placeholder laid out like a printed card: pitch strip and cost at the top,
 * name banner, an art box, keywords where the text box would be, the type line, and
 * power / defense in the bottom corners. Real images replace the art box later (M8).
 */
export function CardTile(props: {
  card: CardSummary;
  variant: VariantSummary;
  quantity: number;
  children?: ReactNode;
}) {
  const { card, variant, quantity, children } = props;
  const name = variantName(card, variant);
  const pitchClass = styles[`pitch${variant.pitch ?? 0}`] ?? "";
  return (
    <article aria-label={name} className={`${styles.tile} ${pitchClass}`}>
      <div className={styles.top}>
        {variant.pitch !== null ? (
          <span
            className={styles.pitch}
            aria-label={`Pitch ${variant.pitch}`}
            role="img"
          >
            {Array.from({ length: variant.pitch }, (_, i) => (
              <span key={i} />
            ))}
          </span>
        ) : (
          <span />
        )}
        {variant.cost !== null && (
          <span
            className={styles.cost}
            aria-label={`Cost ${variant.cost}`}
            role="img"
          >
            {variant.cost}
          </span>
        )}
      </div>
      <Link
        to="/cards/$cardId"
        params={{ cardId: card.id }}
        className={styles.name}
      >
        {card.name}
      </Link>
      <div className={styles.art} aria-hidden="true">
        {GEAR.includes(card.type) && card.subtypes.length > 0
          ? card.subtypes.join(" · ")
          : (TYPE_LABELS[card.type] ?? card.type)}
      </div>
      <div className={styles.text}>
        {card.keywords.length > 0 ? (
          card.keywords.map((k) => <span key={k}>{k}</span>)
        ) : (
          <span className={styles.noText}>—</span>
        )}
      </div>
      <div className={styles.typeLine}>{typeLine(card)}</div>
      <div className={styles.bottom}>
        {variant.power !== null ? (
          <span
            className={styles.stat}
            aria-label={`Power ${variant.power}`}
            role="img"
          >
            <span aria-hidden="true">⚔</span>
            {variant.power}
          </span>
        ) : (
          <span />
        )}
        {variant.defense !== null && (
          <span
            className={styles.stat}
            aria-label={`Defense ${variant.defense}`}
            role="img"
          >
            {variant.defense}
            <span aria-hidden="true">⛨</span>
          </span>
        )}
      </div>
      <output aria-label={`Copies of ${name}`} className={styles.copies}>
        {quantity}×
      </output>
      {children && <div className={styles.controls}>{children}</div>}
    </article>
  );
}
