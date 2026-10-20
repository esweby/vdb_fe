import { deriveSynergies, SYNERGY_RULES, type SynergyEdge } from "@vdb/cards";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isClassCard } from "../cards/filterCards.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { LoadError, Loading } from "../ui/index.ts";
import styles from "./SynergyQueuePage.module.css";
import { cardScores } from "./discover.ts";
import {
  feedbackRows,
  pairKey,
  relevantLinks,
  synergyQueue,
} from "./synergyQueue.ts";
import type { FeedbackRow } from "./synergyRepository.ts";

/** How many links a sitting asks about (the maintainer, 20 Oct 2026). */
const SITTING = 20;

const DESCRIPTIONS = new Map(SYNERGY_RULES.map((r) => [r.id, r.description]));

interface Answer {
  index: number;
  /** false for a skip, which saved nothing. */
  saved: boolean;
}

/**
 * Confirm synergies (README "Synergy graph"): the links the derived rules propose, one at a
 * time. Scorers confirm, reject or reweight each, from the keyboard like quick review. Their
 * verdicts count toward the scoring group's links once 2 or more people agree
 * (docs/synergy-rules.md "Community feedback").
 */
export function SynergyQueuePage() {
  const { synergy, decks, scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const cards = useCards();
  const [loaded, setLoaded] = useState<{
    weights: Record<string, number>;
    answered: Set<string>;
    /** Variants in the scorer's decks, and the scoring group's ratings, for relevance. */
    myVariants: Set<string>;
    ratings: Map<string, number>;
  } | null>(null);
  const [sittingEnd, setSittingEnd] = useState(SITTING);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Answer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    const myVariants = decks
      .listMyDecks(user.id)
      .then((list) => Promise.all(list.map((d) => decks.getDeck(d.id))))
      .then(
        (full) =>
          new Set(full.flatMap((d) => d?.cards.map((c) => c.variantId) ?? [])),
      );
    const ratings = Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
    ]).then(
      ([dimensions, rows, min]) => {
        const overall = dimensions.find((d) => d.key === "overall");
        return overall ? cardScores(rows, overall.id, min) : new Map();
      },
      () => new Map<string, number>(),
    );
    Promise.all([
      synergy.listRuleWeights(),
      synergy.listMyFeedback(user.id),
      myVariants,
      ratings,
    ]).then(
      ([weights, mine, variants, rated]) =>
        live &&
        setLoaded({
          weights,
          answered: new Set(mine.map((f) => pairKey(f.fromCardId, f.toCardId))),
          myVariants: variants,
          ratings: rated,
        }),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [synergy, decks, scores, user, attempt]);

  const byId = useMemo(
    () =>
      new Map(
        cards.items.map((c) => [c.id, { ...c, classCard: isClassCard(c) }]),
      ),
    [cards.items],
  );
  // Fixed once loaded, so answering doesn't reshuffle what's ahead. Only links that matter to
  // the scorer: a card in their decks, or two well rated cards.
  const { queue, relevant } = useMemo(() => {
    if (!loaded || cards.status !== "loaded") return { queue: [], relevant: 0 };
    const edges = deriveSynergies(
      cards.items.map((c) => ({
        ...c,
        variantAttributes: c.variants.map((v) => v.attributes),
      })),
      loaded.weights,
    );
    const myCards = new Set(
      cards.items
        .filter((c) => c.variants.some((v) => loaded.myVariants.has(v.id)))
        .map((c) => c.id),
    );
    const links = relevantLinks(edges, { myCards, ratings: loaded.ratings });
    return {
      queue: synergyQueue(links, byId, loaded.answered) as SynergyEdge[],
      relevant: links.length,
    };
  }, [loaded, cards.status, cards.items, byId]);

  const current = index < sittingEnd ? queue[index] : undefined;
  const sittingOver = index >= sittingEnd && index < queue.length;
  const done = !!loaded && cards.status === "loaded" && !current;

  const answer = useCallback(
    async (verdict: FeedbackRow["verdict"] | "skip", weight?: number) => {
      if (!user || !current) return;
      const at = index;
      setIndex(at + 1);
      setHistory((h) => [...h, { index: at, saved: verdict !== "skip" }]);
      if (verdict === "skip") return;
      try {
        await synergy.saveFeedback(
          user.id,
          feedbackRows(current, verdict, weight ?? null),
        );
        setError(null);
      } catch (e) {
        setError(
          `Couldn't save: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [user, current, index, synergy],
  );

  const undo = useCallback(async () => {
    const last = history.at(-1);
    if (!user || !last) return;
    setHistory((h) => h.slice(0, -1));
    setIndex(last.index);
    const edge = queue[last.index];
    if (!last.saved || !edge) return;
    try {
      await synergy.clearFeedback(user.id, edge.from, edge.to);
    } catch (e) {
      setError(`Couldn't undo: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [user, history, queue, synergy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select"))
        return;
      const key = e.key.toLowerCase();
      if (key === "backspace") void undo();
      else if (done) return;
      else if (key === "y") void answer("confirm");
      else if (key === "n") void answer("reject");
      else if (key === "s") void answer("skip");
      else if (/^[0-9]$/.test(key))
        void answer("reweight", key === "0" ? 1 : Number(key) / 10);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, undo, done]);

  if (failed || cards.status === "failed")
    return (
      <LoadError
        what="the synergy suggestions"
        onRetry={() => {
          setFailed(false);
          cards.retry();
          setAttempt((n) => n + 1);
        }}
      />
    );
  if (!loaded || cards.status !== "loaded")
    return <Loading label="Loading the synergy suggestions" />;

  const sittingSize = Math.min(SITTING, queue.length - (sittingEnd - SITTING));
  const left = Math.min(sittingEnd, queue.length) - index;
  const from = current && byId.get(current.from);
  const to = current && byId.get(current.to);
  const image = (id: string) =>
    byId.get(id)?.variants.find((v) => v.imageUrl)?.imageUrl;

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <h1>Confirm synergies</h1>
        {!done && !sittingOver && (
          <span className={styles.progress}>
            {`${left} of ${sittingSize} relevant ${sittingSize === 1 ? "link" : "links"} in this sitting`}
          </span>
        )}
        <Link to="/needs-review">Back to Needs review</Link>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {sittingOver ? (
        <div className={styles.done}>
          <p>{`Done for now: ${queue.length - index} more relevant ${queue.length - index === 1 ? "link" : "links"} to go.`}</p>
          <button type="button" onClick={() => setSittingEnd(index + SITTING)}>
            {`${Math.min(SITTING, queue.length - index)} more`}
          </button>
          <Link to="/needs-review">Back to Needs review</Link>
        </div>
      ) : relevant === 0 ? (
        <div className={styles.done}>
          <p>
            No links to confirm for the cards you play. Links show up here once
            one of their cards is in your decks, or both are rated 7 or more.
          </p>
          <Link to="/needs-review">Back to Needs review</Link>
        </div>
      ) : done || !current || !from || !to ? (
        <div className={styles.done}>
          <p>You&apos;ve answered every suggestion.</p>
          {history.length > 0 && (
            <p className={styles.hint}>Backspace takes the last one back.</p>
          )}
          <Link to="/needs-review">Back to Needs review</Link>
        </div>
      ) : (
        <div className={styles.body}>
          <h2>
            Does {from.name} help {to.name}?
          </h2>
          <div className={styles.pair}>
            {[from, to].map((c, i) => (
              <figure key={c.id} className={styles.card}>
                {image(c.id) ? (
                  <img src={image(c.id)!} alt={c.name} />
                ) : (
                  <div className={styles.standIn}>{c.name}</div>
                )}
                <figcaption>{i === 0 ? "Helps" : "Is helped"}</figcaption>
              </figure>
            ))}
          </div>
          <ul className={styles.reasons} aria-label="Why the rules link them">
            {current.reasons.map((id) => (
              <li key={id}>{DESCRIPTIONS.get(id) ?? id}</li>
            ))}
          </ul>
          <p className={styles.hint}>Rule weight {current.weight}</p>
          <div className={styles.actions}>
            <button type="button" onClick={() => void answer("confirm")}>
              Yes <kbd>Y</kbd>
            </button>
            <button type="button" onClick={() => void answer("reject")}>
              No <kbd>N</kbd>
            </button>
            <button type="button" onClick={() => void answer("skip")}>
              Skip <kbd>S</kbd>
            </button>
          </div>
          <div
            className={styles.weights}
            role="group"
            aria-label="Or set how much it helps"
          >
            {Array.from({ length: 10 }, (_, i) => (i + 1) / 10).map((w) => (
              <button
                key={w}
                type="button"
                aria-label={`Weight ${w}`}
                onClick={() => void answer("reweight", w)}
              >
                {w}
                <kbd aria-hidden="true">{w === 1 ? 0 : w * 10}</kbd>
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            Y yes, N no, 1–9 and 0 for a weight of 0.1 to 1, S skip, Backspace
            undo.
          </p>
        </div>
      )}
    </section>
  );
}
