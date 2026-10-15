import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  activeCount,
  facetCounts,
  kindOf,
  type Facet,
  type FilterChoice,
  type FilterState,
} from "./applyFilters.ts";
import styles from "./FilterSidebar.module.css";

/** Sets one value's choice (undefined = back to ticked), tidying empty groups. */
export function withChoice(
  state: FilterState,
  facetId: string,
  valueId: string,
  choice: FilterChoice | undefined,
): FilterState {
  const choices = { ...state[facetId] };
  if (choice) choices[valueId] = choice;
  else delete choices[valueId];
  const next = { ...state, [facetId]: choices };
  if (Object.keys(choices).length === 0) delete next[facetId];
  return next;
}

/**
 * Exclusive groups (what a card is): ticked = shown, so everything starts ticked. In an
 * exclusive group with "Only" includes, only those are ticked.
 * Feature groups (mechanics only some cards have): ticked = the card must have it, so they
 * start unticked; hiding is a separate option.
 */
export function isTicked<T>(
  facet: Facet<T>,
  state: FilterState,
  valueId: string,
): boolean {
  const choices = state[facet.id] ?? {};
  if (kindOf(facet) === "feature") return choices[valueId] === "include";
  if (choices[valueId] === "exclude") return false;
  const includes = Object.values(choices).includes("include");
  return !includes || !!choices[valueId];
}

/** Toggles a value between ticked and unticked. */
export function toggled<T>(
  facet: Facet<T>,
  state: FilterState,
  valueId: string,
): FilterState {
  if (kindOf(facet) === "feature") {
    // Tick = must have; untick = no filter (an exclude becomes a must-have).
    return withChoice(
      state,
      facet.id,
      valueId,
      state[facet.id]?.[valueId] === "include" ? undefined : "include",
    );
  }
  if (isTicked(facet, state, valueId))
    return withChoice(state, facet.id, valueId, "exclude");
  // Ticking again: clear its exclude, or add it to an exclusive group's "Only" set.
  return state[facet.id]?.[valueId] === "exclude"
    ? withChoice(state, facet.id, valueId, undefined)
    : withChoice(state, facet.id, valueId, "include");
}

/**
 * Card-database style sidebar: every value starts ticked; untick to hide those cards.
 * "Only" on a card type (an exclusive group) unticks the rest; "Only" on a mechanic shows just
 * the cards that have it. Groups with a `section` (Mechanics) sit in a collapsed section.
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

  const side = facets.filter(
    (f) => (f.placement ?? "side") === "side" && (f.showWhen?.(state) ?? true),
  );
  const loose = side.filter((f) => !f.section);
  const sections = [...new Set(side.flatMap((f) => f.section ?? []))];

  const only = (facet: Facet<T>, valueId: string): FilterState => {
    return {
      ...state,
      [facet.id]: Object.fromEntries(
        facet.values
          .filter((o) => o.id !== valueId)
          .map((o) => [o.id, "exclude" as const]),
      ),
    };
  };

  const group = (facet: Facet<T>) => {
    const shown = facet.values.filter(
      (v) => (totals[facet.id]?.[v.id] ?? 0) > 0 || state[facet.id]?.[v.id],
    );
    if (shown.length === 0) return null;
    const changed = Object.keys(state[facet.id] ?? {}).length > 0;
    const feature = kindOf(facet) === "feature";
    return (
      <Collapsible
        key={facet.id}
        title={facet.label}
        badge={Object.keys(state[facet.id] ?? {}).length}
        changed={changed}
        className={styles.facet}
        summaryClassName={styles.heading}
        action={
          changed && (
            <button
              type="button"
              className={styles.all}
              aria-label={`Show all ${facet.label}`}
              onClick={(e) => {
                // Inside <summary>: don't also open or close the group.
                e.preventDefault();
                e.stopPropagation();
                const next = { ...state };
                delete next[facet.id];
                onChange(next);
              }}
            >
              All
            </button>
          )
        }
      >
        <ul>
          {shown.map((v) => {
            const ticked = isTicked(facet, state, v.id);
            const hidden = state[facet.id]?.[v.id] === "exclude";
            return (
              <li
                key={v.id}
                className={`${styles.value} ${
                  feature
                    ? hidden
                      ? styles.hidden
                      : ""
                    : ticked
                      ? ""
                      : styles.off
                }`}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={ticked}
                    onChange={() => onChange(toggled(facet, state, v.id))}
                  />
                  <span className={styles.label}>{v.label}</span>
                </label>
                <span className={styles.count}>
                  {counts[facet.id]?.[v.id] ?? 0}
                </span>
                {feature ? (
                  <button
                    type="button"
                    className={`${styles.only} ${hidden ? styles.onlyOn : ""}`}
                    aria-label={`Hide ${v.label}`}
                    aria-pressed={hidden}
                    title={`Hide cards that have ${v.label}`}
                    onClick={() =>
                      onChange(
                        withChoice(
                          state,
                          facet.id,
                          v.id,
                          hidden ? undefined : "exclude",
                        ),
                      )
                    }
                  >
                    {hidden ? "Hidden ✓" : "Hide"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.only}
                    aria-label={`Only ${v.label}`}
                    onClick={() => onChange(only(facet, v.id))}
                  >
                    Only
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Collapsible>
    );
  };

  return (
    <aside className={styles.sidebar} aria-label="Filters">
      {loose.map(group)}
      {sections.map((name) => {
        const inSection = side.filter((f) => f.section === name);
        return (
          <Collapsible
            key={name}
            title={name}
            changed={inSection.some((f) => !!state[f.id])}
            className={styles.section}
            summaryClassName={styles.sectionHeading}
          >
            {inSection.map(group)}
          </Collapsible>
        );
      })}
    </aside>
  );
}

export { activeCount };

/** A group that starts collapsed, and opens itself when it has active filters. */
function Collapsible(props: {
  title: string;
  /** How many filters the group has; shown on the heading so collapsed groups still say. */
  badge?: number;
  changed: boolean;
  className?: string;
  summaryClassName?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(props.changed);
  useEffect(() => {
    if (props.changed) setOpen(true);
  }, [props.changed]);
  return (
    <details
      className={props.className}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={props.summaryClassName}>
        <span>{props.title}</span>
        {!!props.badge && (
          <span
            className={styles.badge}
            aria-label={`${props.badge} ${props.badge === 1 ? "filter" : "filters"}`}
          >
            {props.badge}
          </span>
        )}
        {props.action}
      </summary>
      {props.children}
    </details>
  );
}
