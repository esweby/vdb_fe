import { useState, type ReactNode } from "react";
import { Button } from "../ui/index.ts";
import {
  activeCount,
  filterSummary,
  type Facet,
  type FilterState,
} from "./applyFilters.ts";
import styles from "./FilteredLayout.module.css";

const MAX_PHRASES = 4;

/**
 * Card-database layout: search and quick toggles across the top, filters on the left, and a
 * line above the results saying what's hidden, with Reset. On narrow screens the sidebar
 * is a toggle.
 */
export function FilteredLayout<T>(props: {
  state: FilterState;
  facets: Facet<T>[];
  /** Search box, sort and view controls. */
  toolbar?: ReactNode;
  /** Quick toggles (FilterBar). */
  bar?: ReactNode;
  sidebar: ReactNode;
  /** e.g. "412 of 627 cards" */
  count?: ReactNode;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const n = activeCount(props.state);
  const phrases = filterSummary(props.state, props.facets);
  const shownPhrases = phrases.slice(0, MAX_PHRASES);
  const more = phrases.length - shownPhrases.length;
  return (
    <div className={styles.page}>
      {(props.toolbar || props.bar) && (
        <div className={styles.top}>
          {props.toolbar}
          {props.bar}
        </div>
      )}
      <div className={styles.layout}>
        <div className={styles.toggle}>
          <Button aria-expanded={open} onClick={() => setOpen(!open)}>
            Filters{n > 0 ? ` (${n})` : ""}
          </Button>
        </div>
        <div className={`${styles.sidebar} ${open ? styles.open : ""}`}>
          {props.sidebar}
        </div>
        <div className={styles.results}>
          <p className={styles.status}>
            <span>
              {props.count}
              {shownPhrases.length > 0 &&
                `${props.count ? " · " : ""}${shownPhrases.join(" · ")}`}
              {more > 0 && ` · and ${more} more`}
            </span>
            {n > 0 && (
              <button
                type="button"
                className={styles.clearAll}
                onClick={props.onClear}
              >
                Reset filters
              </button>
            )}
          </p>
          {props.children}
        </div>
      </div>
    </div>
  );
}
