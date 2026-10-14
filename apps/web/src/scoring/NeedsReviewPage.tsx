import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../services.tsx";
import styles from "./NeedsReviewPage.module.css";

const isClassCard = (c: CardSummary) =>
  c.classes.includes("Runeblade") || c.talents.includes("Shadow");

function Section(props: { title: string; cards: CardSummary[] }) {
  return (
    <section aria-label={props.title} className={styles.section}>
      <h2>
        {props.title}{" "}
        <span className={styles.count}>({props.cards.length})</span>
      </h2>
      {props.cards.length === 0 ? (
        <p className={styles.done}>All reviewed.</p>
      ) : (
        <ul className={styles.list}>
          {props.cards.map((c) => (
            <li key={c.id}>
              <Link to="/cards/$cardId" params={{ cardId: c.id }}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Cards the signed-in scorer hasn't marked reviewed, Runeblade and Shadow first. */
export function NeedsReviewPage() {
  const { status, items } = useCards();
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [reviewed, setReviewed] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void scores
      .listMyReviewedCardIds(user.id)
      .then((ids) => live && setReviewed(new Set(ids)));
    return () => {
      live = false;
    };
  }, [scores, user]);

  if (status !== "loaded" || !reviewed) return <p>Loading…</p>;
  const todo = items
    .filter((c) => !reviewed.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const classCards = todo.filter(isClassCard);
  const generics = todo.filter((c) => !isClassCard(c));

  return (
    <>
      <h1>Needs review</h1>
      <p>
        {todo.length} {todo.length === 1 ? "card" : "cards"} left to review
      </p>
      <Section title="Runeblade and Shadow" cards={classCards} />
      <Section title="Generic" cards={generics} />
    </>
  );
}
