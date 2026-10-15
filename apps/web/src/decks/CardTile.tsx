import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { TYPE_LABELS } from "../cards/filterCards.ts";
import { variantName } from "./deckRules.ts";
import styles from "./CardTile.module.css";

const GEAR = ["weapon", "equipment"];

// Simple line icons (24×24, stroked) for the stand-in art box and the stats.
const ICONS = {
  sword: "M14.5 3.5 20.5 3.5 20.5 9.5 9 21 3 15Z M5 19l-2 2 M7.5 13.5l3 3",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  burst:
    "M12 2v5 M12 17v5 M2 12h5 M17 12h5 M5 5l3.5 3.5 M15.5 15.5 19 19 M19 5l-3.5 3.5 M8.5 15.5 5 19",
  shield: "M12 3l8 3v6c0 4.6-3.4 8.3-8 9-4.6-.7-8-4.4-8-9V6z",
  gem: "M6 3h12l3 6-9 12L3 9z M3 9h18 M9 3l3 6 3-6",
  helm: "M4 14a8 8 0 0 1 16 0v6h-6v-4h-4v4H4z",
} as const;
type Icon = keyof typeof ICONS;

const TYPE_ICON: Record<string, Icon> = {
  attack_action: "sword",
  action: "bolt",
  instant: "burst",
  attack_reaction: "sword",
  defense_reaction: "shield",
  block: "shield",
  resource: "gem",
  weapon: "sword",
  equipment: "helm",
};

function LineIcon(props: { icon: Icon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[props.icon]} />
    </svg>
  );
}

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
 * A card-shaped stand-in laid out like a printed card, for when there's no image: pitch strip
 * and a cost coin at the top, the name banner, an art box with a type icon, keyword chips
 * where the text box would be, the type line, and power / defense in the bottom corners.
 */
export function CardTile(props: {
  card: CardSummary;
  variant: VariantSummary;
  /** Copies in a deck; no badge when undefined. */
  quantity?: number;
  /** Renders the name as a different link (e.g. open the card database's pop-over). */
  nameLink?: (props: { className: string; children: ReactNode }) => ReactNode;
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
      {props.nameLink ? (
        props.nameLink({ className: styles.name ?? "", children: card.name })
      ) : (
        <Link
          to="/cards/$cardId"
          params={{ cardId: card.id }}
          className={styles.name}
        >
          {card.name}
        </Link>
      )}
      <div className={styles.art} aria-hidden="true">
        <span data-testid="type-icon" data-type={card.type}>
          <LineIcon
            icon={TYPE_ICON[card.type] ?? "bolt"}
            className={styles.typeIcon}
          />
        </span>
        <span className={styles.artLabel}>
          {GEAR.includes(card.type) && card.subtypes.length > 0
            ? card.subtypes.join(" · ")
            : (TYPE_LABELS[card.type] ?? card.type)}
        </span>
      </div>
      <div className={styles.text}>
        {card.keywords.length > 0 ? (
          card.keywords.map((k) => (
            <span key={k} className={styles.chip} data-chip="keyword">
              {k}
            </span>
          ))
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
            <LineIcon icon="sword" className={styles.statIcon} />
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
            <LineIcon icon="shield" className={styles.statIcon} />
          </span>
        )}
      </div>
      {quantity !== undefined && (
        <output aria-label={`Copies of ${name}`} className={styles.copies}>
          {quantity}×
        </output>
      )}
      {children && <div className={styles.controls}>{children}</div>}
    </article>
  );
}
