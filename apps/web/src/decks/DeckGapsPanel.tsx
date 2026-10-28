// UNVERIFIED: goal support uses existing card attributes, not simulated outcomes.
import { useMemo, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { rankVariants } from "../ranking/rank.ts";
import { formatScore } from "../scoring/scoreFormat.ts";
import { Button } from "../ui/index.ts";
import { variantName, type DeckEntry } from "./deckRules.ts";
import { analyseGoals, GOALS, supportsGoal, type GoalId } from "./goalGaps.ts";
import { useScoreData } from "./useScoreData.ts";
import styles from "./Decks.module.css";

function savedGoals(key: string): GoalId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved)
      ? GOALS.filter((goal) => saved.includes(goal.id)).map((goal) => goal.id)
      : [];
  } catch {
    return [];
  }
}

export function DeckGapsPanel(props: {
  deckId: string;
  entries: DeckEntry[];
  pool: CardSummary[];
  onAdd?: (variantId: string) => void;
}) {
  const { entries } = props;
  const storageKey = `vdb:gap-goals:${props.deckId}`;
  const [selected, setSelected] = useState<GoalId[]>(() =>
    savedGoals(storageKey),
  );
  const [hasRun, setHasRun] = useState(false);
  const data = useScoreData();
  const results = useMemo(
    () => (hasRun ? analyseGoals(entries, selected) : []),
    [entries, selected, hasRun],
  );
  function toggle(id: GoalId) {
    const next = selected.includes(id)
      ? selected.filter((goal) => goal !== id)
      : [...selected, id];
    setSelected(next);
    setHasRun(false);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Analysis still works without browser storage. */
    }
  }
  const poolValues = useMemo(() => {
    if (!data || results.length === 0) return new Map<string, number>();
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
  }, [data, results.length, props.pool]);

  const inDeck = new Set(entries.map((entry) => entry.variant.id));
  return (
    <section aria-label="Gaps" className={styles.gapsTab}>
      <header>
        <h2>Gaps</h2>
        <p className={styles.muted}>
          What do you want this deck to do? Choose the goals to check against
          your main deck and sideboard. Choices are remembered for this deck in
          this browser.
        </p>
      </header>
      <div
        role="group"
        aria-label="Analysis goals"
        className={styles.goalButtons}
      >
        {GOALS.map((goal) => (
          <Button
            key={goal.id}
            aria-pressed={selected.includes(goal.id)}
            variant={selected.includes(goal.id) ? "primary" : "secondary"}
            onClick={() => toggle(goal.id)}
          >
            {goal.label}
          </Button>
        ))}
      </div>
      <Button
        variant="primary"
        disabled={selected.length === 0}
        onClick={() => setHasRun(true)}
      >
        Run analysis
      </Button>
      <p className={styles.muted}>
        Unverified: these checks use recorded card roles and printed values.
        Conditions, draw order and opponent pressure can change how much support
        you get. Copies show available support, not whether it is enough.
      </p>
      {!hasRun ? (
        <p className={styles.muted}>
          Choose your goals, then run the analysis.
        </p>
      ) : (
        <div className={styles.gapCards}>
          {results.map((result) => {
            const { goal } = result;
            const candidates = props.pool
              .flatMap((card) =>
                card.variants
                  .filter(
                    (variant) =>
                      !inDeck.has(variant.id) &&
                      supportsGoal({ card, variant }, goal.id),
                  )
                  .map((variant) => ({ card, variant })),
              )
              .sort(
                (a, b) =>
                  (poolValues.get(b.variant.id) ?? -1) -
                    (poolValues.get(a.variant.id) ?? -1) ||
                  a.card.name.localeCompare(b.card.name) ||
                  (a.variant.pitch ?? 0) - (b.variant.pitch ?? 0),
              )
              .slice(0, 3);
            const title =
              result.status === "present"
                ? "Main-deck support to review"
                : result.status === "sideboard"
                  ? "Available in your sideboard"
                  : "No recorded support in this deck or sideboard";
            return (
              <article
                key={goal.id}
                aria-label={goal.label}
                className={styles.gapCard}
              >
                <h3>{goal.label}</h3>
                <h4>{title}</h4>
                <p>{`Main deck: ${result.mainCopies} copies. Sideboard: ${result.sideboardCopies} copies.`}</p>
                {goal.id === "damage" && (
                  <p>
                    Counts cards with positive printed power. This does not
                    measure damage dealt, arcane damage or the effect of adding
                    a card.
                  </p>
                )}
                {goal.id === "defence" && (
                  <p>
                    Counts cards with positive printed defence. This does not
                    measure how much damage the deck can prevent in a game.
                  </p>
                )}
                {result.main.length > 0 && (
                  <>
                    <h4>Main-deck evidence</h4>
                    <ul>
                      {result.main.map((entry) => (
                        <li key={entry.variant.id}>
                          {entry.quantity} ×{" "}
                          {variantName(entry.card, entry.variant)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {result.sideboard.length > 0 && (
                  <>
                    <h4>Sideboard options</h4>
                    <ul>
                      {result.sideboard.map((entry) => (
                        <li key={entry.variant.id}>
                          {entry.quantity} ×{" "}
                          {variantName(entry.card, entry.variant)}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Bringing these in changes your deck. Check what you would
                      take out and which other goals those cards support.
                    </p>
                  </>
                )}
                <h4>Cards to consider</h4>
                <p className={styles.muted}>
                  Matches to this goal, ordered by available ratings. These are
                  options to review, not proven improvements.
                </p>
                {candidates.length === 0 ? (
                  <p className={styles.muted}>
                    No additional matching cards in the available pool.
                  </p>
                ) : (
                  <ul className={styles.fillerTiles}>
                    {candidates.map(({ card, variant }) => {
                      const label = variantName(card, variant);
                      const value = poolValues.get(variant.id);
                      return (
                        <li key={variant.id}>
                          {variant.imageUrl ? (
                            <img src={variant.imageUrl} alt="" loading="lazy" />
                          ) : (
                            <span className={styles.fillerStandIn}>
                              {label}
                            </span>
                          )}
                          <span className={styles.fillerName}>{label}</span>
                          {value !== undefined && (
                            <span className={styles.muted}>
                              {formatScore(value)}
                            </span>
                          )}
                          {props.onAdd && (
                            <Button
                              aria-label={`Add ${label}`}
                              onClick={() => props.onAdd!(variant.id)}
                            >
                              Add
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
