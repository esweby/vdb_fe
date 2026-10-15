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
import { variantName } from "./deckRules.ts";
import styles from "./CardFinder.module.css";

const facets = cardFacets();
const PAGE = 30;
const PITCHES: [string, string][] = [
  ["1", "Red"],
  ["2", "Yellow"],
  ["3", "Blue"],
];
const CLASSES = ["Runeblade", "Shadow", "Generic"];
const GEAR = ["weapon", "equipment"];
const PITCH_LETTER: Record<number, string> = { 1: "R", 2: "Y", 3: "B" };

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
  const [shown, setShown] = useState(PAGE);

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

  const toggle = (facet: string, value: string) => {
    const choices = { ...state[facet] };
    if (choices[value] === "include") delete choices[value];
    else choices[value] = "include";
    setState({ ...state, [facet]: choices });
    setShown(PAGE);
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
              setShown(PAGE);
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
              setShown(PAGE);
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
              setShown(PAGE);
            }}
          >
            Clear filters
          </button>
        )}
      </p>

      <ul className={styles.results} aria-label="Cards to add">
        {found.slice(0, shown).map((card) => {
          const variants = card.variants.filter((v) =>
            pitchShown(state, v.pitch),
          );
          const image = variants.find((v) => v.imageUrl)?.imageUrl;
          const art = image ? (
            <img src={image} alt="" loading="lazy" />
          ) : (
            <span className={styles.standIn}>{card.name}</span>
          );
          // Cards without a pitch (weapons, equipment): add to the deck or the sideboard from
          // symbols over the picture, shown on hover (always on touch screens).
          const single = variants.length === 1 && variants[0]!.pitch === null;
          if (single) {
            const v = variants[0]!;
            const q = props.quantityOf(v.id);
            const place = props.placeOf(v.id);
            const full = props.atLimit(v.id);
            return (
              <li key={card.id} aria-label={card.name} className={styles.tile}>
                <span className={styles.art} title={card.name}>
                  {art}
                  <span
                    className={styles.overlay}
                    role="group"
                    aria-label={card.name}
                  >
                    <button
                      type="button"
                      className={styles.overlayButton}
                      aria-label={`Add ${card.name}`}
                      title={
                        full
                          ? `At most ${props.limitOf(v.id)} ${props.limitOf(v.id) === 1 ? "copy" : "copies"}`
                          : "Add to the deck"
                      }
                      disabled={full}
                      onClick={() => props.onAdd(v.id)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={styles.overlayButton}
                      data-sideboard=""
                      aria-label={`Add ${card.name} to the sideboard`}
                      title={
                        place === "deck"
                          ? "Already in the deck: move it from the deck list"
                          : full
                            ? `At most ${props.limitOf(v.id)} ${props.limitOf(v.id) === 1 ? "copy" : "copies"}`
                            : "Add to the sideboard"
                      }
                      disabled={place === "deck" || full}
                      onClick={() => props.onAdd(v.id, true)}
                    >
                      SB
                    </button>
                  </span>
                  {q ? (
                    <span className={styles.haveOnArt} aria-hidden="true">
                      {place === "sideboard" ? `${q} SB` : q}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          }
          return (
            <li key={card.id} aria-label={card.name} className={styles.tile}>
              <span className={styles.art} title={card.name}>
                {art}
              </span>
              <span className={styles.adds}>
                {variants.map((v) => {
                  const q = props.quantityOf(v.id);
                  const full = props.atLimit(v.id);
                  return (
                    <span key={v.id} className={styles.addWrap}>
                      <button
                        type="button"
                        className={styles.add}
                        data-pitch={v.pitch ?? "none"}
                        aria-label={`Add ${variantName(card, v)}`}
                        disabled={full}
                        title={
                          full
                            ? `At most ${props.limitOf(v.id)} ${props.limitOf(v.id) === 1 ? "copy" : "copies"}`
                            : `Add ${variantName(card, v)}`
                        }
                        onClick={() => props.onAdd(v.id)}
                      >
                        {v.pitch === null
                          ? "+"
                          : (PITCH_LETTER[v.pitch] ?? String(v.pitch))}
                      </button>
                      {q ? (
                        <span className={styles.have} aria-hidden="true">
                          {q}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      {found.length > shown && (
        <button
          type="button"
          className={styles.showMore}
          onClick={() => setShown(shown + PAGE)}
        >
          Show more · {(found.length - shown).toLocaleString("en-GB")} left
        </button>
      )}
    </div>
  );
}
