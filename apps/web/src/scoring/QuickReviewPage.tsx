import { hasConditions } from "@vdb/cards";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { CardText } from "../cards/CardText.tsx";
import {
  isClassCard,
  newestFirst,
  searchAndSort,
} from "../cards/filterCards.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { LoadError, Loading } from "../ui/index.ts";
import type { Dimension, ScoreKey } from "./scoreRepository.ts";
import styles from "./QuickReviewPage.module.css";

type Step = "overall" | "floor" | "ceiling";
const PROMPT: Record<Step, string> = {
  overall: "Overall",
  floor: "Floor",
  ceiling: "Ceiling",
};
/** Community scores are recalculated every so many cards, and when you finish or leave. */
const JOB_EVERY = 10;

interface Rated {
  card: CardSummary;
  overall: number;
  keys: ScoreKey[];
}

/** 1-9 score 1 to 9 and 0 scores 10; saved as 10 to 100. */
const scoreOfKey = (key: string) =>
  /^[0-9]$/.test(key) ? (key === "0" ? 10 : Number(key)) : null;

/**
 * Quick review: one card at a time, one keystroke per rating (maintainer, 16 Oct 2026). Overall,
 * then Floor and Ceiling for a card with conditions, where Enter means "same as overall". Each
 * card is marked reviewed as soon as it's rated; Backspace undoes the last one.
 */
export function QuickReviewPage() {
  const { status, items, retry } = useCards();
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [reviewed, setReviewed] = useState<Set<string> | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let live = true;
    setFailed(false);
    Promise.all([
      scores.listMyReviewedCardIds(user.id),
      scores.listDimensions(),
    ]).then(
      ([ids, d]) => {
        if (!live) return;
        setReviewed(new Set(ids));
        setDimensions(d);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [scores, user, attempt]);

  // The list as it stood when the session started, in the Needs review order. A snapshot, so
  // reviewing a card doesn't reshuffle the list under you.
  const [queue, setQueue] = useState<CardSummary[] | null>(null);
  useEffect(() => {
    if (queue || status !== "loaded" || !reviewed) return;
    const todo = searchAndSort(
      items.filter((c) => !reviewed.has(c.id)),
      "",
      "name",
    ).sort(newestFirst);
    setQueue([
      ...todo.filter(isClassCard),
      ...todo.filter((c) => !isClassCard(c)),
    ]);
  }, [queue, status, reviewed, items]);

  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (failed)
    return (
      <LoadError what="your reviews" onRetry={() => setAttempt((n) => n + 1)} />
    );
  if (!queue || !dimensions) return <Loading label="Loading the cards" />;
  return <Session queue={queue} dimensions={dimensions} />;
}

function Session(props: { queue: CardSummary[]; dimensions: Dimension[] }) {
  const { queue } = props;
  const { scores } = useServices();
  const idOf = useCallback(
    (key: string) => props.dimensions.find((d) => d.key === key)?.id,
    [props.dimensions],
  );
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>("overall");
  const [pending, setPending] = useState<Partial<Record<Step, number>>>({});
  const [history, setHistory] = useState<Rated[]>([]);
  const [error, setError] = useState<string | null>(null);
  const card = queue[index];
  const done = index >= queue.length;

  // Saves run one after another, so an undo never overtakes the save it undoes.
  const chain = useRef(Promise.resolve());
  const run = useCallback((task: () => Promise<void>) => {
    chain.current = chain.current.then(task).catch((e: unknown) => {
      setError(
        `Couldn't save: ${e instanceof Error ? e.message : String(e)}. Check your connection.`,
      );
    });
  }, []);
  const unsent = useRef(0);
  const sendJob = useCallback(() => {
    if (unsent.current === 0) return;
    unsent.current = 0;
    run(() => scores.runCommunityJob().catch(() => {}));
  }, [run, scores]);
  useEffect(() => () => sendJob(), [sendJob]);
  useEffect(() => {
    if (done) sendJob();
  }, [done, sendJob]);

  const finish = useCallback(
    (ratings: Partial<Record<Step, number>>) => {
      if (!card) return;
      const keys: ScoreKey[] = [];
      for (const step of ["overall", "floor", "ceiling"] as const) {
        const id = idOf(step);
        if (ratings[step] !== undefined && id !== undefined)
          keys.push({ dimensionId: id, variantId: null, side: null });
      }
      const values = (["overall", "floor", "ceiling"] as const).flatMap((s) =>
        ratings[s] === undefined || idOf(s) === undefined
          ? []
          : [ratings[s]! * 10],
      );
      run(async () => {
        for (const [i, key] of keys.entries())
          await scores.saveScore(card.id, key, values[i]!);
        await scores.markReviewed(card.id);
      });
      unsent.current += 1;
      if (unsent.current >= JOB_EVERY) sendJob();
      setHistory((h) => [...h, { card, overall: ratings.overall!, keys }]);
      setIndex((i) => i + 1);
      setStep("overall");
      setPending({});
    },
    [card, run, scores, sendJob, idOf],
  );

  const rate = useCallback(
    (n: number) => {
      if (!card) return;
      const next = { ...pending, [step]: n };
      if (
        step === "overall" &&
        hasConditions(
          card.attributes,
          card.variants.map((v) => v.attributes),
        )
      ) {
        setPending(next);
        setStep("floor");
      } else if (step === "floor") {
        setPending(next);
        setStep("ceiling");
      } else finish(next);
    },
    [card, pending, step, finish],
  );

  const sameAsOverall = useCallback(() => {
    if (step === "floor") setStep("ceiling");
    else if (step === "ceiling") finish(pending);
  }, [step, pending, finish]);

  const undo = useCallback(() => {
    if (step !== "overall") {
      setStep("overall");
      setPending({});
      return;
    }
    const last = history.at(-1);
    if (!last) return;
    run(async () => {
      for (const key of last.keys) await scores.clearScore(last.card.id, key);
      await scores.unmarkReviewed(last.card.id);
    });
    unsent.current = Math.max(0, unsent.current - 1);
    setHistory((h) => h.slice(0, -1));
    setIndex(queue.indexOf(last.card));
  }, [step, history, run, scores, queue]);

  const skip = useCallback(() => {
    setIndex((i) => i + 1);
    setStep("overall");
    setPending({});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select"))
        return;
      const n = scoreOfKey(e.key);
      if (n !== null && !done) rate(n);
      else if (e.key === "Enter" && !done) sameAsOverall();
      else if (e.key === "Backspace") undo();
      else if ((e.key === "s" || e.key === "ArrowRight") && !done) skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rate, sameAsOverall, undo, skip, done]);

  const last = history.at(-1);
  const image = card?.variants.find((v) => v.imageUrl)?.imageUrl;
  // The next card's picture loads while you rate this one, so it appears straight away.
  const nextImage = queue[index + 1]?.variants.find(
    (v) => v.imageUrl,
  )?.imageUrl;

  return (
    <section aria-label="Quick review" className={styles.page}>
      <header className={styles.head}>
        <h1>Quick review</h1>
        <span className={styles.progress}>
          {`${history.length} rated · ${Math.max(0, queue.length - index)} to go`}
        </span>
        <Link to="/needs-review">Back to Needs review</Link>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {done ? (
        <div className={styles.done}>
          <h2>All done: {history.length} cards rated.</h2>
          <p>
            Thank you. Your ratings count toward the scoring group&apos;s scores
            now.
          </p>
          <Link to="/needs-review">Back to Needs review</Link>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.cardImage}>
            {image ? (
              <img src={image} alt={card!.name} />
            ) : (
              <div className={styles.standIn}>{card!.name}</div>
            )}
          </div>
          <div className={styles.side}>
            <h2>{card!.name}</h2>
            <CardDetailText cardId={card!.id} />
            <div className={styles.prompt} aria-live="polite">
              <span className={styles.stepName}>{PROMPT[step]}</span>
              {step !== "overall" && (
                <span className={styles.hint}>
                  Overall {pending.overall}. Enter: same as overall
                </span>
              )}
            </div>
            <div
              className={styles.scores}
              role="group"
              aria-label={PROMPT[step]}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Score ${n}`}
                  className={styles.score}
                  onClick={() => rate(n)}
                >
                  {n}
                  <kbd aria-hidden="true">{n === 10 ? 0 : n}</kbd>
                </button>
              ))}
            </div>
            <div className={styles.actions}>
              {step !== "overall" && (
                <button type="button" onClick={sameAsOverall}>
                  Same as overall <kbd>Enter</kbd>
                </button>
              )}
              <button type="button" onClick={skip}>
                Skip <kbd>S</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {nextImage && <img src={nextImage} alt="" hidden />}
      {last && (
        <p className={styles.toast} role="status">
          Rated {last.card.name} {last.overall} ·{" "}
          <button type="button" onClick={undo}>
            Undo <kbd>Backspace</kbd>
          </button>
        </p>
      )}
    </section>
  );
}

/** The card's text, loaded beside the picture for anyone who wants to read it. */
function CardDetailText(props: { cardId: string }) {
  const { scores } = useServices();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setText(null);
    scores.getCard(props.cardId).then(
      (c) => live && setText(c?.text ?? c?.variants[0]?.text ?? null),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [props.cardId, scores]);
  if (!text) return null;
  return (
    <div className={styles.text}>
      {text.split("\n").map((line, i) => (
        <p key={i}>
          <CardText text={line} />
        </p>
      ))}
    </div>
  );
}
