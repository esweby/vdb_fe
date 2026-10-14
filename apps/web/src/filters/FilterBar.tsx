import { useMemo } from "react";
import { facetCounts, type Facet, type FilterState } from "./applyFilters.ts";
import { isTicked, toggled } from "./FilterSidebar.tsx";
import styles from "./FilterBar.module.css";

/**
 * The quick filters beside the search box (pitch, class), as toggles that start on.
 * Turning one off hides those cards, like unticking a box in the sidebar.
 */
export function FilterBar<T>(props: {
  items: T[];
  facets: Facet<T>[];
  state: FilterState;
  onChange: (state: FilterState) => void;
}) {
  const { items, facets, state, onChange } = props;
  const bar = facets.filter((f) => f.placement === "bar");
  const totals = useMemo(() => facetCounts(items, facets, {}), [items, facets]);
  return (
    <div className={styles.bar}>
      {bar.map((facet) => (
        <div
          key={facet.id}
          role="group"
          aria-label={facet.label}
          className={styles.group}
        >
          <span className={styles.groupLabel} aria-hidden="true">
            {facet.label}
          </span>
          {facet.values
            .filter(
              (v) =>
                (totals[facet.id]?.[v.id] ?? 0) > 0 || state[facet.id]?.[v.id],
            )
            .map((v) => {
              const on = isTicked(facet, state, v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  title={on ? `Hide ${v.label}` : `Show ${v.label}`}
                  className={`${styles.pill} ${facet.id === "pitch" ? (styles[`pitch${v.id}`] ?? "") : ""}`}
                  onClick={() => onChange(toggled(facet, state, v.id))}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  {v.label}
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
