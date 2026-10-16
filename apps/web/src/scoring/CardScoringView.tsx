import {
  describeAttributeSections,
  hasConditions,
  relevantDimensions,
} from "@vdb/cards";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { selectCanScore } from "../auth/authSlice.ts";
import { TYPE_LABELS } from "../cards/filterCards.ts";
import { pitchName } from "../cards/pitch.ts";
import { useCards } from "../cards/useCards.ts";
import { CardTile } from "../decks/CardTile.tsx";
import { PITCH_NAMES } from "../decks/deckRules.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, LoadError, Loading, Tag } from "../ui/index.ts";
import type { CommunityRow } from "../ranking/rank.ts";
import { CommunityPanel } from "./CommunityPanel.tsx";
import { CardText } from "../cards/CardText.tsx";
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
  // Which card the ratings are loaded for, so focus moves to them once they're there.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const ratings = useRef<HTMLDivElement>(null);

  const [cardFailed, setCardFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setCardFailed(false);
    scores.getCard(cardId).then(
      (c) => live && setCard(c),
      () => live && setCardFailed(true),
    );
    return () => {
      live = false;
    };
  }, [cardId, scores, attempt]);

  const [ratingsFailed, setRatingsFailed] = useState(false);
  const [ratingsAttempt, setRatingsAttempt] = useState(0);
  useEffect(() => {
    if (!user) return;
    let live = true;
    setRatingsFailed(false);
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
        setLoadedFor(cardId);
      },
      () => live && setRatingsFailed(true),
    );
    return () => {
      live = false;
    };
  }, [cardId, scores, user, ratingsAttempt]);

  // Fast scoring in the pop-over: each card opens on its first rating.
  useEffect(() => {
    if (!inPopover || loadedFor !== cardId) return;
    ratings.current
      ?.querySelector<HTMLElement>("input[type=range]:not(:disabled)")
      ?.focus();
  }, [inPopover, loadedFor, cardId]);

  // Ctrl+Enter (Cmd+Enter on a Mac): mark reviewed, or the next card once it is.
  const canReview = !!user && dimensions.length > 0;
  useEffect(() => {
    if (!inPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || reviewing) return;
      e.preventDefault();
      if (reviewedAt) onNextCard?.();
      else if (canReview) setReviewing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inPopover, reviewing, reviewedAt, canReview, onNextCard]);

  // The scoring group's ratings, for anyone (signed in or not). Not essential: on failure the
  // panel just isn't shown.
  const [community, setCommunity] = useState<{
    rows: CommunityRow[];
    dimensions: Dimension[];
    minRatingCount: number;
  } | null>(null);
  useEffect(() => {
    let live = true;
    setCommunity(null);
    Promise.all([
      scores.listCommunityScoresForCard(cardId),
      scores.listDimensions(),
      scores.getMinRatingCount(),
    ]).then(
      ([rows, d, minRatingCount]) =>
        live && setCommunity({ rows, dimensions: d, minRatingCount }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [cardId, scores]);

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

  if (cardFailed && card === undefined)
    return (
      <LoadError what="this card" onRetry={() => setAttempt((n) => n + 1)} />
    );
  if (card === undefined) return <Loading label="Loading the card" />;
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
                  <p key={i}>
                    <CardText text={line} keywords={summary?.keywords} />
                  </p>
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
                      <li key={line}>
                        <CardText text={line} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
          {community && (
            <CommunityPanel
              rows={community.rows}
              dimensions={community.dimensions}
              variantId={chosen?.id}
              minRatingCount={community.minRatingCount}
            />
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
          {user && ratingsFailed && (
            <LoadError
              what="your ratings"
              onRetry={() => setRatingsAttempt((n) => n + 1)}
            />
          )}
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
              <div ref={ratings}>
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
              </div>
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
                <Button
                  disabled={!onNextCard}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  title={SHORTCUT}
                  onClick={() => onNextCard?.()}
                >
                  Next card
                  <kbd className={styles.kbd} aria-hidden="true">
                    {SHORTCUT}
                  </kbd>
                </Button>
              </>
            ) : (
              <>
                <Button disabled={!onNext} onClick={() => onNext?.()}>
                  Skip
                </Button>
                {user && dimensions.length > 0 && (
                  <Button
                    variant="primary"
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                    title={SHORTCUT}
                    onClick={() => setReviewing(true)}
                  >
                    {onNextCard ? "Mark reviewed and next" : "Mark reviewed"}
                    <kbd className={styles.kbd} aria-hidden="true">
                      {SHORTCUT}
                    </kbd>
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

/** The review shortcut as this keyboard shows it. */
const SHORTCUT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘ Enter"
    : "Ctrl+Enter";

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
