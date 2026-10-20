import { deriveSynergies, SYNERGY_RULES } from "@vdb/cards";
import { useEffect, useMemo, useState } from "react";
import { selectCanScore } from "../auth/authSlice.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button } from "../ui/index.ts";
import { cardScores } from "./discover.ts";
import { nudgeCandidates, pickNudge } from "./nudge.ts";
import styles from "./SynergyNudge.module.css";
import { feedbackRows, pairKey } from "./synergyQueue.ts";
import type { FeedbackRow } from "./synergyRepository.ts";

const DESCRIPTIONS = new Map(SYNERGY_RULES.map((r) => [r.id, r.description]));

/**
 * The occasional synergy question (the maintainer, 20 Oct 2026): one proposed link, picked from
 * the most preferred (see nudge.ts), for scorers to answer in a click. With `focus`, only links
 * touching that card. Renders nothing when there's nothing to ask.
 */
export function SynergyNudge(props: { focus?: string }) {
  const { synergy, scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const canScore = useAppSelector(selectCanScore);
  const cards = useCards();
  const [loaded, setLoaded] = useState<{
    weights: Record<string, number>;
    answered: Set<string>;
    ratings: Map<string, number>;
  } | null>(null);
  // Answered or passed over here, so the next pick is a different link.
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !canScore) return;
    let live = true;
    Promise.all([
      synergy.listRuleWeights(),
      synergy.listMyFeedback(user.id),
      // Ratings only order the questions, so they're optional.
      Promise.all([
        scores.listDimensions(),
        scores.listCommunityScores(),
        scores.getMinRatingCount(),
      ]).then(
        ([dimensions, rows, min]) => {
          const overall = dimensions.find((d) => d.key === "overall");
          return overall ? cardScores(rows, overall.id, min) : new Map();
        },
        () => new Map<string, number>(),
      ),
    ]).then(
      ([weights, mine, ratings]) =>
        live &&
        setLoaded({
          weights,
          answered: new Set(mine.map((f) => pairKey(f.fromCardId, f.toCardId))),
          ratings,
        }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [synergy, scores, user, canScore]);

  const candidates = useMemo(() => {
    if (!loaded || cards.status !== "loaded") return [];
    const edges = deriveSynergies(
      cards.items.map((c) => ({
        ...c,
        variantAttributes: c.variants.map((v) => v.attributes),
      })),
      loaded.weights,
    );
    return nudgeCandidates(
      edges,
      new Map(cards.items.map((c) => [c.id, c])),
      loaded.answered,
      loaded.ratings,
      props.focus,
    );
  }, [loaded, cards.status, cards.items, props.focus]);

  const edge = useMemo(
    () =>
      pickNudge(candidates.filter((e) => !asked.has(pairKey(e.from, e.to)))),
    [candidates, asked],
  );

  if (!user || !canScore || hidden || !edge) return null;
  const name = (id: string) => cards.items.find((c) => c.id === id)?.name ?? id;
  const reasons = [
    ...new Set(edge.reasons.map((r) => DESCRIPTIONS.get(r) ?? r)),
  ];

  async function answer(verdict: FeedbackRow["verdict"] | "skip") {
    if (!user || !edge) return;
    setAsked((s) => new Set(s).add(pairKey(edge.from, edge.to)));
    if (verdict === "skip") return;
    try {
      await synergy.saveFeedback(user.id, feedbackRows(edge, verdict, null));
      setError(null);
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <aside aria-label="Quick question" className={styles.nudge}>
      <header className={styles.head}>
        <span className={styles.label}>Quick question</span>
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss"
          onClick={() => setHidden(true)}
        >
          ×
        </button>
      </header>
      <p className={styles.question}>
        Does <strong>{name(edge.from)}</strong> help{" "}
        <strong>{name(edge.to)}</strong>?
      </p>
      <ul className={styles.reasons}>
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => void answer("confirm")}>
          Yes
        </Button>
        <Button onClick={() => void answer("reject")}>No</Button>
        <Button variant="ghost" onClick={() => void answer("skip")}>
          Not sure
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </aside>
  );
}
