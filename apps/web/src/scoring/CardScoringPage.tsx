import { describeAttributes } from "@vdb/cards";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { classOf, TYPE_LABELS } from "../cards/filterCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../services.tsx";
import { Tag } from "../ui/index.ts";
import type {
  CardDetail,
  Dimension,
  ScoreKey,
  ScoreRow,
} from "./scoreRepository.ts";
import { ScoreEditor } from "./ScoreEditor.tsx";
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

export function CardScoringPage() {
  const { cardId } = route.useParams();
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [card, setCard] = useState<CardDetail | null | undefined>(undefined);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
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
    ]).then(
      ([d, r]) => {
        if (!live) return;
        setDimensions(d);
        setRows(r);
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

  if (card === undefined) return <p>Loading…</p>;
  if (card === null) {
    return (
      <>
        <h1>Card not found</h1>
        <Link to="/cards">Back to cards</Link>
      </>
    );
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
        {TYPE_LABELS[card.type] ?? card.type} ·{" "}
        {classOf({ ...card, subtypes: [], variants: [] })}{" "}
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
        {user ? (
          dimensions.length > 0 && (
            <ScoreEditor
              dimensions={dimensions}
              variants={card.variants}
              rows={rows}
              onSet={(key, score) => void onSet(key, score)}
            />
          )
        ) : (
          <Link to="/sign-in">Sign in to score this card</Link>
        )}
      </section>
    </>
  );
}
