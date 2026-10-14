import { useState, type ReactNode } from "react";
import { Button } from "../ui/index.ts";
import { activeCount, type FilterState } from "./applyFilters.ts";
import styles from "./FilteredLayout.module.css";

/** A filter sidebar beside results; on narrow screens the sidebar is a toggle. */
export function FilteredLayout(props: {
  state: FilterState;
  sidebar: ReactNode;
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
      <div className={styles.results}>{props.children}</div>
    </div>
  );
}
