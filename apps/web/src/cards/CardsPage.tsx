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
import { Pagination, Table, TextField, type Column } from "../ui/index.ts";
import { CARD_VIEWS, type CardView } from "../filters/useUrlFilters.ts";
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

const VIEW_LABELS: Record<CardView, string> = {
  small: "Small cards",
  large: "Large cards",
  list: "List",
};
/** Results per page: fewer as cards get bigger. */
const PER_PAGE: Record<CardView, number> = {
  small: 60,
  large: 36,
  list: 50,
};

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

  const perPage = PER_PAGE[filters.view];
  const total = filters.view === "list" ? shown.length : tiles.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(filters.page, pageCount);
  const from = (page - 1) * perPage;
  const goTo = (next: number) => {
    filters.setPage(next);
    document.querySelector("h1")?.scrollIntoView?.({ block: "start" });
  };

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
            </div>
          }
          bar={
            <div className={styles.barRow}>
              <FilterBar
                items={searched}
                facets={facets}
                state={filters.state}
                onChange={filters.setState}
              />
              <div className={styles.viewToggle} role="group" aria-label="View">
                {CARD_VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-label={VIEW_LABELS[v]}
                    title={VIEW_LABELS[v]}
                    aria-pressed={filters.view === v}
                    onClick={() => filters.setView(v)}
                  >
                    <ViewIcon view={v} />
                  </button>
                ))}
              </div>
            </div>
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
          {pageCount > 1 && (
            <p className={styles.range}>
              Showing {from + 1}–{Math.min(from + perPage, total)} of {total}
            </p>
          )}
          {filters.view === "list" ? (
            <Table
              caption="Cards"
              columns={columns}
              rows={shown.slice(from, from + perPage)}
              rowKey={(c) => c.id}
              empty="No cards match these filters"
            />
          ) : tiles.length === 0 ? (
            <p className={styles.empty}>No cards match these filters</p>
          ) : (
            <ul
              className={styles.tiles}
              aria-label="Cards"
              data-size={filters.view}
            >
              {tiles.slice(from, from + perPage).map(({ card, variant }) => (
                <li key={variant.id}>
                  <CardTile card={card} variant={variant} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pageCount={pageCount} onChange={goTo} />
        </FilteredLayout>
      )}
    </>
  );
}

/** Small: a dense 3×3 grid. Large: 2×2. List: lines. */
function ViewIcon({ view }: { view: CardView }) {
  const cells: Record<Exclude<CardView, "list">, [number, number, number][]> = {
    small: [0, 1, 2].flatMap((r) =>
      [0, 1, 2].map((c): [number, number, number] => [c * 6, r * 6, 4]),
    ),
    large: [0, 1].flatMap((r) =>
      [0, 1].map((c): [number, number, number] => [c * 9, r * 9, 7]),
    ),
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {view === "list"
        ? [2, 7, 12].map((y) => (
            <rect key={y} x="0" y={y} width="16" height="2" rx="1" />
          ))
        : cells[view].map(([x, y, size]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={size}
              height={size}
              rx="1"
            />
          ))}
    </svg>
  );
}
