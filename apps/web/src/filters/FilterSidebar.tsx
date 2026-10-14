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

/** Ticked = not hidden. In an exclusive group with "Only" includes, only those are ticked. */
export function isTicked<T>(
  facet: Facet<T>,
  state: FilterState,
  valueId: string,
): boolean {
  const choices = state[facet.id] ?? {};
  if (choices[valueId] === "exclude") return false;
  const includes = Object.values(choices).includes("include");
  return kindOf(facet) === "feature" || !includes || !!choices[valueId];
}

/** Toggles a value between ticked and unticked. */
export function toggled<T>(
  facet: Facet<T>,
  state: FilterState,
  valueId: string,
): FilterState {
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
    if (kindOf(facet) === "feature") {
      const on = state[facet.id]?.[valueId] === "include";
      return withChoice(state, facet.id, valueId, on ? undefined : "include");
    }
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
            const isOnly = state[facet.id]?.[v.id] === "include";
            return (
              <li
                key={v.id}
                className={`${styles.value} ${ticked ? "" : styles.off}`}
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
                <button
                  type="button"
                  className={`${styles.only} ${isOnly ? styles.onlyOn : ""}`}
                  aria-label={`Only ${v.label}`}
                  aria-pressed={feature ? isOnly : undefined}
                  onClick={() => onChange(only(facet, v.id))}
                >
                  {isOnly ? "Only ✓" : "Only"}
                </button>
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
        {props.action}
      </summary>
      {props.children}
    </details>
  );
}
