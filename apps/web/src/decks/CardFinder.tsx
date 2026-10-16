import { useMemo, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { cardFacets, pitchShown } from "../cards/facets.ts";
import {
  activeCount,
  applyFilters,
  type FilterState,
} from "../filters/applyFilters.ts";
import { FilterSidebar } from "../filters/FilterSidebar.tsx";
import { typeLine } from "./CardTile.tsx";
import { Enlarge } from "./Enlarge.tsx";
import { variantName } from "./deckRules.ts";
import styles from "./CardFinder.module.css";

const facets = cardFacets();
/** Tiles per page: eight rows of three. */
const PAGE = 24;
const PITCHES: [string, string][] = [
  ["1", "Red"],
  ["2", "Yellow"],
  ["3", "Blue"],
];
const CLASSES = ["Runeblade", "Shadow", "Generic"];
const GEAR = ["weapon", "equipment"];

/** Matches the name, a keyword (Usurp, Blood Debt, Go again…) or the type line. */
const matches = (card: CardSummary, q: string) =>
  !q ||
  card.name.toLowerCase().includes(q) ||
  card.keywords.some((k) => k.toLowerCase().includes(q)) ||
  typeLine(card).toLowerCase().includes(q);

/**
 * Cards to add to a deck: shown straight away, narrowed by a search, quiet pitch and class
 * toggles, and the card database's other filters folded away under More filters.
 */
export function CardFinder(props: {
  cards: CardSummary[];
  quantityOf: (variantId: string) => number | undefined;
  /** Whether a card is already in the deck or the sideboard (a card is in one or the other). */
  placeOf: (variantId: string) => "deck" | "sideboard" | undefined;
  atLimit: (variantId: string) => boolean;
  /** Copies allowed of a card and pitch (equipment: one). */
  limitOf: (variantId: string) => number;
  onAdd: (variantId: string, toSideboard?: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<FilterState>({});
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);

  // Weapons and equipment first (they don't take deck space), then deck cards, by name.
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = props.cards
      .filter((c) => matches(c, q))
      .sort(
        (a, b) =>
          Number(GEAR.includes(b.type)) - Number(GEAR.includes(a.type)) ||
          a.name.localeCompare(b.name),
      );
    return applyFilters(searched, facets, state);
  }, [props.cards, query, state]);

  // A tile for each pitch shown, paged rather than scrolling on and on.
  const tiles = found.flatMap((card) =>
    card.variants
      .filter((v) => pitchShown(state, v.pitch))
      .map((variant) => ({ card, variant })),
  );
  const pages = Math.max(1, Math.ceil(tiles.length / PAGE));
  const current = Math.min(page, pages - 1);
  const at = current * PAGE;

  const toggle = (facet: string, value: string) => {
    const choices = { ...state[facet] };
    if (choices[value] === "include") delete choices[value];
    else choices[value] = "include";
    setState({ ...state, [facet]: choices });
    setPage(0);
  };
  const on = (facet: string, value: string) =>
    state[facet]?.[value] === "include";
  // Filters other than the quick pitch and class toggles.
  const moreCount = activeCount({ ...state, pitch: {}, class: {} });
  const narrowed = query.trim() !== "" || activeCount(state) > 0;

  return (
    <div className={styles.finder}>
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <span className={styles.visuallyHidden}>Find cards</span>
          <input
            type="search"
            placeholder="Name or keyword"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          type="button"
          className={styles.more}
          aria-expanded={more}
          aria-label="More filters"
          onClick={() => setMore(!more)}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M3 5h18 M6 12h12 M10 19h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          Filters
          {moreCount > 0 && (
            <span className={styles.count} aria-hidden="true">
              {moreCount}
            </span>
          )}
          <span aria-hidden="true">{more ? "▴" : "▾"}</span>
        </button>
      </div>

      <div className={styles.quick}>
        <div className={styles.pips} role="group" aria-label="Pitch">
          {PITCHES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={styles.pip}
              data-pitch={id}
              aria-label={label}
              title={label}
              aria-pressed={on("pitch", id)}
              onClick={() => toggle("pitch", id)}
            />
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="Class">
          {CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={on("class", c)}
              onClick={() => toggle("class", c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {more && (
        <div className={styles.moreFilters}>
          <FilterSidebar
            items={props.cards}
            facets={facets}
            state={state}
            onChange={(next) => {
              setState(next);
              setPage(0);
            }}
          />
        </div>
      )}

      <p className={styles.status}>
        <span>{`${found.length.toLocaleString("en-GB")} ${found.length === 1 ? "card" : "cards"}`}</span>
        {narrowed && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              setQuery("");
              setState({});
              setPage(0);
            }}
          >
            Clear filters
          </button>
        )}
      </p>

      <ul className={styles.results} aria-label="Cards to add">
        {tiles.slice(at, at + PAGE).map(({ card, variant: v }) => {
          const name = variantName(card, v);
          const q = props.quantityOf(v.id);
          const place = props.placeOf(v.id);
          const full = props.atLimit(v.id);
          const limit = props.limitOf(v.id);
          const atMost = `At most ${limit} ${limit === 1 ? "copy" : "copies"}`;
          return (
            <li
              key={v.id}
              aria-label={name}
              className={styles.tile}
              data-pitch={v.pitch ?? "none"}
            >
              <span className={styles.art} title={name}>
                {v.imageUrl ? (
                  <img src={v.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.standIn}>{name}</span>
                )}
                {/* Down the right on hover (always on touch screens): deck, sideboard, enlarge. */}
                <span className={styles.actions} role="group" aria-label={name}>
                  <button
                    type="button"
                    className={styles.action}
                    aria-label={`Add ${name}`}
                    title={full ? atMost : "Add to the deck"}
                    disabled={full}
                    onClick={() => props.onAdd(v.id)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    data-sideboard=""
                    aria-label={`Add ${name} to the sideboard`}
                    title={
                      place === "deck"
                        ? "Already in the deck: move it from the deck list"
                        : full
                          ? atMost
                          : "Add to the sideboard"
                    }
                    disabled={place === "deck" || full}
                    onClick={() => props.onAdd(v.id, true)}
                  >
                    SB
                  </button>
                </span>
                {v.imageUrl && (
                  <Enlarge
                    name={name}
                    src={v.imageUrl}
                    className={styles.enlarge}
                  />
                )}
                {q ? (
                  <span className={styles.haveOnArt} aria-hidden="true">
                    {place === "sideboard" ? `${q} SB` : q}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {pages > 1 && (
        <nav className={styles.pager} aria-label="Pages">
          <button
            type="button"
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          <span>{`Page ${current + 1} of ${pages}`}</span>
          <button
            type="button"
            aria-label="Next page"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}
