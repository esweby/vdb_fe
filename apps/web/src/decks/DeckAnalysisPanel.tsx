import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../hooks.ts";
import { rankVariants, type CommunityRow } from "../ranking/rank.ts";
import type { Dimension, ScoreRow } from "../scoring/scoreRepository.ts";
import { useServices } from "../servicesContext.ts";
import { analyseDeck } from "./deckAnalysis.ts";
import type { PitchTargets } from "./deckRepository.ts";
import { PITCH_NAMES, type DeckEntry } from "./deckRules.ts";
import styles from "./Decks.module.css";

interface ScoreData {
  dimensions: Dimension[];
  community: CommunityRow[];
  minRatingCount: number;
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
}

const PITCHES = [1, 2, 3] as const;
const capitalise = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/**
 * Pitch mix against the deck's targets, cost curve and dimension totals.
 * Scores are community scores where there are enough ratings, otherwise the user's own
 * reviewed scores, averaged over both hero sides.
 */
export function DeckAnalysisPanel(props: {
  entries: DeckEntry[];
  pitchTargets: PitchTargets;
  onTargetsChange: (targets: PitchTargets) => void;
}) {
  const { entries, pitchTargets, onTargetsChange } = props;
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [data, setData] = useState<ScoreData | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
      user ? scores.listAllMyScores(user.id) : Promise.resolve(null),
      user ? scores.listMyReviewedCardIds(user.id) : Promise.resolve(null),
    ]).then(([dimensions, community, minRatingCount, myRows, reviewed]) => {
      if (!live) return;
      setData({
        dimensions,
        community,
        minRatingCount,
        mine:
          myRows && reviewed
            ? { rows: myRows, reviewedCardIds: new Set(reviewed) }
            : undefined,
      });
    });
    return () => {
      live = false;
    };
  }, [scores, user]);

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
          priorities: {},
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
          {PITCHES.map((p) => (
            <PitchRow
              key={p}
              pitch={p}
              have={analysis.pitch[p]}
              target={pitchTargets[p]}
              onTarget={(target) => {
                const next = { ...pitchTargets };
                if (target === undefined) delete next[p];
                else next[p] = target;
                onTargetsChange(next);
              }}
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
            <h2>Dimensions</h2>
            <table aria-label="Dimensions">
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Cards</th>
                  <th scope="col">Red</th>
                  <th scope="col">Yellow</th>
                  <th scope="col">Blue</th>
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
                    <td>{d.average}</td>
                    <td>{d.alwaysAvailable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.muted}>
              Cards scoring above 0, by pitch. Weapons and equipment are counted
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
  pitch: 1 | 2 | 3;
  have: number;
  target: number | undefined;
  onTarget: (target: number | undefined) => void;
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
    if (next !== target) onTarget(next);
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
      <label className={styles.target}>
        <span className={styles.visuallyHidden}>{name} target</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Target"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </label>
    </div>
  );
}
