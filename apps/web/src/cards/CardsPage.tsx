import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Table, TextField, type Column } from "../ui/index.ts";
import type { CardSummary } from "./cardRepository.ts";
import {
  classOf,
  filterCards,
  TYPE_LABELS,
  type CardClass,
  type CardFilters,
} from "./filterCards.ts";
import styles from "./CardsPage.module.css";
import { useCards } from "./useCards.ts";

const pitches = (c: CardSummary) =>
  c.variants
    .map((v) => v.pitch)
    .filter((p): p is number => p !== null)
    .sort()
    .join(" ") || "–";

const columns: Column<CardSummary>[] = [
  {
    key: "name",
    header: "Name",
    render: (c) => (
      <Link to="/cards/$cardId" params={{ cardId: c.id }}>
        {c.name}
      </Link>
    ),
  },
  { key: "type", header: "Type", render: (c) => TYPE_LABELS[c.type] ?? c.type },
  { key: "class", header: "Class", render: classOf },
  { key: "pitch", header: "Pitch", render: pitches },
];

export function CardsPage() {
  const { status, items, error } = useCards();
  const [filters, setFilters] = useState<CardFilters>({
    search: "",
    pitches: [],
    type: null,
    cardClass: null,
    sort: "name",
  });
  const shown = useMemo(() => filterCards(items, filters), [items, filters]);
  const set = (patch: Partial<CardFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <>
      <h1>Cards</h1>
      <div className={styles.filters}>
        <TextField
          label="Search"
          type="search"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        <fieldset className={styles.pitches}>
          <legend>Pitch</legend>
          {[1, 2, 3].map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                aria-label={`Pitch ${p}`}
                checked={filters.pitches.includes(p)}
                onChange={(e) =>
                  set({
                    pitches: e.target.checked
                      ? [...filters.pitches, p]
                      : filters.pitches.filter((x) => x !== p),
                  })
                }
              />
              {p}
            </label>
          ))}
        </fieldset>
        <label className={styles.select}>
          Type
          <select
            value={filters.type ?? ""}
            onChange={(e) => set({ type: e.target.value || null })}
          >
            <option value="">Any</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          Class
          <select
            value={filters.cardClass ?? ""}
            onChange={(e) =>
              set({ cardClass: (e.target.value || null) as CardClass | null })
            }
          >
            <option value="">Any</option>
            <option value="Runeblade">Runeblade</option>
            <option value="Shadow">Shadow</option>
            <option value="Generic">Generic</option>
          </select>
        </label>
        <label className={styles.select}>
          Sort
          <select
            value={filters.sort}
            onChange={(e) =>
              set({ sort: e.target.value as CardFilters["sort"] })
            }
          >
            <option value="name">Name</option>
            <option value="type">Type</option>
          </select>
        </label>
      </div>

      {status === "failed" && <p role="alert">Couldn't load cards: {error}</p>}
      {status === "loading" && <p>Loading cards…</p>}
      {status === "loaded" && (
        <>
          <p className={styles.count}>
            {shown.length} of {items.length} cards
          </p>
          <Table
            caption="Cards"
            columns={columns}
            rows={shown}
            rowKey={(c) => c.id}
            empty="No cards match these filters"
          />
        </>
      )}
    </>
  );
}
