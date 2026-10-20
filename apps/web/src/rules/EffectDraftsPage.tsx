import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCards } from "../cards/useCards.ts";
import { LoadError, Loading, Tag } from "../ui/index.ts";
import { draftQueue, type DraftEntry, type DraftStatus } from "./draftQueue.ts";
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
    status: "verified",
    title: "Verified",
    note: "These cards already have rules a player signed off. The draft is shown for comparison.",
  },
];

const pitchLabel = (pitches: (number | null)[]) =>
  pitches[0] === null ? "No pitch" : `Pitch ${pitches.join(", ")}`;

function DraftCard(props: { entry: DraftEntry }) {
  const { card, drafts, verified } = props.entry;
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
        {drafts.map((d) => (
          <div key={pitchLabel(d.pitches)} className={styles.draft}>
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
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * Effect drafts from card facts (docs/rules-engine.md, step 9b), in plain words beside the printed
 * card, for a player to check. Every draft is unverified until a player signs it off.
 */
export function EffectDraftsPage() {
  const { status, items, retry } = useCards();
  const queue = useMemo(() => draftQueue(items), [items]);
  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (status !== "loaded") return <Loading label="Loading the cards" />;
  return (
    <>
      <p>
        <Link to="/needs-review">Needs review</Link>
      </p>
      <h1>Effect drafts</h1>
      <p className={styles.intro}>
        What the rules engine would do for each card, drafted from the card's
        facts. Check each against the printed text. A draft is unverified until
        a player signs it off.
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
                <DraftCard key={e.card.id} entry={e} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
