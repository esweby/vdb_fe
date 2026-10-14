// Tri-state facet filtering: each value is neutral, included or excluded.
// "any" groups (a card has one value: type, class, pitch, slot) match ANY included value.
// "all" groups (properties: keywords, tags) need EVERY included value. Excludes always remove.

export type FilterChoice = "include" | "exclude";
/** facetId -> valueId -> choice. Missing means neutral. */
export type FilterState = Record<string, Record<string, FilterChoice>>;

export interface FacetValue<T> {
  id: string;
  label: string;
  test: (item: T) => boolean;
}

export interface Facet<T> {
  id: string;
  label: string;
  mode: "any" | "all";
  values: FacetValue<T>[];
}

function passesFacet<T>(
  item: T,
  facet: Facet<T>,
  choices: Record<string, FilterChoice> | undefined,
  extraInclude?: FacetValue<T>,
): boolean {
  const chosen = facet.values.filter((v) => choices?.[v.id]);
  if (chosen.some((v) => choices![v.id] === "exclude" && v.test(item)))
    return false;
  const includes = chosen.filter((v) => choices![v.id] === "include");
  if (extraInclude) includes.push(extraInclude);
  if (includes.length === 0) return true;
  return facet.mode === "any"
    ? includes.some((v) => v.test(item))
    : includes.every((v) => v.test(item));
}

export function applyFilters<T>(
  items: T[],
  facets: Facet<T>[],
  state: FilterState,
): T[] {
  return items.filter((item) =>
    facets.every((f) => passesFacet(item, f, state[f.id])),
  );
}

/** For each value, how many results you'd get by including it (given the other filters). */
export function facetCounts<T>(
  items: T[],
  facets: Facet<T>[],
  state: FilterState,
): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {};
  for (const facet of facets) {
    const others = facets.filter((f) => f !== facet);
    const base = items.filter((item) =>
      others.every((f) => passesFacet(item, f, state[f.id])),
    );
    // ANY groups count without their own includes (adding a value widens the group);
    // ALL groups keep them (adding a value narrows it). Excludes always apply.
    const own = state[facet.id];
    const ownForCount =
      facet.mode === "any"
        ? Object.fromEntries(
            Object.entries(own ?? {}).filter(([, c]) => c === "exclude"),
          )
        : own;
    counts[facet.id] = Object.fromEntries(
      facet.values.map((v) => {
        // Count as if this value were included, whatever its current choice.
        const { [v.id]: _ignored, ...withoutSelf } = ownForCount ?? {};
        return [
          v.id,
          base.filter((item) => passesFacet(item, facet, withoutSelf, v))
            .length,
        ];
      }),
    );
  }
  return counts;
}

export function activeCount(state: FilterState): number {
  return Object.values(state).reduce(
    (n, choices) => n + Object.keys(choices).length,
    0,
  );
}
