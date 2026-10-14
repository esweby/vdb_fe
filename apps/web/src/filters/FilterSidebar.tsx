import { useMemo } from "react";
import {
  activeCount,
  facetCounts,
  type Facet,
  type FilterChoice,
  type FilterState,
} from "./applyFilters.ts";
import styles from "./FilterSidebar.module.css";

const plural = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

/**
 * Ecommerce-style facet sidebar. Each value has a green include and a red exclude
 * button; clicking the active one turns it off.
 * Counts show how many results you'd get by including that value. Selections stay
 * highlighted in place; each group has its own Clear.
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

  return (
    <aside className={styles.sidebar} aria-label="Filters">
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
              {selected > 0 && (
                <button
                  type="button"
                  className={styles.clearGroup}
                  aria-label={`Clear ${facet.label}`}
                  onClick={(e) => {
                    // Inside <summary>: don't also toggle the group open or closed.
                    e.preventDefault();
                    e.stopPropagation();
                    const next = { ...state };
                    delete next[facet.id];
                    onChange(next);
                  }}
                >
                  Clear
                </button>
              )}
            </summary>
            <ul>
              {shown.map((v) => {
                const choice = state[facet.id]?.[v.id] ?? "neutral";
                const count = counts[facet.id]?.[v.id] ?? 0;
                return (
                  <li
                    key={v.id}
                    className={`${styles.value} ${styles[choice]}`}
                  >
                    <span className={styles.label}>{v.label}</span>
                    <span className={styles.count}>{count}</span>
                    <button
                      type="button"
                      className={`${styles.toggle} ${styles.includeButton}`}
                      aria-label={`Include ${v.label}, ${plural(count)}`}
                      aria-pressed={choice === "include"}
                      title="Include"
                      onClick={() =>
                        set(
                          facet.id,
                          v.id,
                          choice === "include" ? undefined : "include",
                        )
                      }
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggle} ${styles.excludeButton}`}
                      aria-label={`Exclude ${v.label}`}
                      aria-pressed={choice === "exclude"}
                      title="Exclude"
                      onClick={() =>
                        set(
                          facet.id,
                          v.id,
                          choice === "exclude" ? undefined : "exclude",
                        )
                      }
                    >
                      ✕
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
