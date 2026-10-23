import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { LoadError, Loading, Tag, TextField } from "../ui/index.ts";
import { pitchesShown, pitchName } from "../cards/pitch.ts";
import { analyseDeck, type PitchCounts } from "./deckAnalysis.ts";
import { CardFinder } from "./CardFinder.tsx";
import { CardTile } from "./CardTile.tsx";
import { DeckAnalysisPanel } from "./DeckAnalysisPanel.tsx";
import {
  rarelyAvailable,
  RARELY_BELOW,
  sortByAvailability,
  type CardAvailability,
} from "./cardAvailability.ts";
import { useCardAvailability } from "./useCardAvailability.ts";
import { ConditionAvailabilityPanel } from "./ConditionAvailabilityPanel.tsx";
import { DeckGapsPanel } from "./DeckGapsPanel.tsx";
import { DeckScenarios } from "./DeckScenarios.tsx";
import { DeckSettings } from "./DeckSettings.tsx";
import { DeckVersions } from "./DeckVersions.tsx";
import { MatchupsPanel } from "./MatchupsPanel.tsx";
import { entriesForMatchup } from "./matchupEntries.ts";
import { Goldfish } from "./Goldfish.tsx";
import { fabraryImportLink } from "./fabraryLink.ts";
import { ScopedSynergies } from "../synergy/SynergyExplorer.tsx";
import type {
  Deck,
  DeckCard,
  Hero,
  Matchup,
  PitchTargets,
  DeckVersion,
} from "./deckRepository.ts";
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

type Tab =
  | "cards"
  | "stats"
  | "gaps"
  | "synergies"
  | "scenarios"
  | "matchups"
  | "goldfish";
type View = "tiles" | "list";
const TABS: { id: Tab; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "stats", label: "Stats" },
  { id: "gaps", label: "Gaps" },
  { id: "synergies", label: "Synergies" },
  { id: "scenarios", label: "Scenarios" },
  { id: "matchups", label: "Matchups" },
  { id: "goldfish", label: "Goldfish" },
];

/** Cards in a list's main deck, leaving out weapons and equipment. */
const deckCount = (entries: DeckEntry[]) =>
  entries
    .filter((e) => !e.sideboard && sectionOf(e.card) === "deck")
    .reduce((n, e) => n + e.quantity, 0);

/** The hero FaBrary gets: Viserai's front side. */
const HERO = "Viserai, the Forsaken";

/** Viserai's card pictures by side, from the hero list ("Viserai, the Forsaken", "Viserai, Usurper"). */
const viseraiImages = (heroes: Hero[]) => {
  const find = (word: string) =>
    heroes.find((h) => h.name.startsWith("Viserai") && h.name.includes(word))
      ?.imageUrl ?? null;
  return { forsaken: find("Forsaken"), usurper: find("Usurper") };
};

export function DeckPage() {
  const { deckId } = route.useParams();
  const {
    tab = "cards",
    view = "tiles",
    seed,
    side,
    log,
    fixed,
    vs,
    mode,
  } = route.useSearch();
  const navigate = useNavigate();
  const { decks } = useServices();
  const { items: cards, status: cardsStatus, retry } = useCards();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [rules, setRules] = useState<FormatRules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = useAppSelector((s) => s.auth.user);
  const [latestVersion, setLatestVersion] = useState<DeckVersion | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportInFlight = useRef(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const writesInFlight = useRef(0);
  // Matchup plans and their heroes, for "Playing" on goldfish and scenarios. Row level
  // security returns only the owner's plans.
  const [plans, setPlans] = useState<{ matchups: Matchup[]; heroes: Hero[] }>({
    matchups: [],
    heroes: [],
  });
  useEffect(() => {
    if (!user) return;
    let live = true;
    Promise.all([decks.listMatchups(deckId), decks.listHeroes()]).then(
      ([matchups, heroes]) => live && setPlans({ matchups, heroes }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks, deckId, user, tab]);

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

  /**
   * Sets a card's deck row or sideboard row (a card can have both: the maintainer, 20 Oct 2026),
   * saving the changes in order.
   */
  async function setCards(...changes: DeckCard[]) {
    if (!deck) return;
    const previous = deck;
    let cards = deck.cards;
    for (const card of changes) {
      const others = cards.filter(
        (c) => c.variantId !== card.variantId || c.sideboard !== card.sideboard,
      );
      cards = card.quantity > 0 ? [...others, card] : others;
    }
    setDeck({ ...deck, cards });
    writesInFlight.current += 1;
    setPendingWrites(writesInFlight.current);
    try {
      for (const card of changes) await decks.setCard(deck.id, card);
    } catch (e) {
      setDeck(previous);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      writesInFlight.current -= 1;
      setPendingWrites(writesInFlight.current);
    }
  }
  const setCard = (card: DeckCard) => setCards(card);

  async function setPitchTargets(targets: PitchTargets) {
    if (!deck) return;
    const previous = deck;
    setDeck({ ...deck, pitchTargets: targets });
    writesInFlight.current += 1;
    setPendingWrites(writesInFlight.current);
    try {
      await decks.setPitchTargets(deck.id, targets);
    } catch (e) {
      setDeck(previous);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      writesInFlight.current -= 1;
      setPendingWrites(writesInFlight.current);
    }
  }

  async function openInFabrary() {
    if (!deck || user?.id !== deck.ownerId) return;
    if (exportInFlight.current || writesInFlight.current > 0) return;
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setError("Allow a new tab to open in FaBrary, then try again.");
      return;
    }
    popup.opener = null;
    exportInFlight.current = true;
    setExporting(true);
    setError(null);
    try {
      const version = await decks.saveVersion(deck.id);
      setLatestVersion(version);
      popup.location.href = fabraryImportLink(
        version.snapshot.hero,
        version.snapshot.name,
        version.snapshot.cards.map((card) => ({
          card: { name: card.name },
          variant: { pitch: card.pitch },
          quantity: card.quantity,
        })),
      );
    } catch {
      popup.close();
      setError("Couldn't save a version. Try opening in FaBrary again.");
    } finally {
      exportInFlight.current = false;
      setExporting(false);
    }
  }

  /** A card's deck row or sideboard row. */
  const rowOf = (variantId: string, sideboard: boolean) =>
    deck?.cards.find(
      (c) => c.variantId === variantId && c.sideboard === sideboard,
    );
  /** Copies of a card in the deck and in the sideboard. */
  const copiesOf = (variantId: string) => ({
    deck: rowOf(variantId, false)?.quantity ?? 0,
    sideboard: rowOf(variantId, true)?.quantity ?? 0,
  });
  const copiesInPool = (variantId: string) => {
    const c = copiesOf(variantId);
    return c.deck + c.sideboard;
  };

  const limitOf = (card: CardSummary) =>
    rules ? copyLimitFor(card, rules) : Infinity;
  const limitOfVariant = (variantId: string) => {
    const found = byVariant.get(variantId);
    return found ? limitOf(found.card) : Infinity;
  };
  const atLimit = (variantId: string) =>
    copiesInPool(variantId) >= limitOfVariant(variantId);

  /** One more copy in the deck, or in the sideboard. */
  function add(variantId: string, sideboard = false) {
    if (atLimit(variantId)) return;
    void setCard({
      variantId,
      quantity: (rowOf(variantId, sideboard)?.quantity ?? 0) + 1,
      sideboard,
    });
  }

  /**
   * One copy across, deck to sideboard or back. The copy is added on the other side first, so a
   * matchup plan never loses it in between.
   */
  function moveOne(variantId: string, toSideboard: boolean) {
    const from = rowOf(variantId, !toSideboard);
    if (!from) return;
    void setCards(
      {
        variantId,
        quantity: (rowOf(variantId, toSideboard)?.quantity ?? 0) + 1,
        sideboard: toSideboard,
      },
      { ...from, quantity: from.quantity - 1 },
    );
  }

  const pitch = useMemo(
    () => analyseDeck({ entries, dimensions: [], scores: new Map() }).pitch,
    [entries],
  );

  const availability = useCardAvailability(entries);
  const [sortBy, setSortBy] = useState<"pitch" | "availability">("pitch");
  const [onlyRarely, setOnlyRarely] = useState(false);

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
  // The plan being played, if any: its cards are the main deck for goldfish and scenarios.
  const playing = vs ? plans.matchups.find((m) => m.heroId === vs) : undefined;
  const playEntries = playing
    ? entriesForMatchup(entries, playing.cards)
    : entries;
  const onSet = canEdit ? (card: DeckCard) => void setCard(card) : undefined;
  const onMove = canEdit ? moveOne : undefined;
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
        // The matchup being played carries between goldfish and scenarios.
        ...(vs && (next.tab === "goldfish" || next.tab === "scenarios")
          ? { vs }
          : {}),
      },
    });
  const setTab = (next: Tab) => go({ tab: next, view });
  const setView = (next: View) => go({ tab, view: next });

  return (
    <>
      <Link to="/decks">← Decks</Link>
      <header className={styles.deckHeader}>
        <div className={styles.deckTitleRow}>
          <h1>{deck.name}</h1>
          <div className={styles.deckActions}>
            {/* FaBrary's import form, filled in; the player presses Import there. */}
            {canEdit ? (
              <button
                type="button"
                className={styles.fabraryLink}
                disabled={exporting || pendingWrites > 0}
                onClick={() => void openInFabrary()}
              >
                {exporting ? "Saving version…" : "Open in FaBrary"}{" "}
                <span aria-hidden="true">↗</span>
              </button>
            ) : (
              <a
                className={styles.fabraryLink}
                href={fabraryImportLink(HERO, deck.name, entries)}
                target="_blank"
                rel="noreferrer"
              >
                Open in FaBrary <span aria-hidden="true">↗</span>
              </a>
            )}
            {canEdit && (
              <DeckSettings
                deck={deck}
                onChange={(patch) => setDeck({ ...deck, ...patch })}
                onDeleted={() => void navigate({ to: "/decks" })}
              />
            )}
          </div>
        </div>
        <div className={styles.deckStatusRow}>
          <p className={styles.deckStatus}>
            {canEdit ? (
              <Tag tone={deck.isPublic ? "accent" : "neutral"}>
                {deck.isPublic ? "Public" : "Private"}
              </Tag>
            ) : (
              <Tag>Read only</Tag>
            )}
            {rules && problems.length === 0 && <Tag tone="accent">Legal</Tag>}
            {!canEdit && deck.ownerName && (
              <span className={styles.meta}>by {deck.ownerName}</span>
            )}
            <span className={styles.meta}>
              {counts.deck} deck cards · {counts.sideboard} sideboard ·{" "}
              {counts.pool} in the pool
            </span>
          </p>
          <PitchBar pitch={pitch} />
        </div>
      </header>

      {error && <p role="alert">{error}</p>}
      {canEdit && (
        <DeckVersions
          key={deck.id}
          deckId={deck.id}
          latest={latestVersion?.deckId === deck.id ? latestVersion : null}
        />
      )}
      {problems.length > 0 && (
        <ul className={styles.problems}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

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
        {/* What goldfish and scenarios play: the main deck, or a matchup plan (the maintainer,
            20 Oct 2026: always on offer, with each list's card count). */}
        {(tab === "goldfish" || tab === "scenarios") && (
          <div className={styles.playing}>
            <label>
              <span>Playing</span>
              <select
                value={playing?.heroId ?? ""}
                onChange={(e) =>
                  void navigate({
                    to: ".",
                    replace: true,
                    resetScroll: false,
                    search: {
                      tab,
                      // The same shuffle, with or without the plan, to compare.
                      ...(seed !== undefined ? { seed } : {}),
                      ...(e.target.value ? { vs: e.target.value } : {}),
                    },
                  })
                }
              >
                <option value="">{`Main deck · ${deckCount(entries)} cards`}</option>
                {plans.matchups.map((m) => (
                  <option key={m.id} value={m.heroId}>
                    {`vs ${plans.heroes.find((h) => h.id === m.heroId)?.name ?? "an unknown hero"} · ${deckCount(entriesForMatchup(entries, m.cards))} cards`}
                  </option>
                ))}
              </select>
            </label>
            {canEdit && plans.matchups.length === 0 && (
              <Link to="." search={{ tab: "matchups" }}>
                Plan a matchup
              </Link>
            )}
          </div>
        )}
        {tab === "goldfish" ? (
          <Goldfish
            key={playing ? playing.id : "main"}
            entries={playEntries}
            seed={seed}
            side={side}
            log={log}
            fixed={fixed}
            heroImages={viseraiImages(plans.heroes)}
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
          <DeckScenarios
            key={playing ? playing.id : "main"}
            deckId={deckId}
            entries={playEntries}
            mode={mode === "create" ? "create" : "run"}
            onMode={(next) =>
              void navigate({
                to: ".",
                replace: true,
                resetScroll: false,
                search: {
                  tab: "scenarios",
                  ...(vs ? { vs } : {}),
                  ...(next === "create" ? { mode: "create" as const } : {}),
                },
              })
            }
          />
        ) : tab === "matchups" ? (
          <MatchupsPanel
            deckId={deckId}
            entries={entries}
            canEdit={canEdit}
            deckSize={rules?.deckMin}
          />
        ) : tab === "gaps" ? (
          <DeckGapsPanel
            entries={entries}
            pool={cards}
            onAdd={
              canEdit
                ? (variantId) =>
                    void setCard({ variantId, quantity: 1, sideboard: false })
                : undefined
            }
          />
        ) : tab === "stats" ? (
          <>
            <DeckAnalysisPanel
              entries={entries}
              pitchTargets={deck.pitchTargets ?? {}}
              onTargetsChange={
                canEdit ? (t) => void setPitchTargets(t) : undefined
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
                  copiesOf={copiesOf}
                  atLimit={atLimit}
                  limitOf={limitOfVariant}
                  onAdd={(id, toSideboard) => add(id, !!toSideboard)}
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
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  disabled={availability.running || !availability.canRun}
                  onClick={availability.start}
                >
                  {availability.running
                    ? "Working it out…"
                    : "Work out availability"}
                </button>
                <select
                  aria-label="Sort the deck"
                  disabled={!availability.byCard}
                  value={availability.byCard ? sortBy : "pitch"}
                  onChange={(ev) =>
                    setSortBy(ev.target.value as "pitch" | "availability")
                  }
                >
                  <option value="pitch">Pitch, then name</option>
                  <option value="availability">
                    Availability, lowest first
                  </option>
                </select>
                <label>
                  <input
                    type="checkbox"
                    disabled={!availability.byCard}
                    checked={!!availability.byCard && onlyRarely}
                    onChange={(ev) => setOnlyRarely(ev.target.checked)}
                  />{" "}
                  {`Only rarely available (under ${RARELY_BELOW * 100}%)`}
                </label>
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
                  onMove={onMove}
                  copiesInPool={copiesInPool}
                />
                <PoolSection
                  title="Deck"
                  heading={`Deck ${counts.deck}`}
                  entries={
                    availability.byCard && onlyRarely
                      ? rarelyAvailable(ofSection("deck"), availability.byCard)
                      : ofSection("deck")
                  }
                  availability={availability.byCard ?? undefined}
                  byAvailability={sortBy === "availability"}
                  limitOf={limitOf}
                  view={view}
                  onSet={onSet}
                  onMove={onMove}
                  copiesInPool={copiesInPool}
                />
                <PoolSection
                  title="Sideboard"
                  entries={entries.filter((e) => e.sideboard)}
                  limitOf={limitOf}
                  view={view}
                  onSet={onSet}
                  onMove={onMove}
                  copiesInPool={copiesInPool}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Stacked red / yellow / blue (and purple, when there is some) bar with counts, for the deck header. */
function PitchBar({ pitch }: { pitch: PitchCounts }) {
  const shown = pitchesShown(pitch) as (keyof PitchCounts)[];
  const total = shown.reduce((n, p) => n + pitch[p], 0);
  return (
    <div
      role="img"
      aria-label={`Pitch: ${shown
        .map((p) => `${pitch[p]} ${pitchName(p).toLowerCase()}`)
        .join(", ")}`}
      className={styles.pitchBar}
    >
      <div className={styles.pitchBarTrack}>
        {shown.map((p) =>
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
        {shown.map((p) => (
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
  /** Worked-out availability, shown on each card that has a condition. */
  availability?: Map<string, CardAvailability>;
  /** Sort by availability, lowest first, instead of by pitch. */
  byAvailability?: boolean;
  /** Changes a card; without it (someone else's deck) the section is read only. */
  onSet?: (card: DeckCard) => void;
  /** Moves one copy between the deck and the sideboard. */
  onMove?: (variantId: string, toSideboard: boolean) => void;
  /** Copies in the deck and the sideboard together, for the copy limit. */
  copiesInPool: (variantId: string) => number;
}) {
  const { title, entries, limitOf, view, onSet } = props;
  const rank = (e: DeckEntry) =>
    props.order === "gear"
      ? sectionOf(e.card) === "weapon"
        ? -1
        : SLOTS.indexOf(slotOf(e.card) ?? "Off-Hand")
      : (e.variant.pitch ?? 99);
  // Alphabetical within each pitch (or slot).
  const sorted =
    props.byAvailability && props.availability
      ? sortByAvailability(entries, props.availability)
      : [...entries].sort(
          (a, b) => rank(a) - rank(b) || a.card.name.localeCompare(b.card.name),
        );
  const badge = (e: DeckEntry) => {
    const a = props.availability?.get(e.card.id);
    return a ? (
      <span
        className={styles.muted}
        title={a.conditions
          .map((c) => `${c.plain}: ${Math.round(c.rate * 100)}%`)
          .join("\n")}
      >
        {`available ${Math.round(a.rate * 100)}%`}
      </span>
    ) : null;
  };
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
    const full = props.copiesInPool(e.variant.id) >= limit;
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
        {props.onMove && (
          <button
            type="button"
            className={styles.sideboard}
            aria-label={`Move one ${label} to the ${e.sideboard ? "deck" : "sideboard"}`}
            title={
              e.sideboard
                ? "Move one copy to the deck"
                : "Move one copy to the sideboard"
            }
            onClick={() => props.onMove?.(e.variant.id, !e.sideboard)}
          >
            {e.sideboard ? "→ Deck" : "→ SB"}
          </button>
        )}
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
              {badge(e)}
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
                {badge(e)}
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
