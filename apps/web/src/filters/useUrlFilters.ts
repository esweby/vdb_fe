import { useNavigate } from "@tanstack/react-router";
import type { CardSort } from "../cards/filterCards.ts";
import { isCardTab, type CardTab } from "../scoring/cardTabs.ts";
import type { FilterState } from "./applyFilters.ts";
import { fromSearch, toSearch, type FilterSearch } from "./urlState.ts";

export interface ListSearch extends FilterSearch {
  q?: string;
  sort?: CardSort;
  /** Small card tiles by default. */
  view?: CardView;
  /** 1-based; page 1 is left out of the URL. */
  page?: number;
  /** The card open in the pop-over, and the pitch that was clicked. */
  card?: string;
  variant?: string;
  /** The pop-over's tab (see cardTabs.ts). */
  cardTab?: CardTab;
}

export type CardView = "small" | "large" | "list";
export const CARD_VIEWS: CardView[] = ["small", "large", "list"];

/** Validates list-page search params from the URL. */
export function validateListSearch(
  search: Record<string, unknown>,
): ListSearch {
  const strings = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : undefined;
  return {
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    // Newest first is the default, so it's left out of the URL.
    sort: (["name", "type", "cost", "power", "defense"] as const).find(
      (s) => s === search.sort,
    ),
    inc: strings(search.inc)?.length ? strings(search.inc) : undefined,
    exc: strings(search.exc)?.length ? strings(search.exc) : undefined,
    view: CARD_VIEWS.find((v) => v !== "small" && v === search.view),
    page:
      Number.isInteger(Number(search.page)) && Number(search.page) > 1
        ? Number(search.page)
        : undefined,
    card:
      typeof search.card === "string" && search.card ? search.card : undefined,
    variant:
      typeof search.variant === "string" && search.variant
        ? search.variant
        : undefined,
    cardTab: isCardTab(search.cardTab) ? search.cardTab : undefined,
  };
}

/** Filter, search and sort state kept in the URL, so views can be shared and bookmarked. */
export function useUrlFilters(search: ListSearch) {
  const navigate = useNavigate();
  const update = (
    patch: Partial<{
      state: FilterState;
      q: string;
      sort: CardSort;
      view: CardView;
      page: number;
    }>,
  ) => {
    const view = patch.view ?? search.view ?? "small";
    // Anything but a page change goes back to page 1.
    const page = patch.page ?? 1;
    const state = patch.state ?? fromSearch(search);
    const q = patch.q ?? search.q ?? "";
    const sort = patch.sort ?? search.sort ?? "newest";
    void navigate({
      to: ".",
      replace: true,
      // An in-page change (filters, Load more, settings): keep the scroll position.
      resetScroll: false,
      search: {
        ...(q ? { q } : {}),
        ...(sort !== "newest" ? { sort } : {}),
        ...toSearch(state),
        ...(view !== "small" ? { view } : {}),
        ...(page > 1 ? { page } : {}),
      },
    });
  };
  return {
    state: fromSearch(search),
    q: search.q ?? "",
    sort: search.sort ?? ("newest" as CardSort),
    setState: (state: FilterState) => update({ state }),
    setQ: (q: string) => update({ q }),
    setSort: (sort: CardSort) => update({ sort }),
    view: search.view ?? ("small" as CardView),
    setView: (view: CardView) => update({ view }),
    page: search.page ?? 1,
    setPage: (page: number) => update({ page }),
  };
}
