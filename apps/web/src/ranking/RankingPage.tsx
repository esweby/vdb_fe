import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import type { Deck, DeckSummary } from "../decks/deckRepository.ts";
import { cardFacets } from "../cards/facets.ts";
import { useCards } from "../cards/useCards.ts";
import { applyFilters } from "../filters/applyFilters.ts";
import { FilteredLayout } from "../filters/FilteredLayout.tsx";
import { FilterSidebar } from "../filters/FilterSidebar.tsx";
import { fromSearch, toSearch } from "../filters/urlState.ts";
import { useAppSelector } from "../hooks.ts";
import type { Dimension, ScoreRow } from "../scoring/scoreRepository.ts";
import { useServices } from "../servicesContext.ts";
import { Button, Slider, Tag } from "../ui/index.ts";
import { rankVariants, type CommunityRow, type RankedVariant } from "./rank.ts";
import {
  readRankingSearch,
  writeRankingSearch,
  type RankingSettings,
} from "./rankingSearch.ts";
import styles from "./RankingPage.module.css";

const route = getRouteApi("/ranking");
const facets = cardFacets();
const SLOTS = ["Head", "Chest", "Arms", "Legs", "Off-Hand"];

interface Data {
  dimensions: Dimension[];
  community: CommunityRow[];
  minRatingCount: number;
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
}

const label = (r: RankedVariant, multiPitch: boolean) =>
  multiPitch ? `${r.name} (pitch ${r.pitch ?? "–"})` : r.name;

export function RankingPage() {
  const { status, items } = useCards();
  const { scores, decks } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const search = route.useSearch();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const deckId = typeof search.deck === "string" ? search.deck : undefined;
  const [deckList, setDeckList] = useState<DeckSummary[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    decks.listDecks().then(
      (d) => live && setDeckList(d),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks, user]);

  useEffect(() => {
    if (!user || !deckId) {
      setDeck(null);
      return;
    }
    let live = true;
    decks.getDeck(deckId).then(
      (d) => live && setDeck(d),
      (e) => live && setDeckError(String(e.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [decks, user, deckId]);

  useEffect(() => {
    let live = true;
    void Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
      user ? scores.listAllMyScores(user.id) : Promise.resolve(null),
      user ? scores.listMyReviewedCardIds(user.id) : Promise.resolve(null),
    ]).then(([dimensions, community, minRatingCount, myRows, reviewed]) => {
      if (!live) return;
      setData({
        dimensions,
        community,
        minRatingCount,
        mine:
          myRows && reviewed
            ? { rows: myRows, reviewedCardIds: new Set(reviewed) }
            : undefined,
      });
    });
    return () => {
      live = false;
    };
  }, [scores, user]);

  const settings = readRankingSearch(
    search,
    data?.dimensions.map((d) => d.key) ?? [],
  );
  const filterState = fromSearch(search);
  const update = (
    patch: Partial<RankingSettings>,
    filters = filterState,
    deckChoice = deckId,
  ) =>
    void navigate({
      to: ".",
      replace: true,
      search: {
        ...writeRankingSearch({ ...settings, ...patch }),
        ...toSearch(filters),
        ...(deckChoice ? { deck: deckChoice } : {}),
      },
    });

  const candidates = useMemo(
    () => applyFilters(items, facets, filterState),
    [items, JSON.stringify(filterState)],
  );
  const cardsById = useMemo(
    () => new Map(items.map((c) => [c.id, c])),
    [items],
  );

  const ranked = useMemo(() => {
    if (!data) return [];
    return rankVariants({
      variants: candidates.flatMap((c) =>
        c.variants.map((v) => ({
          cardId: c.id,
          variantId: v.id,
          name: c.name,
          pitch: v.pitch,
        })),
      ),
      dimensions: data.dimensions,
      community: data.community,
      mine: data.mine,
      priorities: settings.priorities,
      sourceBlend: data.mine ? settings.sourceBlend : 100,
      sideFocus: settings.sideFocus,
      minRatingCount: data.minRatingCount,
    });
  }, [data, candidates, JSON.stringify(settings)]);

  if (status !== "loaded" || !data) return <p>Loading…</p>;

  const typeOf = (r: RankedVariant) => cardsById.get(r.cardId) as CardSummary;
  const isGear = (r: RankedVariant) =>
    ["weapon", "equipment"].includes(typeOf(r).type);
  const multiPitch = (r: RankedVariant) => typeOf(r).variants.length > 1;
  const excluded = new Set(settings.excluded);
  const pinned = settings.pinned;
  const inDeck = new Map(
    (deck?.cards ?? []).map((c) => [c.variantId, c.quantity]),
  );
  // README "Suggested core": cards in the deck being built count as pinned.
  const pinnedOrInDeck = [
    ...pinned,
    ...[...inDeck.keys()].filter((id) => !pinned.includes(id)),
  ];

  async function addToDeck(variantId: string) {
    if (!deck) return;
    const existing = deck.cards.find((c) => c.variantId === variantId);
    const card = {
      variantId,
      quantity: (existing?.quantity ?? 0) + 1,
      sideboard: existing?.sideboard ?? false,
    };
    const previous = deck;
    setDeck({
      ...deck,
      cards: [...deck.cards.filter((c) => c.variantId !== variantId), card],
    });
    try {
      await decks.setCard(deck.id, card);
    } catch (e) {
      setDeck(previous);
      setDeckError(
        `Couldn't add to the deck: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  const addButton = (variantId: string, name: string) =>
    deck && (
      <Button
        variant="ghost"
        onClick={() => void addToDeck(variantId)}
        aria-label={`Add ${name} to ${deck.name}`}
      >
        Add
      </Button>
    );
  const inDeckTag = (variantId: string) =>
    inDeck.has(variantId) && (
      <Tag tone="accent">{inDeck.get(variantId)} in deck</Tag>
    );

  const deckRows = ranked.filter(
    (r) => !isGear(r) && !excluded.has(r.variantId),
  );
  const ordered = [
    ...pinnedOrInDeck
      .map((id) => deckRows.find((r) => r.variantId === id))
      .filter((r): r is RankedVariant => !!r),
    ...deckRows.filter((r) => !pinnedOrInDeck.includes(r.variantId)),
  ];
  const excludedRows = ranked.filter((r) => excluded.has(r.variantId));
  const gear = ranked.filter((r) => isGear(r) && !excluded.has(r.variantId));
  const gearGroups = [
    { title: "Weapons", rows: gear.filter((r) => typeOf(r).type === "weapon") },
    ...SLOTS.map((slot) => ({
      title: slot,
      rows: gear.filter((r) => typeOf(r).subtypes.includes(slot)),
    })),
  ].filter((g) => g.rows.length > 0);

  const togglePin = (id: string) =>
    update({
      pinned: pinned.includes(id)
        ? pinned.filter((p) => p !== id)
        : [...pinned, id],
    });
  const exclude = (id: string) =>
    update({
      excluded: [...settings.excluded, id],
      pinned: pinned.filter((p) => p !== id),
    });
  const restore = (id: string) =>
    update({ excluded: settings.excluded.filter((e) => e !== id) });

  return (
    <>
      <h1>Ranking</h1>
      <FilteredLayout
        state={filterState}
        onClear={() => update({}, {})}
        sidebar={
          <FilterSidebar
            items={items}
            facets={facets}
            state={filterState}
            onChange={(next) => update({}, next)}
          />
        }
      >
        <section className={styles.controls} aria-label="Priorities">
          <h2>Your priorities</h2>
          <div className={styles.sliders}>
            {data.dimensions.map((d) => (
              <Slider
                key={d.id}
                label={d.label}
                value={settings.priorities[d.key] ?? 50}
                onChange={(v) =>
                  update({ priorities: { ...settings.priorities, [d.key]: v } })
                }
              />
            ))}
          </div>
          <div className={styles.sliders}>
            {data.mine && (
              <Slider
                label="Whose scores (mine ← → community)"
                value={settings.sourceBlend}
                onChange={(v) => update({ sourceBlend: v })}
              />
            )}
            <Slider
              label="Side focus (Forsaken ← → Usurper)"
              value={settings.sideFocus}
              onChange={(v) => update({ sideFocus: v })}
            />
            <label className={styles.core}>
              Core size
              <input
                type="number"
                min={1}
                max={80}
                value={settings.coreSize}
                onChange={(e) =>
                  update({ coreSize: Number(e.target.value) || 1 })
                }
              />
            </label>
          </div>
        </section>

        {user && (
          <div className={styles.deckChoice}>
            <label>
              Add to deck{" "}
              <select
                value={deckId ?? ""}
                onChange={(e) =>
                  update({}, filterState, e.target.value || undefined)
                }
              >
                <option value="">None</option>
                {deckList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {deck && (
              <Link to="/decks/$deckId" params={{ deckId: deck.id }}>
                Open {deck.name}
              </Link>
            )}
            {deckList.length === 0 && <Link to="/decks">Create a deck</Link>}
            {deckError && <p role="alert">{deckError}</p>}
          </div>
        )}

        <p className={styles.note}>
          Cards need at least {data.minRatingCount} community ratings (or your
          own review) to be ranked. Synergy joins the ranking in phase two.
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Ranked by your priorities</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Card</th>
                <th scope="col">Value</th>
                <th scope="col">Ratings</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No ranked cards match. Cards appear once they're reviewed.
                  </td>
                </tr>
              )}
              {ordered.map((r, i) => {
                const name = label(r, multiPitch(r));
                const inCore = i < settings.coreSize;
                const isPinned = pinned.includes(r.variantId);
                return (
                  <tr
                    key={r.variantId}
                    className={inCore ? styles.coreRow : undefined}
                  >
                    <td>{i + 1}</td>
                    <td>
                      <Link to="/cards/$cardId" params={{ cardId: r.cardId }}>
                        {name}
                      </Link>{" "}
                      {inCore && <Tag tone="accent">Core</Tag>}{" "}
                      {isPinned && <Tag>Pinned</Tag>} {inDeckTag(r.variantId)}
                    </td>
                    <td>{r.value}</td>
                    <td>{r.ratingCount || "mine"}</td>
                    <td className={styles.actions}>
                      {addButton(r.variantId, name)}
                      <Button
                        variant="ghost"
                        onClick={() => togglePin(r.variantId)}
                        aria-label={`${isPinned ? "Unpin" : "Pin"} ${name}`}
                      >
                        {isPinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => exclude(r.variantId)}
                        aria-label={`Exclude ${name}`}
                      >
                        Exclude
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {excludedRows.length > 0 && (
          <section>
            <h2>Excluded</h2>
            <ul>
              {excludedRows.map((r) => {
                const name = label(r, multiPitch(r));
                return (
                  <li key={r.variantId}>
                    {name}{" "}
                    <Button
                      variant="ghost"
                      onClick={() => restore(r.variantId)}
                      aria-label={`Restore ${name}`}
                    >
                      Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {gearGroups.length > 0 && (
          <section>
            <h2>Weapons and equipment</h2>
            <p className={styles.note}>
              They don't take deck space, so they're ranked by slot.
            </p>
            <div className={styles.gear}>
              {gearGroups.map((g) => (
                <table key={g.title} className={styles.table}>
                  <caption>{g.title}</caption>
                  <tbody>
                    {g.rows.slice(0, 3).map((r) => (
                      <tr key={r.variantId}>
                        <td>
                          <Link
                            to="/cards/$cardId"
                            params={{ cardId: r.cardId }}
                          >
                            {r.name}
                          </Link>{" "}
                          {inDeckTag(r.variantId)}
                        </td>
                        <td>{r.value}</td>
                        <td className={styles.actions}>
                          {addButton(r.variantId, r.name)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </section>
        )}
      </FilteredLayout>
    </>
  );
}
