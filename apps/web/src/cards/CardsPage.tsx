import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
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
import {
  CARD_VIEWS,
  type CardView,
  type ListSearch,
} from "../filters/useUrlFilters.ts";
import type { CardSummary } from "./cardRepository.ts";
import { CardModal } from "./CardModal.tsx";
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
/** Results per batch: fewer as cards get bigger, and multiples of common column counts so rows fill. */
const PER_PAGE: Record<CardView, number> = {
  small: 60,
  large: 40,
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
      <Link
        to="/cards"
        search={(prev: ListSearch) => ({
          ...prev,
          card: c.id,
          variant: undefined,
        })}
        resetScroll={false}
      >
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

  // Load more: the URL's page is how many batches are shown, so refresh and back keep them.
  const perPage = PER_PAGE[filters.view];
  const total = filters.view === "list" ? shown.length : tiles.length;
  const loaded = Math.min(filters.page * perPage, total);
  const left = total - loaded;
  // One count, in the unit on screen: cards in the list, a tile per pitch in card views.
  const everything =
    filters.view === "list"
      ? items.length
      : items.reduce((n, c) => n + c.variants.length, 0);
  const n = (x: number) => x.toLocaleString("en-GB");
  const countText =
    left > 0
      ? `Showing ${n(loaded)} of ${n(total)} cards${total < everything ? ` (of ${n(everything)})` : ""}`
      : `${n(total)} of ${n(everything)} cards`;

  // The pop-over steps through the results in their current order: each pitch is its own stop
  // in card views (as the tiles are), each card in the list.
  const search = route.useSearch();
  const navigate = useNavigate();
  const open = search.card
    ? items.find((c) => c.id === search.card)
    : undefined;
  type Stop = { cardId: string; variantId?: string };
  const stops: Stop[] =
    filters.view === "list"
      ? shown.map((c) => ({ cardId: c.id }))
      : tiles.map((t) => ({ cardId: t.card.id, variantId: t.variant.id }));
  const at = open
    ? stops.findIndex(
        (st) =>
          st.cardId === open.id &&
          (!st.variantId || !search.variant || st.variantId === search.variant),
      )
    : -1;
  const goTo = (stop: Stop | undefined) => {
    if (!stop) return;
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: (prev: ListSearch) => ({
        ...prev,
        card: stop.cardId,
        variant: stop.variantId,
      }),
    });
  };
  // After a review, the other pitches of the same card are done too: go to the next card.
  const nextCard =
    at >= 0
      ? stops.slice(at + 1).find((st) => st.cardId !== open?.id)
      : undefined;
  const closeCard = () =>
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: (prev: ListSearch) => ({
        ...prev,
        card: undefined,
        variant: undefined,
      }),
    });

  return (
    <>
      {open && (
        <CardModal
          cardId={open.id}
          name={open.name}
          verified={open.attributesVerified}
          position={
            at >= 0 ? { index: at + 1, total: stops.length } : undefined
          }
          variantId={search.variant}
          onPrevious={at > 0 ? () => goTo(stops[at - 1]) : undefined}
          onNext={
            at >= 0 && stops[at + 1] ? () => goTo(stops[at + 1]) : undefined
          }
          onNextCard={nextCard ? () => goTo(nextCard) : undefined}
          onChooseVariant={(variantId) => goTo({ cardId: open.id, variantId })}
          onClose={closeCard}
        />
      )}
      <h1 className={styles.visuallyHidden}>Cards</h1>
      {status === "failed" && <p role="alert">Couldn't load cards: {error}</p>}
      {status === "loading" && <p>Loading cards…</p>}
      {status === "loaded" && (
        <FilteredLayout
          state={filters.state}
          facets={facets}
          onClear={() => filters.setState({})}
          count={countText}
          toolbar={
            <div className={styles.toolbar}>
              <TextField
                label="Search"
                hideLabel
                type="search"
                className={styles.search}
                placeholder="Search by name or keyword"
                value={filters.q}
                onChange={(e) => filters.setQ(e.target.value)}
              />
              <label className={styles.select}>
                <span className={styles.visuallyHidden}>Sort</span>
                <select
                  value={filters.sort}
                  onChange={(e) => filters.setSort(e.target.value as CardSort)}
                >
                  <option value="newest">Newest first</option>
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
          {filters.view === "list" ? (
            <Table
              caption="Cards"
              columns={columns}
              rows={shown.slice(0, loaded)}
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
              {tiles.slice(0, loaded).map(({ card, variant }) => (
                <li key={variant.id}>
                  <CardTile
                    card={card}
                    variant={variant}
                    nameLink={({ className, children }) => (
                      <Link
                        to="/cards"
                        search={(prev: ListSearch) => ({
                          ...prev,
                          card: card.id,
                          variant: variant.id,
                        })}
                        resetScroll={false}
                        className={className}
                      >
                        {children}
                      </Link>
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
          {left > 0 && (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => filters.setPage(filters.page + 1)}
            >
              Load more <span className={styles.left}>· {n(left)} left</span>
            </button>
          )}
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
