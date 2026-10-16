// Facet filtering behind ticked-by-default checkboxes. Each value is neutral (ticked),
// excluded (unticked) or included ("Only").
// "exclusive" groups describe what a card is (type, class, pitch, power): an item is hidden
// only when every value it has is unticked, and never when it has none. "feature" groups
// describe what some cards do (keywords, tags): unticking hides cards that have it.
// "any" groups match ANY included value; "all" groups need EVERY included value.

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
  /** Defaults to "exclusive" for "any" groups and "feature" for "all" groups. */
  kind?: "exclusive" | "feature";
  /** "bar": toggles beside the search box. Defaults to the sidebar. */
  placement?: "bar" | "side";
  /** A collapsed sidebar section the group sits in, e.g. "Mechanics". */
  section?: string;
  /** Hide the group (e.g. equipment slot while equipment is unticked). */
  showWhen?: (state: FilterState) => boolean;
  /** Also applied when "Only" is chosen in this group, e.g. an equipment slot narrows the
   * card type to equipment, as cards without a slot never match the slot group. */
  onlyAlso?: FilterState;
  /** Prefix values with the group in the summary ("Power 0–1 hidden"). */
  summaryPrefix?: boolean;
}

export const kindOf = <T>(facet: Facet<T>) =>
  facet.kind ?? (facet.mode === "any" ? "exclusive" : "feature");

function passesFacet<T>(
  item: T,
  facet: Facet<T>,
  choices: Record<string, FilterChoice> | undefined,
  extraInclude?: FacetValue<T>,
): boolean {
  const chosen = facet.values.filter((v) => choices?.[v.id]);
  if (kindOf(facet) === "exclusive") {
    const has = facet.values.filter((v) => v.test(item));
    if (
      has.length > 0 &&
      has.every((v) => choices?.[v.id] === "exclude" && v !== extraInclude)
    )
      return false;
  } else if (chosen.some((v) => choices![v.id] === "exclude" && v.test(item)))
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

/** What's filtered, in words: "Generic hidden", "Only Go again". */
export function filterSummary<T>(
  state: FilterState,
  facets: Facet<T>[],
): string[] {
  return facets.flatMap((facet) => {
    // Quick filters read as one phrase: "Pitch: Red, Blue".
    const selected =
      facet.placement === "bar"
        ? facet.values.filter((v) => state[facet.id]?.[v.id] === "include")
        : [];
    const rest = facet.values.flatMap((v) => {
      const choice = state[facet.id]?.[v.id];
      if (!choice) return [];
      const name = facet.summaryPrefix ? `${facet.label} ${v.label}` : v.label;
      if (choice === "include" && selected.includes(v)) return [];
      return [choice === "exclude" ? `${name} hidden` : `Only ${name}`];
    });
    return selected.length > 0
      ? [`${facet.label}: ${selected.map((v) => v.label).join(", ")}`, ...rest]
      : rest;
  });
}
