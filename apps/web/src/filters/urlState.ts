// Filter state <-> URL search params: inc=["facet:value"], exc=["facet:value"].
import type { FilterChoice, FilterState } from "./applyFilters.ts";

export interface FilterSearch {
  inc?: string[];
  exc?: string[];
}

export function toSearch(state: FilterState): FilterSearch {
  const pairs = (choice: FilterChoice) =>
    Object.entries(state)
      .flatMap(([facet, values]) =>
        Object.entries(values)
          .filter(([, c]) => c === choice)
          .map(([value]) => `${facet}:${value}`),
      )
      .sort();
  const inc = pairs("include");
  const exc = pairs("exclude");
  return { ...(inc.length ? { inc } : {}), ...(exc.length ? { exc } : {}) };
}

export function fromSearch(search: {
  inc?: unknown;
  exc?: unknown;
}): FilterState {
  const state: FilterState = {};
  const add = (list: unknown, choice: FilterChoice) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (typeof entry !== "string") continue;
      const [facet, value] = entry.split(":");
      if (!facet || !value) continue;
      (state[facet] ??= {})[value] = choice;
    }
  };
  add(search.inc, "include");
  add(search.exc, "exclude");
  return state;
}
