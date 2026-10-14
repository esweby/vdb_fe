import { useMemo } from "react";
import {
  activeCount,
  facetCounts,
  type Facet,
  type FilterChoice,
  type FilterState,
} from "./applyFilters.ts";
import styles from "./FilterSidebar.module.css";

const NEXT: Record<string, FilterChoice | undefined> = {
  neutral: "include",
  include: "exclude",
  exclude: undefined,
};
const STATE_TEXT = {
  neutral: "not filtered",
  include: "included",
  exclude: "excluded",
};
const plural = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

/**
 * Ecommerce-style facet sidebar. Each value cycles neutral → include (green) → exclude (red).
 * Counts show how many results you'd get by including that value.
 */
export function FilterSidebar<T>(props: {
  items: T[];
  facets: Facet<T>[];
  state: FilterState;
  onChange: (state: FilterState) => void;
}) {
  const { items, facets, state, onChange } = props;
  const counts = useMemo(
    () => facetCounts(items, facets, state),
    [items, facets, state],
  );
  const totals = useMemo(() => facetCounts(items, facets, {}), [items, facets]);

  const set = (
    facetId: string,
    valueId: string,
    choice: FilterChoice | undefined,
  ) => {
    const choices = { ...state[facetId] };
    if (choice) choices[valueId] = choice;
    else delete choices[valueId];
    const next = { ...state, [facetId]: choices };
    if (Object.keys(choices).length === 0) delete next[facetId];
    onChange(next);
  };

  const active = facets.flatMap((f) =>
    f.values
      .filter((v) => state[f.id]?.[v.id])
      .map((v) => ({ facet: f, value: v, choice: state[f.id]![v.id]! })),
  );

  return (
    <aside className={styles.sidebar} aria-label="Filters">
      {active.length > 0 && (
        <div className={styles.active}>
          {active.map(({ facet, value, choice }) => {
            const label = `${choice === "include" ? "Include" : "Exclude"}: ${value.label}`;
            return (
              <button
                key={`${facet.id}:${value.id}`}
                type="button"
                className={`${styles.chip} ${styles[choice]}`}
                aria-label={`Remove ${label}`}
                onClick={() => set(facet.id, value.id, undefined)}
              >
                {label} ×
              </button>
            );
          })}
          <button
            type="button"
            className={styles.clear}
            onClick={() => onChange({})}
          >
            Clear all filters
          </button>
        </div>
      )}

      {facets.map((facet) => {
        const shown = facet.values.filter(
          (v) => (totals[facet.id]?.[v.id] ?? 0) > 0 || state[facet.id]?.[v.id],
        );
        if (shown.length === 0) return null;
        const selected = Object.keys(state[facet.id] ?? {}).length;
        return (
          <details key={facet.id} className={styles.facet} open>
            <summary>
              {facet.label}
              {selected > 0 && <span className={styles.badge}>{selected}</span>}
              <span className={styles.mode}>
                {facet.mode === "any" ? "any" : "all"}
              </span>
            </summary>
            <ul>
              {shown.map((v) => {
                const choice = state[facet.id]?.[v.id] ?? "neutral";
                const count = counts[facet.id]?.[v.id] ?? 0;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      className={`${styles.value} ${styles[choice]}`}
                      aria-label={`${v.label}, ${plural(count)}, ${STATE_TEXT[choice]}`}
                      title="Click to include, again to exclude, again to clear"
                      onClick={() => set(facet.id, v.id, NEXT[choice])}
                    >
                      <span className={styles.marker} aria-hidden="true">
                        {choice === "include"
                          ? "✓"
                          : choice === "exclude"
                            ? "✕"
                            : ""}
                      </span>
                      <span className={styles.label}>{v.label}</span>
                      <span className={styles.count}>{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </aside>
  );
}

export { activeCount };
