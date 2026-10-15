import { fits, type RoleId } from "@vdb/cards";
import { useState } from "react";
import type { RankedVariant } from "./rank.ts";
import {
  inLane,
  partners,
  sortLane,
  type CoreCard,
  type EngineDef,
} from "./engines.ts";
import styles from "./RankingPage.module.css";

export interface BoardCard extends RankedVariant {
  /** The name with its pitch when the card has several, e.g. "Hocus Pocus (red)". */
  label: string;
  roles: RoleId[];
  type: string;
  imageUrl?: string | null;
}

export interface GearSlot {
  title: string;
  cards: BoardCard[];
}

const LANE_SIZE = 6;

/** Floor to ceiling as a track, overall as a tick, and the value ranked on as a dot. */
export function RangeBar(props: { card: BoardCard }) {
  const { floor, overall, ceiling } = props.card.parts;
  const n = Math.round;
  return (
    <span
      className={styles.range}
      role="img"
      aria-label={`Floor ${n(floor)}, overall ${n(overall)}, ceiling ${n(ceiling)}`}
    >
      <span
        className={styles.track}
        style={{ left: `${floor}%`, width: `${ceiling - floor}%` }}
      />
      <span className={styles.overall} style={{ left: `${overall}%` }} />
      <span className={styles.dot} style={{ left: `${props.card.value}%` }} />
    </span>
  );
}

/** The card image, or a pitch-coloured stand-in when there's none or it fails to load. */
function Art(props: { card: BoardCard }) {
  const [failed, setFailed] = useState(false);
  const { card } = props;
  return card.imageUrl && !failed ? (
    <img
      src={card.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={styles.standIn}>{card.name}</span>
  );
}

export function EngineBoard(props: {
  engines: EngineDef[];
  cards: BoardCard[];
  gear: GearSlot[];
  core: (CoreCard & { variantId: string })[];
  inDeck: Map<string, number>;
  order: "score" | "fits";
  onToggleCore: (card: BoardCard) => void;
  onOpen: (card: BoardCard) => void;
}) {
  const [open, setOpen] = useState(new Set<string>());
  const [focus, setFocus] = useState<RoleId[] | null>(null);
  const quantity = new Map(props.core.map((c) => [c.variantId, c.quantity]));

  const withFits = (cards: BoardCard[]) =>
    sortLane(
      cards
        .map((c) => ({
          card: c,
          value: c.value,
          partners: partners(c.name, c.roles, props.core),
          fits: 0,
        }))
        .map((x) => ({ ...x, fits: x.partners.length })),
      props.order,
    );

  const tile = (x: ReturnType<typeof withFits>[number]) => {
    const c = x.card;
    const q = quantity.get(c.variantId);
    const deckCopies = props.inDeck.get(c.variantId);
    const partner = focus && fits(focus, c.roles);
    return (
      <li
        key={c.variantId}
        aria-label={c.label}
        className={styles.tile}
        data-core={q ? "" : undefined}
        data-partner={partner ? "" : undefined}
        onMouseEnter={() => setFocus(c.roles)}
      >
        <button
          type="button"
          className={styles.art}
          aria-label={`Open ${c.name}`}
          onClick={() => props.onOpen(c)}
          style={{ ["--pitch" as string]: `var(--pitch-${c.pitch ?? 0})` }}
        >
          <Art card={c} />
        </button>
        <span className={styles.badges}>
          {q ? <span className={styles.inCore}>✓ {q}</span> : null}
          {!q && x.fits > 0 && (
            <span
              className={styles.fits}
              title={`Fits with ${x.partners.join(", ")}`}
            >
              fits {x.fits}
            </span>
          )}
          {deckCopies ? (
            <span className={styles.inDeck}>{deckCopies} in deck</span>
          ) : null}
        </span>
        <span className={styles.foot}>
          <span className={styles.value}>{Math.round(c.value)}</span>
          <RangeBar card={c} />
          <button
            type="button"
            className={styles.add}
            data-on={q ? "" : undefined}
            aria-label={
              q
                ? `Remove ${c.label} from your core`
                : `Add ${c.label} to your core`
            }
            onClick={() => props.onToggleCore(c)}
          >
            {q ? "✓" : "+"}
          </button>
        </span>
      </li>
    );
  };

  const lane = (key: string, label: string, cards: BoardCard[]) => {
    const items = withFits(cards);
    const all = open.has(key);
    return (
      <div className={styles.lane}>
        <div className={styles.laneHead}>
          <h3>{label}</h3>
          <span className={styles.count}>{items.length}</span>
          {items.length > LANE_SIZE && (
            <button
              type="button"
              className={styles.more}
              onClick={() => {
                const next = new Set(open);
                if (all) next.delete(key);
                else next.add(key);
                setOpen(next);
              }}
            >
              {all ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className={styles.none}>None ranked yet.</p>
        ) : (
          <ul aria-label={label} className={styles.tiles}>
            {(all ? items : items.slice(0, LANE_SIZE)).map(tile)}
          </ul>
        )}
      </div>
    );
  };

  const other = props.cards.filter((c) =>
    props.engines.every(
      (e) =>
        !inLane(c.roles, e.id, "generator") && !inLane(c.roles, e.id, "payoff"),
    ),
  );

  return (
    <div
      className={styles.board}
      data-focus={focus ? "" : undefined}
      onMouseLeave={() => setFocus(null)}
    >
      {props.engines.map((e) => {
        const gens = props.cards.filter((c) =>
          inLane(c.roles, e.id, "generator"),
        );
        const pays = props.cards.filter((c) => inLane(c.roles, e.id, "payoff"));
        if (gens.length === 0 && pays.length === 0) return null;
        return (
          <section key={e.id} aria-label={e.name} className={styles.engine}>
            <header className={styles.engineHead}>
              <h2>{e.name}</h2>
              <p>{e.note}</p>
            </header>
            {e.payoffs === null ? (
              lane(`${e.id}-g`, e.generators, gens)
            ) : (
              <div className={styles.pair}>
                {lane(`${e.id}-g`, e.generators, gens)}
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
                {lane(`${e.id}-p`, e.payoffs, pays)}
              </div>
            )}
          </section>
        );
      })}
      {other.length > 0 && (
        <section aria-label="Strong on their own" className={styles.engine}>
          <header className={styles.engineHead}>
            <h2>Strong on their own</h2>
            <p>Cards outside the engines: defence, pitch and the rest.</p>
          </header>
          {lane("other", "Strong on their own", other)}
        </section>
      )}
      {props.gear.length > 0 && (
        <section aria-label="Weapons and equipment" className={styles.engine}>
          <header className={styles.engineHead}>
            <h2>Weapons and equipment</h2>
            <p>Always available, so they don't take deck space.</p>
          </header>
          <div className={styles.gear}>
            {props.gear.map((slot) => (
              <div key={slot.title} className={styles.slot}>
                <h3>{slot.title}</h3>
                {slot.cards.slice(0, 3).map((c) => (
                  <div key={c.variantId} className={styles.slotRow}>
                    <button type="button" onClick={() => props.onOpen(c)}>
                      {c.name}
                    </button>
                    <span className={styles.value}>{Math.round(c.value)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
