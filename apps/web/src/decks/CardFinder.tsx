import { useMemo, useState } from "react";
import type { CardSummary } from "../cards/cardRepository.ts";
import { cardFacets, pitchShown } from "../cards/facets.ts";
import { searchAndSort } from "../cards/filterCards.ts";
import { pitchName } from "../cards/pitch.ts";
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

/**
 * Cards to add to a deck: shown straight away, narrowed by a search, quiet pitch and class
 * toggles, and the card database's other filters folded away under More filters.
 */
export function CardFinder(props: {
  cards: CardSummary[];
  quantityOf: (variantId: string) => number | undefined;
  atLimit: (variantId: string) => boolean;
  copyLimit: number;
  onAdd: (variantId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<FilterState>({});
  const [more, setMore] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const found = useMemo(
    () =>
      applyFilters(searchAndSort(props.cards, query, "name"), facets, state),
    [props.cards, query, state],
  );

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
      <label className={styles.search}>
        <span className={styles.visuallyHidden}>Find cards</span>
        <input
          type="search"
          placeholder="Find cards"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
        />
      </label>

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
        <button
          type="button"
          className={styles.more}
          aria-expanded={more}
          aria-label="More filters"
          onClick={() => setMore(!more)}
        >
          Filters
          {moreCount > 0 && (
            <span className={styles.count} aria-hidden="true">
              {moreCount}
            </span>
          )}
          <span aria-hidden="true">{more ? "▴" : "▾"}</span>
        </button>
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
          return (
            <li key={card.id} aria-label={card.name} className={styles.row}>
              <span className={styles.thumb} aria-hidden="true">
                {image && <img src={image} alt="" loading="lazy" />}
              </span>
              <span className={styles.info}>
                <span className={styles.name}>{card.name}</span>
                <span className={styles.type}>{typeLine(card)}</span>
              </span>
              <span className={styles.adds}>
                {variants.map((v) => {
                  const q = props.quantityOf(v.id);
                  const full = props.atLimit(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={styles.add}
                      data-pitch={v.pitch ?? "none"}
                      aria-label={`Add ${variantName(card, v)}`}
                      disabled={full}
                      title={
                        full
                          ? `At most ${props.copyLimit} copies`
                          : `Add ${variantName(card, v)}`
                      }
                      onClick={() => props.onAdd(v.id)}
                    >
                      <span aria-hidden="true">+</span>
                      {v.pitch === null
                        ? ""
                        : ` ${pitchName(v.pitch).charAt(0)}`}
                      {q ? <span className={styles.have}>{q}</span> : null}
                    </button>
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
