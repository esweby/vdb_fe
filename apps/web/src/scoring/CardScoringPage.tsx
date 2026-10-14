import { describeAttributes, relevantDimensions } from "@vdb/cards";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { selectCanScore } from "../auth/authSlice.ts";
import { classOf, TYPE_LABELS } from "../cards/filterCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, Tag } from "../ui/index.ts";
import { ReviewDialog } from "./ReviewDialog.tsx";
import type {
  CardDetail,
  Dimension,
  ScoreKey,
  ScoreRow,
} from "./scoreRepository.ts";
import { ScoreEditor } from "./ScoreEditor.tsx";
import { spreadWarnings } from "./spread.ts";
import styles from "./CardScoringPage.module.css";

const route = getRouteApi("/cards/$cardId");

/** Describes only a variant's own overrides (generated keywords are card-level). */
const NO_GENERATED = {
  hasGoAgain: false,
  hasBloodDebt: false,
  hasUsurp: false,
  hasRuneGate: false,
  isGateTarget: false,
  canAttack: false,
  groups: [],
  specialization: null,
};
const sameKey = (a: ScoreKey, b: ScoreKey) =>
  a.variantId === b.variantId &&
  a.side === b.side &&
  a.dimensionId === b.dimensionId;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function CardScoringPage() {
  const { cardId } = route.useParams();
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const canScore = useAppSelector(selectCanScore);
  const [card, setCard] = useState<CardDetail | null | undefined>(undefined);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidesTogether, setSidesTogether] = useState(true);
  const [showAllDimensions, setShowAllDimensions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    scores.getCard(cardId).then(
      (c) => live && setCard(c),
      (e) => live && setError(String(e.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [cardId, scores]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    Promise.all([
      scores.listDimensions(),
      scores.listMyScores(user.id, cardId),
      scores.getMyReview(user.id, cardId),
      scores.getPreferences(user.id),
    ]).then(
      ([d, r, reviewed, preferences]) => {
        if (!live) return;
        setSidesTogether(preferences.scoreSidesTogether ?? true);
        setDimensions(d);
        setRows(r);
        setReviewedAt(reviewed);
      },
      (e) => live && setError(String(e.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [cardId, scores, user]);

  async function onSet(key: ScoreKey, score: number | null) {
    const previous = rows;
    setRows((rs) => [
      ...rs.filter((r) => !sameKey(r, key)),
      ...(score === null ? [] : [{ ...key, score }]),
    ]);
    try {
      if (score === null) await scores.clearScore(cardId, key);
      else await scores.saveScore(cardId, key, score);
    } catch (e) {
      setRows(previous);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function confirmReview() {
    setBusy(true);
    try {
      setReviewedAt(await scores.markReviewed(cardId));
      setReviewing(false);
      // Scorers' reviews count toward community scores: recalculate now.
      // The daily job catches anything this misses.
      if (canScore) await scores.runCommunityJob().catch(() => {});
    } catch (e) {
      setError(
        `Couldn't mark reviewed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (card === undefined) return <p>Loading…</p>;
  if (card === null) {
    return (
      <>
        <h1>Card not found</h1>
        <Link to="/cards">Back to cards</Link>
      </>
    );
  }

  const relevant = new Set(
    relevantDimensions(
      dimensions.map((d) => d.key),
      card.attributes,
      card.variants.map((v) => v.attributes),
    ),
  );
  const shownDimensions = showAllDimensions
    ? dimensions
    : dimensions.filter((d) => relevant.has(d.key));
  const hidden = dimensions.length - shownDimensions.length;
  const spreadKeys = new Set(["floor", "ceiling"]);
  const askingSpread = shownDimensions.some((d) => spreadKeys.has(d.key));
  const warnings = spreadWarnings(rows, dimensions, card.variants);

  /** Clears floor and ceiling everywhere, so they resolve as overall. */
  async function sameAsOverall() {
    const ids = new Set(
      dimensions.filter((d) => spreadKeys.has(d.key)).map((d) => d.id),
    );
    const toClear = [...rows]
      .filter((r) => ids.has(r.dimensionId))
      .sort((a, b) => a.dimensionId - b.dimensionId);
    for (const r of toClear) await onSet(r, null);
  }

  const lines = [
    ...describeAttributes(card.attributes),
    ...card.variants.flatMap((v) =>
      describeAttributes({ ...NO_GENERATED, ...v.attributes }).map(
        (line) => `Pitch ${v.pitch ?? "–"}: ${line}`,
      ),
    ),
  ];
  return (
    <>
      <Link to="/cards">← Cards</Link>
      <h1>{card.name}</h1>
      <p className={styles.meta}>
        {TYPE_LABELS[card.type] ?? card.type} · {classOf(card)}{" "}
        <Tag tone={card.attributesVerified ? "accent" : "neutral"}>
          {card.attributesVerified ? "Verified" : "Unverified"}
        </Tag>
      </p>

      <section className={styles.text}>
        {card.text ? (
          <p>{card.text}</p>
        ) : (
          card.variants.map((v) => (
            <p key={v.id}>
              <strong>Pitch {v.pitch ?? "–"}:</strong> {v.text}
            </p>
          ))
        )}
      </section>

      <ul className={styles.stats}>
        {card.variants.map((v) => {
          const stats = [
            v.cost !== null ? `cost ${v.cost}` : null,
            v.power !== null ? `power ${v.power}` : null,
            v.defense !== null ? `defense ${v.defense}` : null,
          ].filter(Boolean);
          if (stats.length === 0) return null;
          const prefix = v.pitch !== null ? `Pitch ${v.pitch}: ` : "";
          return <li key={v.id}>{prefix + stats.join(" · ")}</li>;
        })}
      </ul>

      {lines.length > 0 && (
        <section>
          <h2>What it does</h2>
          <ul>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert">{error}</p>}

      <section>
        <h2>Your scores</h2>
        {!user && <Link to="/sign-in">Sign in to score this card</Link>}
        {user && dimensions.length > 0 && (
          <>
            <div className={styles.review}>
              {reviewedAt ? (
                <Tag tone="accent">Reviewed {formatDate(reviewedAt)}</Tag>
              ) : (
                <Button variant="primary" onClick={() => setReviewing(true)}>
                  Mark reviewed
                </Button>
              )}
            </div>
            <ReviewDialog
              open={reviewing}
              onClose={() => setReviewing(false)}
              onConfirm={() => void confirmReview()}
              onFix={(dimensionId, score) =>
                void onSet({ variantId: null, side: null, dimensionId }, score)
              }
              rows={rows}
              dimensions={shownDimensions}
              variants={card.variants}
              busy={busy}
            />
            {(hidden > 0 || showAllDimensions) && (
              <label className={styles.showAll}>
                <input
                  type="checkbox"
                  checked={showAllDimensions}
                  onChange={(e) => setShowAllDimensions(e.target.checked)}
                />
                Rate floor and ceiling too
              </label>
            )}
            {askingSpread && (
              <p className={styles.meta}>
                Floor: none of its conditions are met, and it's blocked if it
                has an on-hit. Ceiling: all of them are met and it hits.
                Overall: a typical game on this side. Leave floor and ceiling
                blank if they're the same as overall.{" "}
                <Button variant="ghost" onClick={() => void sameAsOverall()}>
                  Floor and ceiling same as overall
                </Button>
              </p>
            )}
            {warnings.length > 0 && (
              <ul role="status" className={styles.warnings}>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <ScoreEditor
              sidesTogetherByDefault={sidesTogether}
              dimensions={shownDimensions}
              variants={card.variants}
              rows={rows}
              onSet={(key, score) => void onSet(key, score)}
            />
          </>
        )}
      </section>
    </>
  );
}
