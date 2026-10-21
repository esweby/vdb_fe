// Matchups (the maintainer, 19 Oct 2026): per-hero board plans. Pick an opposing hero; the plan
// starts as the main deck; board cards in from the sideboard and out of the main deck. A plan is
// one of the deck's loadouts, kept within the deck's pool, and private to the deck's owner.
import { useEffect, useMemo, useState } from "react";
import { useServices } from "../servicesContext.ts";
import { Button } from "../ui/index.ts";
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

/** In and out against the main deck, by card. */
export function boardChanges(
  entries: DeckEntry[],
  plan: Map<string, number>,
): { name: string; delta: number }[] {
  const inDeck = mainPlan(entries);
  return poolEntries(entries)
    .map((e) => {
      const main = inDeck.get(e.variant.id) ?? 0;
      return {
        name: variantName(e.card, e.variant),
        delta: (plan.get(e.variant.id) ?? 0) - main,
      };
    })
    .filter((c) => c.delta !== 0);
}

const mainPlan = (entries: DeckEntry[]) =>
  new Map(
    entries.filter((e) => !e.sideboard).map((e) => [e.variant.id, e.quantity]),
  );

export function MatchupsPanel(props: {
  deckId: string;
  entries: DeckEntry[];
  canEdit: boolean;
  /** The deck size the format asks for (60), for "Deck · 58/60 cards". */
  deckSize?: number;
}) {
  const { decks } = useServices();
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!props.canEdit) return;
    let live = true;
    Promise.all([decks.listHeroes(), decks.listMatchups(props.deckId)]).then(
      ([h, m]) => {
        if (!live) return;
        setHeroes(h);
        setMatchups(m);
        setLoaded(true);
      },
      () => live && setError("Couldn't load the matchups."),
    );
    return () => {
      live = false;
    };
  }, [decks, props.deckId, props.canEdit]);

  const heroName = (id: string) =>
    heroes.find((h) => h.id === id)?.name ?? "an unknown hero";
  const planOf = (m: Matchup) =>
    new Map(m.cards.map((c) => [c.variantId, c.quantity]));
  // Weapons and equipment first, in a group of their own, then the cards by name.
  const isGear = (e: DeckEntry) => sectionOf(e.card) !== "deck";
  // Gear in slot order, as on the mat: weapon, off-hand, head, chest, arms, legs (the
  // maintainer, 20 Oct 2026); then the cards.
  const GEAR_ORDER = ["Off-Hand", "Head", "Chest", "Arms", "Legs"];
  const rank = (e: DeckEntry) =>
    !isGear(e)
      ? 10
      : sectionOf(e.card) === "weapon"
        ? 0
        : 1 + GEAR_ORDER.indexOf(slotOf(e.card) ?? "Head");
  const rows = useMemo(
    () =>
      poolEntries(props.entries).sort(
        (a, b) =>
          rank(a) - rank(b) ||
          variantName(a.card, a.variant).localeCompare(
            variantName(b.card, b.variant),
          ),
      ),
    [props.entries],
  );

  if (!props.canEdit)
    return (
      <section aria-label="Matchups" className={styles.matchups}>
        <h2>Matchups</h2>
        <p className={styles.muted}>
          Matchup plans are private to the deck's owner.
        </p>
        <RealMatchups />
      </section>
    );

  function open(id: string) {
    setHeroId(id);
    const saved = matchups.find((m) => m.heroId === id);
    setPlan(saved ? planOf(saved) : mainPlan(props.entries));
  }

  async function save() {
    if (!heroId) return;
    try {
      const saved = await decks.saveMatchup(
        props.deckId,
        heroId,
        [...plan].map(([variantId, quantity]) => ({ variantId, quantity })),
      );
      setMatchups((ms) => [...ms.filter((m) => m.id !== saved.id), saved]);
      setError(null);
    } catch {
      setError("Couldn't save the plan.");
    }
  }

  async function remove() {
    const saved = matchups.find((m) => m.heroId === heroId);
    if (!saved) {
      setHeroId(null);
      return;
    }
    try {
      await decks.deleteMatchup(saved.id);
      setMatchups((ms) => ms.filter((m) => m.id !== saved.id));
      setHeroId(null);
    } catch {
      setError("Couldn't delete the plan.");
    }
  }

  // What's in the deck for the matchup, and what's left in the sideboard.
  const inPlan = rows
    .map((e) => ({ e, copies: plan.get(e.variant.id) ?? 0 }))
    .filter((r) => r.copies > 0);
  const gearIn = inPlan.filter((r) => isGear(r.e));
  const cardsIn = inPlan.filter((r) => !isGear(r.e));
  const sideboard = rows
    .map((e) => ({ e, copies: e.quantity - (plan.get(e.variant.id) ?? 0) }))
    .filter((r) => r.copies > 0);
  const count = (list: { copies: number }[]) =>
    list.reduce((n, r) => n + r.copies, 0);
  const cardList = (
    label: string,
    shown: { e: DeckEntry; copies: number }[],
    side: "deck" | "sideboard",
  ) =>
    shown.length === 0 ? (
      <p className={styles.muted}>Nothing here.</p>
    ) : (
      <ul aria-label={label} className={styles.matchupCards}>
        {shown.map(({ e, copies }) => {
          const name = variantName(e.card, e.variant);
          const n = plan.get(e.variant.id) ?? 0;
          const set = (q: number) =>
            setPlan((p) => new Map(p).set(e.variant.id, q));
          return (
            <li
              key={e.variant.id}
              aria-label={name}
              data-gear={isGear(e) || undefined}
            >
              {e.variant.imageUrl ? (
                <img src={e.variant.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className={styles.matchupStandIn}>{name}</span>
              )}
              <span className={styles.matchupCount}>{`×${copies}`}</span>
              {side === "deck" ? (
                <button
                  type="button"
                  className={styles.matchupMove}
                  aria-label={`Board out a ${name}`}
                  title="Board out one copy"
                  onClick={() => set(n - 1)}
                >
                  →
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.matchupMove}
                  aria-label={`Board in a ${name}`}
                  title="Board in one copy"
                  onClick={() => set(n + 1)}
                >
                  ←
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );

  const changes = boardChanges(props.entries, plan);
  const ins = changes.filter((c) => c.delta > 0);
  const outs = changes.filter((c) => c.delta < 0);
  const mainCount = props.entries
    .filter((e) => sectionOf(e.card) === "deck")
    .reduce((n, e) => n + (plan.get(e.variant.id) ?? 0), 0);
  const unplanned = heroes.filter(
    (h) => !matchups.some((m) => m.heroId === h.id),
  );

  return (
    <section aria-label="Matchups" className={styles.matchups}>
      <header>
        <h2>Matchups</h2>
        <p className={styles.muted}>
          A plan for each hero you might face: which cards come in from the
          sideboard and which go out. Goldfish and scenarios can play a plan.
        </p>
      </header>

      {matchups.length > 0 && (
        <ul aria-label="Planned matchups" className={styles.matchupList}>
          {matchups.map((m) => {
            const c = boardChanges(props.entries, planOf(m));
            const inN = c
              .filter((x) => x.delta > 0)
              .reduce((n, x) => n + x.delta, 0);
            const outN = c
              .filter((x) => x.delta < 0)
              .reduce((n, x) => n - x.delta, 0);
            const label = `vs ${heroName(m.heroId)}`;
            return (
              <li key={m.id}>
                <span>{`${label} · in ${inN} · out ${outN}`}</span>
                <Button
                  variant="ghost"
                  aria-label={`Open ${label}`}
                  onClick={() => open(m.heroId)}
                >
                  Open
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {loaded && heroes.length === 0 ? (
        <p className={styles.muted}>
          No heroes to plan against yet: the hero list hasn't been imported.
        </p>
      ) : (
        <label className={styles.matchupPick}>
          <span>Plan against</span>
          <select
            value=""
            onChange={(e) => e.target.value && open(e.target.value)}
          >
            <option value="">Choose a hero…</option>
            {unplanned.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p role="alert">{error}</p>}

      {heroId && (
        <section
          aria-label={`vs ${heroName(heroId)}`}
          className={styles.matchupPlan}
        >
          <h3>{`vs ${heroName(heroId)}`}</h3>
          <p>
            {changes.length === 0
              ? "Same as the main deck."
              : [
                  ins.length
                    ? `In: ${ins.map((c) => `${c.name} ×${c.delta}`).join(", ")}`
                    : "",
                  outs.length
                    ? `Out: ${outs.map((c) => `${c.name} ×${-c.delta}`).join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
          <p className={styles.muted}>
            {`${mainCount} cards in the main deck for this matchup`}
          </p>
          <div className={styles.matchupBoard}>
            <section className={styles.matchupSide}>
              {gearIn.length > 0 && (
                <>
                  <h4>{`Weapons and equipment · ${count(gearIn)}`}</h4>
                  {cardList("Weapons and equipment", gearIn, "deck")}
                </>
              )}
              <h4>
                {props.deckSize
                  ? `Deck · ${count(cardsIn)}/${props.deckSize} cards`
                  : `Deck · ${count(cardsIn)} cards`}
              </h4>
              {cardList("Deck for this matchup", cardsIn, "deck")}
            </section>
            <section className={styles.matchupSide}>
              <h4>{`Sideboard · ${count(sideboard)}`}</h4>
              {cardList("Sideboard", sideboard, "sideboard")}
            </section>
          </div>
          <div className={styles.matchupActions}>
            <Button variant="primary" onClick={() => void save()}>
              Save plan
            </Button>
            <Button variant="ghost" onClick={() => void remove()}>
              Delete plan
            </Button>
          </div>
        </section>
      )}

      <RealMatchups />
    </section>
  );
}
