// Gaps (README "Deck analysis", phase two step 3), on their own tab with each gap a card (the
// maintainer, 19 Oct 2026): a kind of maker the deck relies on that's missing from a pitch it
// plays, and the best-rated cards in the pool that would fill it.
import { useMemo } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { rankVariants } from "../ranking/rank.ts";
import { formatScore } from "../scoring/scoreFormat.ts";
import { Button } from "../ui/index.ts";
import { PITCH_NAMES, variantName, type DeckEntry } from "./deckRules.ts";
import { fillersFor, findGaps } from "./gaps.ts";
import { useScoreData } from "./useScoreData.ts";
import styles from "./Decks.module.css";

const capitalise = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function DeckGapsPanel(props: {
  entries: DeckEntry[];
  /** Every card, for what would fill a gap. */
  pool: CardSummary[];
  /** Adds one copy of a card; without it (someone else's deck) fillers can't be added. */
  onAdd?: (variantId: string) => void;
}) {
  const { entries } = props;
  const data = useScoreData();
  const gaps = useMemo(() => findGaps(entries), [entries]);
  const poolValues = useMemo(() => {
    if (!data || gaps.length === 0) return new Map<string, number>();
    return new Map(
      rankVariants({
        variants: props.pool.flatMap((c) =>
          c.variants.map((v) => ({
            cardId: c.id,
            variantId: v.id,
            name: c.name,
            pitch: v.pitch,
          })),
        ),
        dimensions: data.dimensions,
        community: data.community,
        mine: data.mine,
        risk: 0,
        sourceBlend: 100,
        sideFocus: 50,
        minRatingCount: data.minRatingCount,
      }).map((r) => [r.variantId, r.value]),
    );
  }, [data, gaps.length, props.pool]);
  const inDeck = new Set(entries.map((e) => e.variant.id));

  return (
    <section aria-label="Gaps" className={styles.gapsTab}>
      <header>
        <h2>Gaps</h2>
        <p className={styles.muted}>
          A gap is a kind of maker your deck relies on (3 or more copies)
          missing from a pitch you play (5 or more cards). Unverified: a first
          pass to tune.
        </p>
      </header>
      {gaps.length === 0 ? (
        <p className={styles.muted}>
          No gaps: every pitch you play has the makers your deck relies on.
        </p>
      ) : (
        <div className={styles.gapCards}>
          {gaps.map((g) => {
            const pitch = PITCH_NAMES[g.pitch]!;
            const title = `No ${pitch} ${g.role.label}`;
            const fillers = fillersFor(g, props.pool, poolValues, inDeck);
            return (
              <article
                key={`${g.role.id}-${g.pitch}`}
                aria-label={title}
                className={`${styles.gapCard} ${styles[`pitch${g.pitch}Edge`] ?? ""}`}
              >
                <h3>{title}</h3>
                <p>
                  {`You play ${g.pitchCopies} ${pitch} cards and ${g.roleCopies} ${g.role.label}.`}
                </p>
                {fillers.length === 0 ? (
                  <p className={styles.muted}>
                    Nothing in the card pool fills this yet.
                  </p>
                ) : (
                  <>
                    <h4>{`${capitalise(pitch)} cards that would fill it`}</h4>
                    <ul className={styles.fillerTiles}>
                      {fillers.map((f) => {
                        const label = variantName(f.card, f.variant);
                        return (
                          <li key={f.variant.id}>
                            {f.variant.imageUrl ? (
                              <img
                                src={f.variant.imageUrl}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className={styles.fillerStandIn}>
                                {label}
                              </span>
                            )}
                            <span className={styles.fillerName}>{label}</span>
                            {f.value !== undefined && (
                              <span className={styles.muted}>
                                {formatScore(f.value)}
                              </span>
                            )}
                            {props.onAdd && (
                              <Button
                                aria-label={`Add ${label}`}
                                onClick={() => props.onAdd!(f.variant.id)}
                              >
                                Add
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
