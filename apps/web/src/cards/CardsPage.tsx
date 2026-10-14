import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { applyFilters } from "../filters/applyFilters.ts";
import { FilteredLayout } from "../filters/FilteredLayout.tsx";
import { FilterBar } from "../filters/FilterBar.tsx";
import { FilterSidebar } from "../filters/FilterSidebar.tsx";
import { CardTile } from "../decks/CardTile.tsx";
import { useUrlFilters } from "../filters/useUrlFilters.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Table, TextField, type Column } from "../ui/index.ts";
import type { CardSummary } from "./cardRepository.ts";
import { cardFacets, pitchShown } from "./facets.ts";
import {
  classOf,
  searchAndSort,
  statText,
  TYPE_LABELS,
  type CardSort,
} from "./filterCards.ts";
import styles from "./CardsPage.module.css";
import { useCards } from "./useCards.ts";

const route = getRouteApi("/cards");

const pitches = (c: CardSummary) =>
  c.variants
    .map((v) => v.pitch)
    .filter((p): p is number => p !== null)
    .sort()
    .join(" ") || "–";

const columns: Column<CardSummary>[] = [
  {
    key: "name",
    header: "Name",
    render: (c) => (
      <Link to="/cards/$cardId" params={{ cardId: c.id }}>
        {c.name}
      </Link>
    ),
  },
  { key: "type", header: "Type", render: (c) => TYPE_LABELS[c.type] ?? c.type },
  { key: "class", header: "Class", render: classOf },
  { key: "pitch", header: "Pitch", render: pitches },
  { key: "cost", header: "Cost", render: (c) => statText(c, "cost") },
  { key: "power", header: "Power", render: (c) => statText(c, "power") },
  { key: "defense", header: "Defense", render: (c) => statText(c, "defense") },
];

export function CardsPage() {
  const { status, items, error } = useCards();
  const filters = useUrlFilters(route.useSearch());
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [reviewedCardIds, setReviewed] = useState<Set<string> | undefined>();

  useEffect(() => {
    if (!user) return setReviewed(undefined);
    let live = true;
    void scores
      .listMyReviewedCardIds(user.id)
      .then((ids) => live && setReviewed(new Set(ids)));
    return () => {
      live = false;
    };
  }, [scores, user]);

  const facets = useMemo(
    () => cardFacets({ reviewedCardIds }),
    [reviewedCardIds],
  );
  const searched = useMemo(
    () => searchAndSort(items, filters.q, filters.sort),
    [items, filters.q, filters.sort],
  );
  const shown = useMemo(
    () => applyFilters(searched, facets, filters.state),
    [searched, facets, filters.state],
  );

  const tiles = useMemo(
    () =>
      shown.flatMap((card) =>
        card.variants
          .filter((v) => pitchShown(filters.state, v.pitch))
          .map((variant) => ({ card, variant })),
      ),
    [shown, filters.state],
  );

  return (
    <>
      <h1>Cards</h1>
      {status === "failed" && <p role="alert">Couldn't load cards: {error}</p>}
      {status === "loading" && <p>Loading cards…</p>}
      {status === "loaded" && (
        <FilteredLayout
          state={filters.state}
          facets={facets}
          onClear={() => filters.setState({})}
          count={`${shown.length} of ${items.length} cards`}
          toolbar={
            <div className={styles.toolbar}>
              <TextField
                label="Search"
                type="search"
                placeholder="Card name"
                value={filters.q}
                onChange={(e) => filters.setQ(e.target.value)}
              />
              <label className={styles.select}>
                Sort
                <select
                  value={filters.sort}
                  onChange={(e) => filters.setSort(e.target.value as CardSort)}
                >
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                  <option value="power">Power (highest)</option>
                  <option value="defense">Defense (highest)</option>
                </select>
              </label>
              <div className={styles.viewToggle}>
                {(["tiles", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={filters.view === v}
                    onClick={() => filters.setView(v)}
                  >
                    {v === "tiles" ? "Card view" : "List view"}
                  </button>
                ))}
              </div>
            </div>
          }
          bar={
            <FilterBar
              items={searched}
              facets={facets}
              state={filters.state}
              onChange={filters.setState}
            />
          }
          sidebar={
            <FilterSidebar
              items={searched}
              facets={facets}
              state={filters.state}
              onChange={filters.setState}
            />
          }
        >
          {filters.view === "list" ? (
            <Table
              caption="Cards"
              columns={columns}
              rows={shown}
              rowKey={(c) => c.id}
              empty="No cards match these filters"
            />
          ) : tiles.length === 0 ? (
            <p className={styles.empty}>No cards match these filters</p>
          ) : (
            <ul className={styles.tiles} aria-label="Cards">
              {tiles.map(({ card, variant }) => (
                <li key={variant.id}>
                  <CardTile card={card} variant={variant} />
                </li>
              ))}
            </ul>
          )}
        </FilteredLayout>
      )}
    </>
  );
}
