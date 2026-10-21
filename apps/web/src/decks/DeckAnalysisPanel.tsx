import { useEffect, useMemo, useState } from "react";
import { useScoreData } from "./useScoreData.ts";
import { formatScore } from "../scoring/scoreFormat.ts";
import { rankVariants } from "../ranking/rank.ts";
import { pitchesShown } from "../cards/pitch.ts";
import { analyseDeck, type PitchCounts } from "./deckAnalysis.ts";
import type { PitchTargets } from "./deckRepository.ts";
import { PITCH_NAMES, type DeckEntry } from "./deckRules.ts";
import styles from "./Decks.module.css";

const capitalise = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * Pitch mix against the deck's targets, cost curve and dimension totals.
 * Scores are community scores where there are enough ratings, otherwise the user's own
 * reviewed scores, averaged over both hero sides.
 */
export function DeckAnalysisPanel(props: {
  entries: DeckEntry[];
  pitchTargets: PitchTargets;
  /** Without it (someone else's deck) the targets show but can't be changed. */
  onTargetsChange?: (targets: PitchTargets) => void;
}) {
  const { entries, pitchTargets, onTargetsChange } = props;
  const data = useScoreData();

  const analysis = useMemo(() => {
    const dimensions = data?.dimensions ?? [];
    const scored = data
      ? rankVariants({
          variants: entries.map((e) => ({
            cardId: e.card.id,
            variantId: e.variant.id,
            name: e.card.name,
            pitch: e.variant.pitch,
          })),
          dimensions,
          community: data.community,
          mine: data.mine,
          risk: 0,
          sourceBlend: 100,
          sideFocus: 50,
          minRatingCount: data.minRatingCount,
        })
      : [];
    return analyseDeck({
      entries,
      dimensions,
      scores: new Map(scored.map((r) => [r.variantId, r.parts])),
    });
  }, [entries, data]);

  const o = analysis.overview;
  const percent = (n: number) =>
    o.cards === 0 ? "0%" : `${Math.round((n / o.cards) * 100)}%`;
  const stats: { label: string; value: string; detail: string }[] = [
    {
      label: "Average cost",
      value: o.averageCost.toFixed(2),
      detail: "Per card with a cost",
    },
    {
      label: "Average pitch",
      value: o.averagePitch.toFixed(2),
      detail: "Per card with a pitch",
    },
    {
      label: "Resource surplus",
      value: `${o.resourceSurplus >= 0 ? "+" : ""}${o.resourceSurplus.toFixed(2)}`,
      detail: "Pitch minus cost, per card",
    },
    {
      label: "Go again",
      value: percent(o.goAgain),
      detail: `${o.goAgain} cards`,
    },
    {
      label: "Attacks",
      value: percent(o.attacks),
      detail: `${o.attacks} cards`,
    },
  ];
  const shown = pitchesShown(analysis.pitch) as (keyof PitchCounts)[];

  return (
    <>
      <dl className={styles.overview}>
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>
              <strong>{s.value}</strong>
              <span className={styles.muted}>{s.detail}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.analysis}>
        <section aria-label="Pitch" className={styles.pitchMix}>
          <h2>Pitch</h2>
          {shown.map((p) => (
            <PitchRow
              key={p}
              pitch={p}
              have={analysis.pitch[p]}
              target={p === 4 ? undefined : pitchTargets[p]}
              onTarget={
                // Purple has no target: it's one Legendary card, added by hand.
                p === 4 || !onTargetsChange
                  ? undefined
                  : (target) => {
                      const next = { ...pitchTargets };
                      if (target === undefined) delete next[p];
                      else next[p] = target;
                      onTargetsChange(next);
                    }
              }
            />
          ))}
          <h2 className={styles.subheading}>Cost</h2>
          {Object.entries(analysis.costCurve).map(([cost, n]) => (
            <div key={cost} className={styles.curveRow}>
              <span>{cost}</span>
              <span className={styles.bar} aria-hidden="true">
                <span
                  style={{
                    width: o.cards ? `${(n / o.cards) * 100}%` : 0,
                    background: "var(--accent)",
                  }}
                />
              </span>
              <span className={styles.curveCount}>
                {n} <span className={styles.muted}>{percent(n)}</span>
              </span>
            </div>
          ))}
        </section>

        {data && data.dimensions.length > 0 && (
          <section className={styles.dimensions}>
            <h2>Ratings</h2>
            <table aria-label="Ratings">
              <thead>
                <tr>
                  <th scope="col">Rating</th>
                  <th scope="col">Cards</th>
                  <th scope="col">Red</th>
                  <th scope="col">Yellow</th>
                  <th scope="col">Blue</th>
                  {shown.includes(4) && <th scope="col">Purple</th>}
                  <th scope="col">Average</th>
                  <th scope="col">Always available</th>
                </tr>
              </thead>
              <tbody>
                {analysis.dimensions.map((d) => (
                  <tr key={d.key}>
                    <th scope="row">{d.label}</th>
                    <td>{d.cards}</td>
                    <td>{d.byPitch[1]}</td>
                    <td>{d.byPitch[2]}</td>
                    <td>{d.byPitch[3]}</td>
                    {shown.includes(4) && <td>{d.byPitch[4]}</td>}
                    <td>{formatScore(d.average)}</td>
                    <td>{d.alwaysAvailable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.muted}>
              Deck cards rated above 0, by pitch, with their average rating. A
              stopgap until roles replace it. Weapons and equipment are counted
              as always available.
              {analysis.unscored > 0 &&
                ` ${analysis.unscored} deck ${analysis.unscored === 1 ? "card has" : "cards have"} no scores yet.`}
            </p>
          </section>
        )}
      </div>
    </>
  );
}

function PitchRow(props: {
  pitch: keyof PitchCounts;
  have: number;
  target: number | undefined;
  onTarget?: (target: number | undefined) => void;
}) {
  const { pitch, have, target, onTarget } = props;
  const name = capitalise(PITCH_NAMES[pitch]!);
  const [draft, setDraft] = useState(
    target === undefined ? "" : String(target),
  );
  useEffect(() => {
    setDraft(target === undefined ? "" : String(target));
  }, [target]);

  function commit() {
    const n = draft.trim() === "" ? undefined : Number(draft);
    const next =
      n === undefined || !Number.isFinite(n) || n < 0
        ? undefined
        : Math.round(n);
    if (next !== target) onTarget?.(next);
    else setDraft(target === undefined ? "" : String(target));
  }

  const ratio = target ? Math.min(1, have / target) : 0;
  return (
    <div className={styles.pitchRow}>
      <span
        className={`${styles.pip} ${styles[`pitch${pitch}`]}`}
        aria-hidden="true"
      />
      <span className={styles.pitchText}>
        {name} {have}
        {target !== undefined ? ` / ${target}` : ""}
      </span>
      <span
        className={`${styles.bar} ${styles[`pitch${pitch}`]}`}
        aria-hidden="true"
      >
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
      {onTarget && (
        <label className={styles.target}>
          <span className={styles.visuallyHidden}>{name} target</span>
          <input
            type="number"
            min={0}
            max={80}
            inputMode="numeric"
            placeholder="Target"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
        </label>
      )}
    </div>
  );
}
