import {
  describeAttributeSections,
  hasConditions,
  relevantDimensions,
} from "@vdb/cards";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { selectCanScore } from "../auth/authSlice.ts";
import { TYPE_LABELS } from "../cards/filterCards.ts";
import { pitchName } from "../cards/pitch.ts";
import { useCards } from "../cards/useCards.ts";
import { CardTile } from "../decks/CardTile.tsx";
import { PITCH_NAMES } from "../decks/deckRules.ts";
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

const PITCH_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(PITCH_NAMES).map(([p, name]) => [
    p,
    name[0]!.toUpperCase() + name.slice(1),
  ]),
);

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

/**
 * A card with its details and scoring, side by side: the card on the left, details in the
 * middle, scores on the right (stacked on narrow screens). Used by the card page and the
 * card database's pop-over.
 */
export function CardScoringView(props: {
  cardId: string;
  /** The pitch to show first, e.g. the tile that was clicked. */
  initialVariantId?: string;
  /** The card page shows the name as its heading; the pop-over has it in its title bar. */
  showTitle?: boolean;
  /** In the card database's pop-over: a sticky footer with Skip and "Mark reviewed and next". */
  inPopover?: boolean;
  /** The next stop in the results (Skip), if there is one. */
  onNext?: () => void;
  /** The next different card, for after a review (defaults to onNext). */
  onNextCard?: () => void;
  /** Tells the pop-over which pitch is being looked at. */
  onChooseVariant?: (variantId: string) => void;
}) {
  const { cardId, showTitle, inPopover, onNext } = props;
  const onNextCard = props.onNextCard ?? onNext;
  const { items } = useCards();
  const summary = items.find((c) => c.id === cardId);
  const [variantId, setVariantId] = useState(props.initialVariantId);
  useEffect(() => {
    setVariantId(props.initialVariantId);
  }, [cardId, props.initialVariantId]);
  // "Rate floor and ceiling anyway" on a card without recorded conditions, per card.
  const [rateAnyway, setRateAnyway] = useState(false);
  useEffect(() => {
    setRateAnyway(false);
  }, [cardId]);
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
      // In the pop-over, reviewing moves on to the next card.
      if (inPopover) onNextCard?.();
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
        {showTitle ? <h1>Card not found</h1> : <p>Card not found.</p>}
        <Link to="/cards">Back to cards</Link>
      </>
    );
  }
  const shownVariant =
    summary?.variants.find((v) => v.id === variantId) ?? summary?.variants[0];
  // The middle column describes the pitch being looked at, not every pitch.
  const chosen =
    card.variants.find((v) => v.id === (shownVariant?.id ?? variantId)) ??
    card.variants[0];

  const relevant = new Set(
    relevantDimensions(
      dimensions.map((d) => d.key),
      card.attributes,
      card.variants.map((v) => v.attributes),
    ),
  );
  // Every card shows floor, ceiling and overall; ones that don't apply are greyed out,
  // unless the scorer chooses to rate them anyway or they already have scores (a saved
  // score is never hidden or locked).
  const notRelevantIds = dimensions
    .filter((d) => !relevant.has(d.key))
    .map((d) => d.id);
  const unlocked =
    rateAnyway || rows.some((r) => notRelevantIds.includes(r.dimensionId));
  const lockedIds = unlocked ? [] : notRelevantIds;
  const rateable = dimensions.filter((d) => !lockedIds.includes(d.id));
  const ratedCount = rateable.filter((d) =>
    rows.some((r) => r.dimensionId === d.id),
  ).length;
  const spreadKeys = new Set(["floor", "ceiling"]);
  const askingSpread = dimensions.some(
    (d) => spreadKeys.has(d.key) && !lockedIds.includes(d.id),
  );
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

  // The chosen pitch's attributes: the card's, with that pitch's overrides replacing them.
  const sections = describeAttributeSections({
    ...card.attributes,
    ...(chosen?.attributes ?? {}),
  });
  return (
    <>
      {showTitle && <h1>{card.name}</h1>}
      {!inPopover && (
        <p className={styles.meta}>
          <Tag tone={card.attributesVerified ? "accent" : "neutral"}>
            {card.attributesVerified ? "Verified" : "Unverified"}
          </Tag>
        </p>
      )}
      {error && <p role="alert">{error}</p>}

      <div className={styles.columns}>
        <section aria-label="Card" className={styles.cardColumn}>
          {summary && shownVariant && (
            <div className={styles.tile}>
              <CardTile card={summary} variant={shownVariant} enlargeable />
            </div>
          )}
          {card.variants.length > 1 && (
            <div className={styles.pitches} role="group" aria-label="Pitch">
              {card.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={styles[`pitch${v.pitch ?? "none"}`]}
                  aria-pressed={v.id === chosen?.id}
                  title={
                    v.pitch === null
                      ? "No pitch"
                      : `Show the ${PITCH_LABELS[v.pitch]?.toLowerCase() ?? `pitch ${v.pitch}`} version`
                  }
                  onClick={() => {
                    setVariantId(v.id);
                    props.onChooseVariant?.(v.id);
                  }}
                >
                  <span className={styles.pitchDot} aria-hidden="true" />
                  {v.pitch === null
                    ? "No pitch"
                    : (PITCH_LABELS[v.pitch] ?? `Pitch ${v.pitch}`)}
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Details" className={styles.details}>
          {/* Loosely follows the printed card: pitch and cost, text box, type line, then
              power and defense in the bottom corners. */}
          <div className={styles.face}>
            <div className={styles.faceTop}>
              <span className={styles.facePitch}>
                {pitchName(chosen?.pitch ?? null)}
              </span>
              {chosen?.cost != null && (
                <span
                  className={styles.coin}
                  role="img"
                  aria-label={`Cost ${chosen.cost}`}
                >
                  {chosen.cost}
                </span>
              )}
            </div>
            <div className={styles.textBox}>
              {(card.text ?? chosen?.text ?? "")
                .split(/\n+/)
                .filter((line) => line.trim())
                .map((line, i) => (
                  <p key={i}>{withKeywords(line, summary?.keywords ?? [])}</p>
                ))}
            </div>
            <div className={styles.typeLine}>{typeLineOf(card, summary)}</div>
            <div className={styles.faceBottom}>
              {chosen?.power != null ? (
                <span role="img" aria-label={`Power ${chosen.power}`}>
                  <span aria-hidden="true">⚔ </span>
                  {chosen.power}
                </span>
              ) : (
                <span />
              )}
              {chosen?.defense != null && (
                <span role="img" aria-label={`Defense ${chosen.defense}`}>
                  {chosen.defense}
                  <span aria-hidden="true"> ⛨</span>
                </span>
              )}
            </div>
          </div>

          {sections.length > 0 && (
            <>
              <h2>What it does</h2>
              {sections.map((section) => (
                <div key={section.heading} className={styles.section}>
                  <h3>{section.heading}</h3>
                  <ul>
                    {section.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </section>

        <section aria-label="Scores" className={styles.scores}>
          <div className={styles.scoresHeading}>
            <h2>Your ratings</h2>
            {user && dimensions.length > 0 && (
              <span className={styles.progress}>
                {ratedCount} of {rateable.length} rated
              </span>
            )}
          </div>
          {!user && <Link to="/sign-in">Sign in to score this card</Link>}
          {user && dimensions.length > 0 && (
            <>
              {!inPopover && (
                <div className={styles.review}>
                  {reviewedAt ? (
                    <Tag tone="accent">Reviewed {formatDate(reviewedAt)}</Tag>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => setReviewing(true)}
                    >
                      Mark reviewed
                    </Button>
                  )}
                </div>
              )}
              <ReviewDialog
                open={reviewing}
                onClose={() => setReviewing(false)}
                onConfirm={() => void confirmReview()}
                onFix={(dimensionId, score) =>
                  void onSet(
                    { variantId: null, side: null, dimensionId },
                    score,
                  )
                }
                rows={rows}
                dimensions={dimensions}
                variants={card.variants}
                hasConditions={hasConditions(
                  card.attributes,
                  card.variants.map((v) => v.attributes),
                )}
                busy={busy}
              />
              <details className={styles.help}>
                <summary>
                  <span aria-hidden="true">ⓘ</span>
                  <span>About these ratings</span>
                </summary>
                <p>
                  Floor: none of its conditions are met, and it's blocked if it
                  has an on-hit. Ceiling: all of them are met and it hits.
                  Overall: a typical game on this side. Leave floor and ceiling
                  blank if they're the same as overall.
                </p>
              </details>
              {warnings.length > 0 && (
                <ul role="status" className={styles.warnings}>
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {lockedIds.length > 0 && (
                <p className={styles.meta}>
                  Floor and ceiling are greyed out: this card has no recorded
                  conditions.{" "}
                  <Button variant="ghost" onClick={() => setRateAnyway(true)}>
                    Rate floor and ceiling anyway
                  </Button>
                </p>
              )}
              <ScoreEditor
                chosenVariantId={chosen?.id}
                sidesTogetherByDefault={sidesTogether}
                dimensions={dimensions}
                locked={{
                  ids: lockedIds,
                  reason: "Same as overall: this card has no conditions.",
                }}
                variants={card.variants}
                rows={rows}
                onSet={(key, score) => void onSet(key, score)}
              />
              {askingSpread && (
                <Button
                  variant="ghost"
                  className={styles.sameAsOverall}
                  onClick={() => void sameAsOverall()}
                >
                  Floor and ceiling same as overall
                </Button>
              )}
            </>
          )}
        </section>
      </div>

      {inPopover && (
        <div className={styles.footer}>
          <span className={styles.footerActions}>
            {reviewedAt ? (
              <>
                <Tag tone="accent">Reviewed {formatDate(reviewedAt)}</Tag>
                <Button disabled={!onNextCard} onClick={() => onNextCard?.()}>
                  Next card
                </Button>
              </>
            ) : (
              <>
                <Button disabled={!onNext} onClick={() => onNext?.()}>
                  Skip
                </Button>
                {user && dimensions.length > 0 && (
                  <Button variant="primary" onClick={() => setReviewing(true)}>
                    {onNextCard ? "Mark reviewed and next" : "Mark reviewed"}
                  </Button>
                )}
              </>
            )}
          </span>
        </div>
      )}
    </>
  );
}

/** "Shadow Runeblade Action – Attack", like the printed type line. */
function typeLineOf(
  card: CardDetail,
  summary: { subtypes: string[] } | undefined,
): string {
  const base = [
    ...card.talents,
    ...card.classes,
    TYPE_LABELS[card.type] ?? card.type,
  ].join(" ");
  const subtypes = summary?.subtypes ?? [];
  return subtypes.length > 0 ? `${base} – ${subtypes.join(" ")}` : base;
}

/** The card text with its keywords in bold, as they're printed. */
function withKeywords(text: string, keywords: string[]): ReactNode {
  if (keywords.length === 0 || !text) return text;
  const escaped = [...keywords]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  return text
    .split(pattern)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}
