import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { useCards } from "../cards/useCards.ts";
import { useServices } from "../servicesContext.ts";
import { Tag, TextField } from "../ui/index.ts";
import type { Deck, DeckCard } from "./deckRepository.ts";
import {
  deckCounts,
  deckProblems,
  sectionOf,
  slotOf,
  variantName,
  PITCH_NAMES,
  type DeckEntry,
  type FormatRules,
} from "./deckRules.ts";
import styles from "./Decks.module.css";

const route = getRouteApi("/decks/$deckId");
const MAX_RESULTS = 12;

export function DeckPage() {
  const { deckId } = route.useParams();
  const { decks } = useServices();
  const { items: cards } = useCards();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [rules, setRules] = useState<FormatRules | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([decks.getDeck(deckId), decks.getFormatRules()]).then(
      ([d, r]) => {
        if (!live) return;
        setDeck(d);
        setRules(r);
      },
      (e) => live && setError(String(e.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [deckId, decks]);

  const byVariant = useMemo(() => {
    const map = new Map<
      string,
      { card: CardSummary; variant: VariantSummary }
    >();
    for (const card of cards) {
      for (const variant of card.variants)
        map.set(variant.id, { card, variant });
    }
    return map;
  }, [cards]);

  const entries: DeckEntry[] = useMemo(
    () =>
      (deck?.cards ?? []).flatMap((c) => {
        const found = byVariant.get(c.variantId);
        return found
          ? [{ ...found, quantity: c.quantity, sideboard: c.sideboard }]
          : [];
      }),
    [deck, byVariant],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return cards
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [cards, query]);

  async function setCard(card: DeckCard) {
    if (!deck) return;
    const previous = deck;
    const others = deck.cards.filter((c) => c.variantId !== card.variantId);
    setDeck({
      ...deck,
      cards: card.quantity > 0 ? [...others, card] : others,
    });
    try {
      await decks.setCard(deck.id, card);
    } catch (e) {
      setDeck(previous);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const inPool = (variantId: string) =>
    deck?.cards.find((c) => c.variantId === variantId);

  function add(variantId: string) {
    const existing = inPool(variantId);
    void setCard({
      variantId,
      quantity: (existing?.quantity ?? 0) + 1,
      sideboard: existing?.sideboard ?? false,
    });
  }

  if (deck === undefined && !error) return <p>Loading…</p>;
  if (deck === null || deck === undefined) {
    return (
      <>
        <h1>Deck not found</h1>
        {error && <p role="alert">{error}</p>}
        <Link to="/decks">Back to decks</Link>
      </>
    );
  }

  const counts = deckCounts(entries);
  const problems = rules ? deckProblems(entries, rules) : [];
  const main = entries.filter((e) => !e.sideboard);
  const sections: { title: string; entries: DeckEntry[] }[] = [
    {
      title: "Weapons",
      entries: main.filter((e) => sectionOf(e.card) === "weapon"),
    },
    {
      title: "Equipment",
      entries: main.filter((e) => sectionOf(e.card) === "equipment"),
    },
    {
      title: "Deck",
      entries: main.filter((e) => sectionOf(e.card) === "deck"),
    },
    { title: "Sideboard", entries: entries.filter((e) => e.sideboard) },
  ];

  return (
    <>
      <Link to="/decks">← Decks</Link>
      <h1>{deck.name}</h1>
      <p className={styles.muted}>
        {counts.deck} deck cards · {counts.sideboard} sideboard · {counts.pool}{" "}
        in the pool
      </p>
      {error && <p role="alert">{error}</p>}
      {rules &&
        (problems.length === 0 ? (
          <p>
            <Tag tone="accent">Legal</Tag>
          </p>
        ) : (
          <ul className={styles.problems}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ))}

      <div className={styles.editor}>
        <div className={styles.pool}>
          {sections.map((s) => (
            <PoolSection
              key={s.title}
              title={s.title}
              entries={s.entries}
              onSet={(card) => void setCard(card)}
            />
          ))}
        </div>

        <section className={styles.finder} aria-label="Add cards">
          <TextField
            label="Find cards"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            hint="Type at least two letters"
          />
          <ul className={styles.results}>
            {results.map((card) => (
              <li key={card.id}>
                <span>{card.name}</span>
                <span className={styles.adds}>
                  {card.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`${styles.add} ${styles[`pitch${v.pitch ?? 0}`] ?? ""}`}
                      aria-label={`Add ${variantName(card, v)}`}
                      onClick={() => add(v.id)}
                    >
                      + {v.pitch === null ? "Add" : PITCH_NAMES[v.pitch]}
                      {inPool(v.id) ? ` (${inPool(v.id)!.quantity})` : ""}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function PoolSection(props: {
  title: string;
  entries: DeckEntry[];
  onSet: (card: DeckCard) => void;
}) {
  const { title, entries, onSet } = props;
  const sorted = [...entries].sort(
    (a, b) =>
      a.card.name.localeCompare(b.card.name) ||
      (a.variant.pitch ?? 0) - (b.variant.pitch ?? 0),
  );
  const total = entries.reduce((n, e) => n + e.quantity, 0);
  return (
    <section aria-label={title} className={styles.section}>
      <h2>
        {title} <span className={styles.muted}>{total}</span>
      </h2>
      {sorted.length === 0 ? (
        <p className={styles.muted}>None</p>
      ) : (
        <ul className={styles.rows}>
          {sorted.map((e) => {
            const label = variantName(e.card, e.variant);
            const set = (change: Partial<DeckCard>) =>
              onSet({
                variantId: e.variant.id,
                quantity: e.quantity,
                sideboard: e.sideboard,
                ...change,
              });
            const slot = slotOf(e.card);
            return (
              <li key={e.variant.id} className={styles.row}>
                <span
                  className={`${styles.pip} ${styles[`pitch${e.variant.pitch ?? 0}`] ?? ""}`}
                  aria-hidden="true"
                />
                <Link
                  to="/cards/$cardId"
                  params={{ cardId: e.card.id }}
                  className={styles.name}
                >
                  {e.card.name}
                </Link>
                {slot && <span className={styles.muted}>{slot}</span>}
                <span className={styles.quantity}>
                  <button
                    type="button"
                    aria-label={`One fewer ${label}`}
                    onClick={() => set({ quantity: e.quantity - 1 })}
                  >
                    −
                  </button>
                  <output aria-label={`Copies of ${label}`}>
                    {e.quantity}
                  </output>
                  <button
                    type="button"
                    aria-label={`One more ${label}`}
                    onClick={() => set({ quantity: e.quantity + 1 })}
                  >
                    +
                  </button>
                </span>
                <label className={styles.sideboard}>
                  <input
                    type="checkbox"
                    aria-label={`Sideboard: ${label}`}
                    checked={e.sideboard}
                    onChange={(ev) => set({ sideboard: ev.target.checked })}
                  />
                  Sideboard
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
