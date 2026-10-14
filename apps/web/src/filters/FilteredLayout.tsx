import { useState, type ReactNode } from "react";
import { Button } from "../ui/index.ts";
import { activeCount, type FilterState } from "./applyFilters.ts";
import styles from "./FilteredLayout.module.css";

/** A filter sidebar beside results; on narrow screens the sidebar is a toggle. */
export function FilteredLayout(props: {
  state: FilterState;
  sidebar: ReactNode;
  /** Clears every filter; shown in a fixed status line so nothing shifts. */
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const n = activeCount(props.state);
  return (
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
          {n === 0
            ? "No filters"
            : `${n} ${n === 1 ? "filter" : "filters"} active`}
          {n > 0 && (
            <button
              type="button"
              className={styles.clearAll}
              onClick={props.onClear}
            >
              Clear all filters
            </button>
          )}
        </p>
        {props.children}
      </div>
    </div>
  );
}
