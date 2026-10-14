import { useNavigate } from "@tanstack/react-router";
import type { CardSort } from "../cards/filterCards.ts";
import type { FilterState } from "./applyFilters.ts";
import { fromSearch, toSearch, type FilterSearch } from "./urlState.ts";

export interface ListSearch extends FilterSearch {
  q?: string;
  sort?: CardSort;
}

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
    sort: (["type", "cost", "power", "defense"] as const).find(
      (s) => s === search.sort,
    ),
    inc: strings(search.inc)?.length ? strings(search.inc) : undefined,
    exc: strings(search.exc)?.length ? strings(search.exc) : undefined,
  };
}

/** Filter, search and sort state kept in the URL, so views can be shared and bookmarked. */
export function useUrlFilters(search: ListSearch) {
  const navigate = useNavigate();
  const update = (
    patch: Partial<{ state: FilterState; q: string; sort: CardSort }>,
  ) => {
    const state = patch.state ?? fromSearch(search);
    const q = patch.q ?? search.q ?? "";
    const sort = patch.sort ?? search.sort ?? "name";
    void navigate({
      to: ".",
      replace: true,
      search: {
        ...(q ? { q } : {}),
        ...(sort !== "name" ? { sort } : {}),
        ...toSearch(state),
      },
    });
  };
  return {
    state: fromSearch(search),
    q: search.q ?? "",
    sort: search.sort ?? ("name" as CardSort),
    setState: (state: FilterState) => update({ state }),
    setQ: (q: string) => update({ q }),
    setSort: (sort: CardSort) => update({ sort }),
  };
}
