import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { selectRole } from "../auth/authSlice.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, LoadError, Loading, Tag, TextField } from "../ui/index.ts";
import type { DraftReview } from "./draftReviewRepository.ts";
import {
  draftQueue,
  type DraftEntry,
  type DraftStatus,
  type QueuedDraft,
} from "./draftQueue.ts";
import styles from "./EffectDraftsPage.module.css";

const SECTIONS: { status: DraftStatus; title: string; note: string }[] = [
  {
    status: "complete",
    title: "Ready to check",
    note: "Everything the card's facts record is drafted.",
  },
  {
    status: "partial",
    title: "Partly drafted",
    note: "Some of the card's facts aren't drafted; they're listed under each draft.",
  },
  {
    status: "reviewed",
    title: "Reviewed",
    note: "An admin has accepted or rejected every draft. Accepted drafts still need adding to the engine's verified rules, with tests, before the engine plays them.",
  },
  {
    status: "verified",
    title: "Verified",
    note: "These cards already have rules a player signed off. The draft is shown for comparison.",
  },
];

const pitchLabel = (pitches: (number | null)[]) =>
  pitches[0] === null ? "No pitch" : `Pitch ${pitches.join(", ")}`;

interface Actions {
  save: (review: DraftReview) => Promise<void>;
  clear: (cardId: string, draftHash: string) => Promise<void>;
}

/** An admin's verdict on one draft: shown to everyone, given and taken back by admins. */
function Verdict(props: {
  cardId: string;
  draft: QueuedDraft;
  actions?: Actions;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { review } = props.draft;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const error = failed && (
    <p role="alert" className={styles.error}>
      Couldn't save the verdict. Try again.
    </p>
  );

  if (review)
    return (
      <div className={styles.verdict}>
        <Tag tone={review.verdict === "accepted" ? "accent" : "neutral"}>
          {review.verdict === "accepted" ? "Accepted" : "Rejected"}
          {review.note ? `: ${review.note}` : ""}
        </Tag>
        {props.actions && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(() =>
                props.actions!.clear(props.cardId, props.draft.hash),
              )
            }
          >
            Undo
          </Button>
        )}
        {error}
      </div>
    );
  if (!props.actions) return null;
  const give = (verdict: DraftReview["verdict"]) =>
    void run(() =>
      props.actions!.save({
        cardId: props.cardId,
        draftHash: props.draft.hash,
        verdict,
        note: note.trim() || null,
      }),
    );
  return (
    <div className={styles.verdict}>
      <TextField
        label="Note"
        hideLabel
        placeholder="Note (optional)"
        maxLength={280}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        variant="primary"
        disabled={busy}
        onClick={() => give("accepted")}
      >
        Accept
      </Button>
      <Button disabled={busy} onClick={() => give("rejected")}>
        Reject
      </Button>
      {error}
    </div>
  );
}

function DraftCard(props: { entry: DraftEntry; actions?: Actions }) {
  const { card, drafts, verified, staleReview } = props.entry;
  const titleId = `draft-${card.id}`;
  const image = card.variants.find((v) => v.imageUrl)?.imageUrl;
  return (
    <article aria-labelledby={titleId} className={styles.card}>
      {image && (
        <img
          className={styles.image}
          src={image}
          alt={`${card.name}, the printed card`}
          loading="lazy"
        />
      )}
      <div>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.name}>
            {card.name}
          </h3>
          <Tag tone={verified ? "accent" : "neutral"}>
            {verified ? "Verified" : "Unverified"}
          </Tag>
        </div>
        {staleReview && (
          <p className={styles.muted}>
            The card's facts changed since its last verdict.
          </p>
        )}
        {drafts.map((d) => (
          <div key={d.hash} className={styles.draft}>
            <p className={styles.pitch}>{pitchLabel(d.pitches)}</p>
            {d.draft.description.length > 0 ? (
              <ul>
                {d.draft.description.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>Nothing drafted.</p>
            )}
            {d.draft.notDrafted.length > 0 && (
              <>
                <p className={styles.muted}>Not drafted:</p>
                <ul className={styles.muted}>
                  {d.draft.notDrafted.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            {!verified && (
              <Verdict cardId={card.id} draft={d} actions={props.actions} />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * Effect drafts from card facts (docs/rules-engine.md, step 9b), in plain words beside the printed
 * card, for a player to check. Admins accept or reject each draft; every draft stays unverified
 * until its rules are added to the engine with signed-off tests.
 */
export function EffectDraftsPage() {
  const { status, items, retry } = useCards();
  const { draftReviews } = useServices();
  const isAdmin = useAppSelector((s) => selectRole(s) === "admin");
  const [reviews, setReviews] = useState<DraftReview[] | null>(null);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setReviewsFailed(false);
    draftReviews.listReviews().then(
      (rows) => live && setReviews(rows),
      () => live && setReviewsFailed(true),
    );
    return () => {
      live = false;
    };
  }, [draftReviews, attempt]);

  const queue = useMemo(
    () => draftQueue(items, reviews ?? []),
    [items, reviews],
  );
  const same = (r: DraftReview, cardId: string, hash: string) =>
    r.cardId === cardId && r.draftHash === hash;
  const actions: Actions | undefined = isAdmin
    ? {
        async save(review) {
          await draftReviews.saveReview(review);
          setReviews((rows) => [
            ...(rows ?? []).filter(
              (r) => !same(r, review.cardId, review.draftHash),
            ),
            review,
          ]);
        },
        async clear(cardId, hash) {
          await draftReviews.clearReview(cardId, hash);
          setReviews((rows) =>
            (rows ?? []).filter((r) => !same(r, cardId, hash)),
          );
        },
      }
    : undefined;

  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (reviewsFailed)
    return (
      <LoadError what="the verdicts" onRetry={() => setAttempt((n) => n + 1)} />
    );
  if (status !== "loaded") return <Loading label="Loading the cards" />;
  if (!reviews) return <Loading label="Loading the verdicts" />;
  return (
    <>
      <p>
        <Link to="/needs-review">Needs review</Link>
      </p>
      <h1>Effect drafts</h1>
      <p className={styles.intro}>
        What the rules engine would do for each card, drafted from the card's
        facts. Check each against the printed text.{" "}
        {isAdmin
          ? "Accept or reject each draft; a note says what's wrong."
          : "Admins accept or reject each draft."}{" "}
        A draft is unverified until its rules are added to the engine with
        signed-off tests.
      </p>
      {SECTIONS.map((s) => {
        const entries = queue.filter((e) => e.status === s.status);
        return (
          <section
            key={s.status}
            aria-label={s.title}
            className={styles.section}
          >
            <h2>
              {s.title} <span className={styles.muted}>({entries.length})</span>
            </h2>
            <p className={styles.muted}>{s.note}</p>
            <div className={styles.grid}>
              {entries.map((e) => (
                <DraftCard key={e.card.id} entry={e} actions={actions} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
