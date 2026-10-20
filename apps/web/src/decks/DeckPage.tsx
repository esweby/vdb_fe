import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { LoadError, Loading, Tag, TextField } from "../ui/index.ts";
import { analyseDeck } from "./deckAnalysis.ts";
import { CardFinder } from "./CardFinder.tsx";
import { CardTile } from "./CardTile.tsx";
import { DeckAnalysisPanel } from "./DeckAnalysisPanel.tsx";
import { ConditionAvailabilityPanel } from "./ConditionAvailabilityPanel.tsx";
import { DeckScenarios } from "./DeckScenarios.tsx";
import { Goldfish } from "./Goldfish.tsx";
import { ScopedSynergies } from "../synergy/SynergyExplorer.tsx";
import type { Deck, DeckCard, PitchTargets } from "./deckRepository.ts";
import {
  deckCounts,
  deckProblems,
  sectionOf,
  slotOf,
  SLOTS,
  variantName,
  PITCH_NAMES,
  type DeckEntry,
  type FormatRules,
  copyLimitFor,
} from "./deckRules.ts";
import styles from "./Decks.module.css";

const route = getRouteApi("/decks/$deckId");

type Tab = "cards" | "stats" | "synergies" | "scenarios" | "goldfish";
type View = "tiles" | "list";
const TABS: { id: Tab; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "stats", label: "Stats" },
  { id: "synergies", label: "Synergies" },
  { id: "scenarios", label: "Scenarios" },
  { id: "goldfish", label: "Goldfish" },
];

export function DeckPage() {
  const { deckId } = route.useParams();
  const {
    tab = "cards",
    view = "tiles",
    seed,
    side,
    log,
    fixed,
  } = route.useSearch();
  const navigate = useNavigate();
  const { decks } = useServices();
  const { items: cards, status: cardsStatus, retry } = useCards();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [rules, setRules] = useState<FormatRules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = useAppSelector((s) => s.auth.user);

  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoadFailed(false);
    Promise.all([decks.getDeck(deckId), decks.getFormatRules()]).then(
      ([d, r]) => {
        if (!live) return;
        setDeck(d);
        setRules(r);
      },
      () => live && setLoadFailed(true),
    );
    return () => {
      live = false;
    };
  }, [deckId, decks, attempt]);

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

  const limitOf = (card: CardSummary) =>
    rules ? copyLimitFor(card, rules) : Infinity;
  const limitOfVariant = (variantId: string) => {
    const found = byVariant.get(variantId);
    return found ? limitOf(found.card) : Infinity;
  };
  const atLimit = (variantId: string) =>
    (inPool(variantId)?.quantity ?? 0) >= limitOfVariant(variantId);

  function add(variantId: string) {
    if (atLimit(variantId)) return;
    const existing = inPool(variantId);
    void setCard({
      variantId,
      quantity: (existing?.quantity ?? 0) + 1,
      sideboard: existing?.sideboard ?? false,
    });
  }

  /** A card is in the deck or the sideboard, not both: one already in the deck stays there. */
  function addToSideboard(variantId: string) {
    const existing = inPool(variantId);
    if (atLimit(variantId) || (existing && !existing.sideboard)) return;
    void setCard({
      variantId,
      quantity: (existing?.quantity ?? 0) + 1,
      sideboard: true,
    });
  }

  const pitch = useMemo(
    () => analyseDeck({ entries, dimensions: [], scores: new Map() }).pitch,
    [entries],
  );

  if (loadFailed && deck === undefined)
    return (
      <LoadError what="this deck" onRetry={() => setAttempt((n) => n + 1)} />
    );
  if (deck === undefined) return <Loading label="Loading the deck" />;
  // Without the cards the deck would look empty and illegal; wait for them.
  if (cardsStatus === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (deck && cardsStatus !== "loaded")
    return <Loading label="Loading the cards" />;
  if (deck === null) {
    return (
      <>
        <h1>Deck not found</h1>
        <p>It may be private, or it's been deleted.</p>
        <Link to="/decks">Back to decks</Link>
      </>
    );
  }

  // Only the owner changes a deck; anyone else sees a public one read only.
  const canEdit = user?.id === deck.ownerId;
  const onSet = canEdit ? (card: DeckCard) => void setCard(card) : undefined;
  const counts = deckCounts(entries);
  const problems = rules ? deckProblems(entries, rules) : [];
  const main = entries.filter((e) => !e.sideboard);
  const ofSection = (section: string) =>
    main.filter((e) => sectionOf(e.card) === section);
  const go = (next: { tab: Tab; view: View }) =>
    void navigate({
      to: ".",
      replace: true,
      // An in-page change (filters, Load more, settings): keep the scroll position.
      resetScroll: false,
      search: {
        ...(next.tab !== "cards" ? { tab: next.tab } : {}),
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
          {!canEdit && (
            <p className={styles.byline}>
              <Tag>Read only</Tag>
              {deck.ownerName && <span>by {deck.ownerName}</span>}
            </p>
          )}
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
        {tab === "goldfish" ? (
          <Goldfish
            entries={entries}
            seed={seed}
            side={side}
            log={log}
            fixed={fixed}
          />
        ) : tab === "synergies" ? (
          <ScopedSynergies
            scope={{
              cardIds: [...new Set(entries.map((e) => e.card.id))],
              label: "this deck",
            }}
            empty="Add cards to the deck to see how they link."
          />
        ) : tab === "scenarios" ? (
          <DeckScenarios deckId={deckId} entries={entries} />
        ) : tab === "stats" ? (
          <>
            <DeckAnalysisPanel
              entries={entries}
              pitchTargets={deck.pitchTargets ?? {}}
              onTargetsChange={
                canEdit ? (t) => void setPitchTargets(t) : undefined
              }
              pool={cards}
              onAdd={
                canEdit
                  ? (variantId) =>
                      void setCard({ variantId, quantity: 1, sideboard: false })
                  : undefined
              }
            />
            <ConditionAvailabilityPanel entries={entries} />
          </>
        ) : (
          <div className={canEdit ? styles.editor : undefined}>
            {canEdit && (
              <section className={styles.finder} aria-label="Add cards">
                <h2 className={styles.finderTitle}>Add cards</h2>
                <CardFinder
                  cards={cards}
                  quantityOf={(id) => inPool(id)?.quantity}
                  placeOf={(id) => {
                    const e = inPool(id);
                    return e ? (e.sideboard ? "sideboard" : "deck") : undefined;
                  }}
                  atLimit={atLimit}
                  limitOf={limitOfVariant}
                  onAdd={(id, toSideboard) =>
                    toSideboard ? addToSideboard(id) : add(id)
                  }
                />
              </section>
            )}
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
                  title="Weapons and equipment"
                  entries={[...ofSection("weapon"), ...ofSection("equipment")]}
                  order="gear"
                  limitOf={limitOf}
                  view={view}
                  onSet={onSet}
                />
                <PoolSection
                  title="Deck"
                  heading={`Deck ${counts.deck}`}
                  entries={ofSection("deck")}
                  limitOf={limitOf}
                  view={view}
                  onSet={onSet}
                />
                <PoolSection
                  title="Sideboard"
                  entries={entries.filter((e) => e.sideboard)}
                  limitOf={limitOf}
                  view={view}
                  onSet={onSet}
                />
              </div>
            </div>
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
  /** Copies allowed of this card (equipment: one). */
  limitOf: (card: CardSummary) => number;
  view: View;
  /** "pitch": red, yellow, blue, then no pitch. "gear": weapons, then equipment by slot. */
  order?: "pitch" | "gear";
  /** Changes a card; without it (someone else's deck) the section is read only. */
  onSet?: (card: DeckCard) => void;
}) {
  const { title, entries, limitOf, view, onSet } = props;
  const rank = (e: DeckEntry) =>
    props.order === "gear"
      ? sectionOf(e.card) === "weapon"
        ? -1
        : SLOTS.indexOf(slotOf(e.card) ?? "Off-Hand")
      : (e.variant.pitch ?? 99);
  // Alphabetical within each pitch (or slot).
  const sorted = [...entries].sort(
    (a, b) => rank(a) - rank(b) || a.card.name.localeCompare(b.card.name),
  );
  const total = entries.reduce((n, e) => n + e.quantity, 0);

  const controls = (e: DeckEntry) => {
    const label = variantName(e.card, e.variant);
    const set = (change: Partial<DeckCard>) =>
      onSet?.({
        variantId: e.variant.id,
        quantity: e.quantity,
        sideboard: e.sideboard,
        ...change,
      });
    const limit = limitOf(e.card);
    const full = e.quantity >= limit;
    return (
      <>
        {limit === 1 ? (
          // Only one allowed (equipment): nothing to count, just remove it.
          <button
            type="button"
            aria-label={`Remove ${label}`}
            title="Remove"
            onClick={() => set({ quantity: 0 })}
          >
            ✕
          </button>
        ) : (
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
              title={full ? `At most ${limit} copies` : undefined}
              onClick={() => set({ quantity: e.quantity + 1 })}
            >
              +
            </button>
          </>
        )}
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
              <CardTile
                card={e.card}
                variant={e.variant}
                quantity={e.quantity}
                enlargeable
              >
                {onSet && (
                  <span className={styles.tileControls}>{controls(e)}</span>
                )}
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
                {onSet && (
                  <span className={styles.controls}>{controls(e)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
