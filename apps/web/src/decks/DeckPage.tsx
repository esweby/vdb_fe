import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { useCards } from "../cards/useCards.ts";
import { useServices } from "../servicesContext.ts";
import { Tag, TextField } from "../ui/index.ts";
import { analyseDeck } from "./deckAnalysis.ts";
import { CardTile } from "./CardTile.tsx";
import { DeckAnalysisPanel } from "./DeckAnalysisPanel.tsx";
import type { Deck, DeckCard, PitchTargets } from "./deckRepository.ts";
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

type Tab = "cards" | "stats";
type View = "tiles" | "list";
const TABS: { id: Tab; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "stats", label: "Stats" },
];

export function DeckPage() {
  const { deckId } = route.useParams();
  const { tab = "cards", view = "tiles" } = route.useSearch();
  const navigate = useNavigate();
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

  async function setPitchTargets(targets: PitchTargets) {
    if (!deck) return;
    const previous = deck;
    setDeck({ ...deck, pitchTargets: targets });
    try {
      await decks.setPitchTargets(deck.id, targets);
    } catch (e) {
      setDeck(previous);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const inPool = (variantId: string) =>
    deck?.cards.find((c) => c.variantId === variantId);

  const copyLimit = rules?.copyLimit ?? Infinity;
  const atLimit = (variantId: string) =>
    (inPool(variantId)?.quantity ?? 0) >= copyLimit;

  function add(variantId: string) {
    if (atLimit(variantId)) return;
    const existing = inPool(variantId);
    void setCard({
      variantId,
      quantity: (existing?.quantity ?? 0) + 1,
      sideboard: existing?.sideboard ?? false,
    });
  }

  const pitch = useMemo(
    () => analyseDeck({ entries, dimensions: [], scores: new Map() }).pitch,
    [entries],
  );

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
  const ofSection = (section: string) =>
    main.filter((e) => sectionOf(e.card) === section);
  const go = (next: { tab: Tab; view: View }) =>
    void navigate({
      to: ".",
      replace: true,
      search: {
        ...(next.tab === "stats" ? { tab: "stats" as const } : {}),
        ...(next.view === "list" ? { view: "list" as const } : {}),
      },
    });
  const setTab = (next: Tab) => go({ tab: next, view });
  const setView = (next: View) => go({ tab, view: next });

  return (
    <>
      <Link to="/decks">← Decks</Link>
      <header className={styles.deckHeader}>
        <div>
          <h1>{deck.name}</h1>
          <p className={styles.meta}>
            {counts.deck} deck cards · {counts.sideboard} sideboard ·{" "}
            {counts.pool} in the pool
          </p>
        </div>
        <PitchBar pitch={pitch} />
      </header>

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

      <div role="tablist" aria-label="Deck views" className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`deck-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`deck-panel-${t.id}`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`deck-panel-${tab}`}
        aria-labelledby={`deck-tab-${tab}`}
      >
        {tab === "stats" ? (
          <DeckAnalysisPanel
            entries={entries}
            pitchTargets={deck.pitchTargets ?? {}}
            onTargetsChange={(t) => void setPitchTargets(t)}
          />
        ) : (
          <div className={styles.editor}>
            <div>
              <div className={styles.viewToggle}>
                {(["tiles", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                  >
                    {v === "tiles" ? "Card view" : "List view"}
                  </button>
                ))}
              </div>
              <div
                className={
                  view === "tiles" ? styles.tileColumns : styles.columns
                }
              >
                <PoolSection
                  title="Deck"
                  heading={`Deck ${counts.deck}${rules ? ` / ${rules.deckMin}` : ""}`}
                  entries={ofSection("deck")}
                  copyLimit={copyLimit}
                  view={view}
                  onSet={(card) => void setCard(card)}
                />
                <div className={styles.gearColumn}>
                  <PoolSection
                    title="Weapons"
                    entries={ofSection("weapon")}
                    copyLimit={copyLimit}
                    view={view}
                    onSet={(card) => void setCard(card)}
                  />
                  <PoolSection
                    title="Equipment"
                    entries={ofSection("equipment")}
                    copyLimit={copyLimit}
                    view={view}
                    onSet={(card) => void setCard(card)}
                  />
                </div>
                <PoolSection
                  title="Sideboard"
                  entries={entries.filter((e) => e.sideboard)}
                  copyLimit={copyLimit}
                  view={view}
                  onSet={(card) => void setCard(card)}
                />
              </div>
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
                          disabled={atLimit(v.id)}
                          title={
                            atLimit(v.id)
                              ? `At most ${copyLimit} copies`
                              : undefined
                          }
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
        )}
      </div>
    </>
  );
}

/** Stacked red / yellow / blue bar with counts, for the deck header. */
function PitchBar({ pitch }: { pitch: Record<1 | 2 | 3, number> }) {
  const total = pitch[1] + pitch[2] + pitch[3];
  return (
    <div
      role="img"
      aria-label={`Pitch: ${pitch[1]} red, ${pitch[2]} yellow, ${pitch[3]} blue`}
      className={styles.pitchBar}
    >
      <div className={styles.pitchBarTrack}>
        {([1, 2, 3] as const).map((p) =>
          pitch[p] > 0 ? (
            <span
              key={p}
              className={styles[`pitch${p}`]}
              style={{ flexGrow: pitch[p] }}
            />
          ) : null,
        )}
        {total === 0 && <span className={styles.pitchBarEmpty} />}
      </div>
      <div className={styles.pitchBarCounts}>
        {([1, 2, 3] as const).map((p) => (
          <span key={p}>
            <span
              className={`${styles.pip} ${styles[`pitch${p}`]}`}
              aria-hidden="true"
            />
            {pitch[p]}
          </span>
        ))}
      </div>
    </div>
  );
}

function PoolSection(props: {
  title: string;
  heading?: string;
  entries: DeckEntry[];
  copyLimit: number;
  view: View;
  onSet: (card: DeckCard) => void;
}) {
  const { title, entries, copyLimit, view, onSet } = props;
  // Red, yellow, blue, then cards without pitch; alphabetical within each.
  const pitchOrder = (e: DeckEntry) => e.variant.pitch ?? 99;
  const sorted = [...entries].sort(
    (a, b) =>
      pitchOrder(a) - pitchOrder(b) || a.card.name.localeCompare(b.card.name),
  );
  const total = entries.reduce((n, e) => n + e.quantity, 0);

  const controls = (e: DeckEntry) => {
    const label = variantName(e.card, e.variant);
    const set = (change: Partial<DeckCard>) =>
      onSet({
        variantId: e.variant.id,
        quantity: e.quantity,
        sideboard: e.sideboard,
        ...change,
      });
    const full = e.quantity >= copyLimit;
    return (
      <>
        <button
          type="button"
          aria-label={`One fewer ${label}`}
          onClick={() => set({ quantity: e.quantity - 1 })}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`One more ${label}`}
          disabled={full}
          title={full ? `At most ${copyLimit} copies` : undefined}
          onClick={() => set({ quantity: e.quantity + 1 })}
        >
          +
        </button>
        <label
          className={styles.sideboard}
          title={e.sideboard ? "Move to the deck" : "Move to the sideboard"}
        >
          <input
            type="checkbox"
            aria-label={`Sideboard: ${label}`}
            checked={e.sideboard}
            onChange={(ev) => set({ sideboard: ev.target.checked })}
          />
          SB
        </label>
      </>
    );
  };

  return (
    <section aria-label={title} className={styles.section}>
      <h2>{props.heading ?? `${title} ${total}`}</h2>
      {sorted.length === 0 ? (
        <p className={styles.muted}>None</p>
      ) : view === "tiles" ? (
        <ul className={styles.tiles}>
          {sorted.map((e) => (
            <li key={e.variant.id}>
              <CardTile card={e.card} variant={e.variant} quantity={e.quantity}>
                <span className={styles.tileControls}>{controls(e)}</span>
              </CardTile>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.rows}>
          {sorted.map((e) => {
            const label = variantName(e.card, e.variant);
            const slot = slotOf(e.card);
            const hands = e.card.subtypes.find((s) => s === "1H" || s === "2H");
            return (
              <li key={e.variant.id} className={styles.row}>
                <output
                  aria-label={`Copies of ${label}`}
                  className={styles.copies}
                >
                  {e.quantity}×
                </output>
                <span
                  className={`${styles.pitchPip} ${styles[`pitch${e.variant.pitch ?? 0}`] ?? ""}`}
                  aria-hidden="true"
                >
                  {e.variant.pitch ?? ""}
                </span>
                <Link
                  to="/cards/$cardId"
                  params={{ cardId: e.card.id }}
                  className={styles.name}
                >
                  {e.card.name}
                </Link>
                {(slot || hands) && (
                  <span className={styles.muted}>{slot ?? hands}</span>
                )}
                <span className={styles.controls}>{controls(e)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
