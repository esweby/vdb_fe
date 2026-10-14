import { useMemo } from "react";
import { facetCounts, type Facet, type FilterState } from "./applyFilters.ts";
import { withChoice } from "./FilterSidebar.tsx";
import styles from "./FilterBar.module.css";

/**
 * The quick filters beside the search box (pitch, class), like a card game's mana or colour
 * bar: with none selected everything shows; selecting values narrows to just those.
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
              const on = state[facet.id]?.[v.id] === "include";
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  title={
                    on ? `Stop filtering by ${v.label}` : `Show only ${v.label}`
                  }
                  className={`${styles.pill} ${facet.id === "pitch" ? (styles[`pitch${v.id}`] ?? "") : ""}`}
                  onClick={() =>
                    onChange(
                      withChoice(
                        state,
                        facet.id,
                        v.id,
                        on ? undefined : "include",
                      ),
                    )
                  }
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
