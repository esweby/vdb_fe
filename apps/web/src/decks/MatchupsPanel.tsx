import { useEffect, useMemo, useState } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, Dialog, Loading, TextField } from "../ui/index.ts";
import { RealMatchups } from "../fablazing/RealGames.tsx";
import type { Hero, Matchup } from "./deckRepository.ts";
import {
  poolEntries,
  sectionOf,
  slotOf,
  variantName,
  type DeckEntry,
} from "./deckRules.ts";
import styles from "./Decks.module.css";

export function boardChanges(
  entries: DeckEntry[],
  plan: Map<string, number>,
): { name: string; delta: number }[] {
  const inDeck = mainPlan(entries);
  return poolEntries(entries)
    .map((entry) => ({
      name: variantName(entry.card, entry.variant),
      delta:
        (plan.get(entry.variant.id) ?? 0) - (inDeck.get(entry.variant.id) ?? 0),
    }))
    .filter((change) => change.delta !== 0);
}

const mainPlan = (entries: DeckEntry[]) =>
  new Map(
    entries
      .filter((entry) => !entry.sideboard)
      .map((entry) => [entry.variant.id, entry.quantity]),
  );
const isGear = (entry: DeckEntry) => sectionOf(entry.card) !== "deck";
const GEAR_ORDER = ["Off-Hand", "Head", "Chest", "Arms", "Legs"];
const rank = (entry: DeckEntry) =>
  !isGear(entry)
    ? 10
    : sectionOf(entry.card) === "weapon"
      ? 0
      : 1 + GEAR_ORDER.indexOf(slotOf(entry.card) ?? "Head");

export function MatchupsPanel(props: {
  deckId: string;
  entries: DeckEntry[];
  canEdit: boolean;
  deckSize?: number;
}) {
  const { decks } = useServices();
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [heroId, setHeroId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Map<string, number>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<{ id: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [view, setView] = useState<"rows" | "pictures">("rows");
  const [showReal, setShowReal] = useState(false);
  const busy = saveState === "saving";

  function loadDraft(saved: Matchup | null) {
    setSelectedId(saved?.id ?? null);
    setName(saved?.name ?? "");
    setHeroId(saved?.heroId ?? null);
    setPlan(
      saved
        ? new Map(saved.cards.map((card) => [card.variantId, card.quantity]))
        : mainPlan(props.entries),
    );
    setDirty(false);
    setError(null);
    setNameError(null);
    setSaveState("idle");
  }

  useEffect(() => {
    if (!props.canEdit) return;
    let live = true;
    setLoaded(false);
    setError(null);
    Promise.all([decks.listHeroes(), decks.listMatchups(props.deckId)]).then(
      ([nextHeroes, nextMatchups]) => {
        if (!live) return;
        setHeroes(nextHeroes);
        setMatchups(nextMatchups);
        loadDraft(nextMatchups[0] ?? null);
        setLoaded(true);
      },
      () => live && setError("Couldn't load the plans."),
    );
    return () => {
      live = false;
    };
  }, [decks, props.deckId, props.canEdit, attempt]);

  const rows = useMemo(
    () =>
      poolEntries(props.entries).sort(
        (first, second) =>
          rank(first) - rank(second) ||
          variantName(first.card, first.variant).localeCompare(
            variantName(second.card, second.variant),
          ),
      ),
    [props.entries],
  );

  function edit() {
    setDirty(true);
    setSaveState("idle");
  }
  function open(id: string | null) {
    if (id !== null && id === selectedId) return;
    if (dirty) {
      setPending({ id });
      return;
    }
    loadDraft(matchups.find((matchup) => matchup.id === id) ?? null);
  }

  async function save() {
    const nextName = name.trim();
    if (!nextName || nextName.length > 80) {
      setNameError("Give the plan a name of 1 to 80 characters.");
      return;
    }
    setSaveState("saving");
    try {
      const saved = await decks.saveMatchup(props.deckId, {
        ...(selectedId ? { id: selectedId } : {}),
        name: nextName,
        heroId,
        cards: [...plan].map(([variantId, quantity]) => ({
          variantId,
          quantity,
        })),
      });
      setMatchups((current) => [
        ...current.filter((matchup) => matchup.id !== saved.id),
        saved,
      ]);
      setSelectedId(saved.id);
      setName(saved.name);
      setError(null);
      setNameError(null);
      setDirty(false);
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      setError("Couldn't save the plan. Your changes are still here.");
    }
  }

  async function remove() {
    if (!selectedId) return;
    setSaveState("saving");
    try {
      await decks.deleteMatchup(selectedId);
      const remaining = matchups.filter((matchup) => matchup.id !== selectedId);
      setMatchups(remaining);
      setConfirmDelete(false);
      loadDraft(remaining[0] ?? null);
    } catch {
      setConfirmDelete(false);
      setSaveState("idle");
      setError("Couldn't delete the plan.");
    }
  }

  const inPlan = rows
    .map((entry) => ({ entry, copies: plan.get(entry.variant.id) ?? 0 }))
    .filter((row) => row.copies > 0);
  const sideboard = rows
    .map((entry) => ({
      entry,
      copies: entry.quantity - (plan.get(entry.variant.id) ?? 0),
    }))
    .filter((row) => row.copies > 0);
  const cardsIn = inPlan.filter((row) => !isGear(row.entry));
  const cardsOut = sideboard.filter((row) => !isGear(row.entry));
  const gearIn = inPlan.filter((row) => isGear(row.entry));
  const gearOut = sideboard.filter((row) => isGear(row.entry));
  const count = (shown: { copies: number }[]) =>
    shown.reduce((total, row) => total + row.copies, 0);
  const changes = boardChanges(props.entries, plan);
  const ins = changes.filter((change) => change.delta > 0);
  const outs = changes.filter((change) => change.delta < 0);
  const mainCount = count(cardsIn);

  const cardList = (
    label: string,
    shown: typeof inPlan,
    side: "deck" | "sideboard",
  ) =>
    shown.length === 0 ? (
      <p className={styles.muted}>Nothing here.</p>
    ) : (
      <ul aria-label={label} className={styles.matchupCards} data-view={view}>
        {shown.map(({ entry, copies }) => {
          const cardName = variantName(entry.card, entry.variant);
          return (
            <li key={entry.variant.id} aria-label={cardName}>
              {view === "pictures" &&
                (entry.variant.imageUrl ? (
                  <img src={entry.variant.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.matchupStandIn}>{cardName}</span>
                ))}
              {view === "rows" && (
                <span className={styles.matchupCardName}>{cardName}</span>
              )}
              <span className={styles.matchupCount}>{`×${copies}`}</span>
              <button
                type="button"
                disabled={busy}
                className={styles.matchupMove}
                aria-label={`${side === "deck" ? "Board out" : "Board in"} a ${cardName}`}
                onClick={() => {
                  const current = plan.get(entry.variant.id) ?? 0;
                  const next = current + (side === "deck" ? -1 : 1);
                  if (next < 0 || next > entry.quantity) return;
                  setPlan((previous) =>
                    new Map(previous).set(entry.variant.id, next),
                  );
                  edit();
                }}
              >
                {side === "deck" ? "Out →" : "← In"}
              </button>
            </li>
          );
        })}
      </ul>
    );

  const population = (
    <details
      className={styles.matchupPopulation}
      onToggle={(event) => setShowReal(event.currentTarget.open)}
    >
      <summary>Matchups in real games</summary>
      {showReal && <RealMatchups />}
    </details>
  );
  if (!props.canEdit)
    return (
      <section aria-label="Matchups" className={styles.matchups}>
        <h2>Matchups</h2>
        <p className={styles.muted}>
          Sideboard plans are private to the deck's owner.
        </p>
        <RealMatchups />
      </section>
    );

  return (
    <section aria-label="Matchups" className={styles.matchups}>
      <header>
        <h2>Sideboard plans</h2>
        <p className={styles.muted}>
          Name a plan for any opponent, or choose a hero. Goldfish and scenarios
          can play either.
        </p>
      </header>
      {error && (
        <p role="alert">
          {error}
          {!loaded && (
            <Button
              variant="ghost"
              onClick={() => setAttempt((previous) => previous + 1)}
            >
              Try again
            </Button>
          )}
        </p>
      )}
      {!loaded ? (
        !error && <Loading label="Loading the plans" />
      ) : (
        <div className={styles.matchupWorkspace}>
          <nav className={styles.matchupNav} aria-label="Saved sideboard plans">
            {matchups.length > 0 && (
              <ul aria-label="Planned matchups" className={styles.matchupList}>
                {matchups.map((matchup) => {
                  const differences = boardChanges(
                    props.entries,
                    new Map(
                      matchup.cards.map((card) => [
                        card.variantId,
                        card.quantity,
                      ]),
                    ),
                  );
                  const inCount = differences
                    .filter((change) => change.delta > 0)
                    .reduce((total, change) => total + change.delta, 0);
                  const outCount = differences
                    .filter((change) => change.delta < 0)
                    .reduce((total, change) => total - change.delta, 0);
                  return (
                    <li key={matchup.id}>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Open ${matchup.name}`}
                        aria-pressed={selectedId === matchup.id}
                        onClick={() => open(matchup.id)}
                      >
                        <span>{matchup.name}</span>
                        <small>
                          {matchup.heroId
                            ? (heroes.find((hero) => hero.id === matchup.heroId)
                                ?.name ?? "Hero plan")
                            : "Any opponent"}
                        </small>
                        <small>{`in ${inCount} · out ${outCount}`}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button disabled={busy} onClick={() => open(null)}>
              + New plan
            </Button>
          </nav>
          <section
            aria-label={name.trim() || "New plan"}
            className={styles.matchupPlan}
          >
            <div className={styles.matchupEditorHeader}>
              <h3>{name.trim() || "New plan"}</h3>
              <div className={styles.matchupActions}>
                <span
                  role="status"
                  className={
                    saveState === "saved" ? styles.saved : styles.muted
                  }
                >
                  {saveState === "saved"
                    ? "Plan saved"
                    : dirty
                      ? "Unsaved changes"
                      : ""}
                </span>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? "Saving…" : "Save plan"}
                </Button>
                {selectedId && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete plan
                  </Button>
                )}
              </div>
            </div>
            <div className={styles.matchupFields}>
              <TextField
                label="Plan name"
                value={name}
                maxLength={80}
                disabled={busy}
                error={nameError}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                  edit();
                }}
              />
              <label className={styles.matchupPick}>
                <span>Against</span>
                <select
                  value={heroId ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value || null;
                    setHeroId(next);
                    if (!name.trim() && next)
                      setName(
                        `vs ${heroes.find((hero) => hero.id === next)?.name ?? "hero"}`.slice(
                          0,
                          80,
                        ),
                      );
                    edit();
                  }}
                >
                  <option value="">No specific hero</option>
                  {heroId && !heroes.some((hero) => hero.id === heroId) && (
                    <option value={heroId}>
                      Current hero (no longer listed)
                    </option>
                  )}
                  {heroes.map((hero) => (
                    <option
                      key={hero.id}
                      value={hero.id}
                      disabled={matchups.some(
                        (matchup) =>
                          matchup.heroId === hero.id &&
                          matchup.id !== selectedId,
                      )}
                    >
                      {hero.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className={styles.matchupChanges}>
              {changes.length === 0
                ? "Same as the main deck."
                : [
                    ins.length
                      ? `In: ${ins.map((change) => `${change.name} ×${change.delta}`).join(", ")}`
                      : "",
                    outs.length
                      ? `Out: ${outs.map((change) => `${change.name} ×${-change.delta}`).join(", ")}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
            <div
              className={styles.matchupView}
              role="group"
              aria-label="Card view"
            >
              <Button
                variant="ghost"
                aria-pressed={view === "rows"}
                onClick={() => setView("rows")}
              >
                Rows
              </Button>
              <Button
                variant="ghost"
                aria-pressed={view === "pictures"}
                onClick={() => setView("pictures")}
              >
                Pictures
              </Button>
            </div>
            {(gearIn.length > 0 || gearOut.length > 0) && (
              <details className={styles.matchupGear}>
                <summary>Weapons and equipment</summary>
                <div className={styles.matchupBoard}>
                  <section>
                    <h4>{`Weapons and equipment · ${count(gearIn)}`}</h4>
                    {cardList("Weapons and equipment", gearIn, "deck")}
                  </section>
                  <section>
                    <h4>Spare weapons and equipment</h4>
                    {cardList(
                      "Spare weapons and equipment",
                      gearOut,
                      "sideboard",
                    )}
                  </section>
                </div>
              </details>
            )}
            <div className={styles.matchupBoard}>
              <section className={styles.matchupSide}>
                <h4>
                  {props.deckSize
                    ? `Deck · ${mainCount}/${props.deckSize} cards`
                    : `Deck · ${mainCount} cards`}
                </h4>
                {cardList("Deck for this matchup", cardsIn, "deck")}
              </section>
              <section className={styles.matchupSide}>
                <h4>{`Sideboard · ${count(cardsOut)}`}</h4>
                {cardList("Sideboard", cardsOut, "sideboard")}
              </section>
            </div>
            <p
              className={styles.muted}
            >{`${mainCount} cards in the main deck for this matchup`}</p>
            {props.deckSize && mainCount < props.deckSize && (
              <p
                className={styles.matchupWarning}
              >{`${props.deckSize - mainCount} below the ${props.deckSize}-card minimum.`}</p>
            )}
          </section>
        </div>
      )}
      {population}
      <Dialog
        title="Unsaved plan changes"
        open={pending !== null}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                loadDraft(
                  matchups.find((matchup) => matchup.id === pending?.id) ??
                    null,
                );
                setPending(null);
              }}
            >
              Discard changes
            </Button>
          </>
        }
      >
        <p>Switching plans will discard your unsaved changes.</p>
      </Dialog>
      <Dialog
        title={`Delete ${name}?`}
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        actions={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Keep it
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete it
            </Button>
          </>
        }
      >
        <p>
          This deletes the working plan. Copies saved in earlier versions stay
          as they were.
        </p>
      </Dialog>
    </section>
  );
}
