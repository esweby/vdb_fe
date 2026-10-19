import { deriveSynergies, rolesOf, SYNERGY_RULES } from "@vdb/cards";
import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useCards } from "../cards/useCards.ts";
import { weightedEdges, type WeightedEdge } from "../ranking/synergyCore.ts";
import { useServices } from "../servicesContext.ts";
import { Button, LoadError, Loading } from "../ui/index.ts";
import { ENGINE_COLOURS, KIND_COLOURS } from "./colours.ts";
import {
  bestNextCards,
  cardLinks,
  ENGINE_IDS,
  explorerView,
  isolatedCards,
  linesThrough,
  type ExplorerSettings,
  type Source,
  type Start,
} from "./explorer.ts";
import styles from "./SynergyExplorerPage.module.css";

// sigma.js (WebGL) loads only when an explorer opens, not with the rest of the app.
const GraphCanvas = lazy(() =>
  import("./GraphCanvas.tsx").then((m) => ({ default: m.GraphCanvas })),
);
const DESCRIPTIONS = new Map(SYNERGY_RULES.map((r) => [r.id, r.description]));
const KIND_LABEL: Record<WeightedEdge["kind"], string> = {
  rule: "rules",
  community: "scoring group",
  both: "rules and scoring group",
};
const ENGINE_LABEL: Record<string, string> = {
  gate: "Gate",
  banish: "Banish",
  runechant: "Runechant",
  aura: "Aura",
  tempo: "Tempo",
  usurp: "Usurp",
};

/** A core or deck the explorer is looking at, e.g. { label: "your core" }. */
export interface ExplorerScope {
  cardIds: string[];
  /** Lower case, as it reads mid-sentence: "your core", "this deck". */
  label: string;
}

/**
 * The synergy explorer (maintainer, 19 Oct 2026): a graph of how cards work together, with a
 * side panel to choose where to start, refine what's drawn, and walk from card to card. Used
 * by the Synergies page (the whole pool) and the Synergies tabs (a core or a deck, as `scope`).
 */
export function SynergyExplorer(props: {
  settings: ExplorerSettings;
  /** `push`: a step Back can return from (selecting a card). */
  onChange: (patch: Partial<ExplorerSettings>, push?: boolean) => void;
  onBack: () => void;
  scope?: ExplorerScope;
}) {
  const { settings, onChange: go, scope } = props;
  const { synergy } = useServices();
  const { status, items, retry } = useCards();
  const [data, setData] = useState<{
    weights: Record<string, number>;
    edges: CommunityEdgeRow[];
    feedback: CommunityFeedbackRow[];
  } | null>(null);
  const [query, setQuery] = useState("");
  // The card being pointed at, in the graph or the panel, for the preview.
  const [preview, setPreview] = useState<string | null>(null);
  // The line picked out in the graph, for the card it was shown from.
  const [shownLine, setShownLine] = useState<{
    card: string;
    cards: string[];
  } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const listId = useId();

  useEffect(() => {
    let live = true;
    Promise.all([
      synergy.listRuleWeights(),
      synergy.listCommunitySynergies(),
    ]).then(
      ([weights, community]) => live && setData({ weights, ...community }),
      // The rules still work without the admins' weights or the scoring group's links.
      () => live && setData({ weights: {}, edges: [], feedback: [] }),
    );
    return () => {
      live = false;
    };
  }, [synergy]);

  const cards = useMemo(
    () =>
      items.map((c) => ({
        id: c.id,
        name: c.name,
        roles: rolesOf({
          type: c.type,
          subtypes: c.subtypes,
          attributes: c.attributes,
          variantAttributes: c.variants.map((v) => v.attributes),
        }),
      })),
    [items],
  );
  const edges = useMemo(() => {
    if (!data) return [];
    return weightedEdges({
      derived: deriveSynergies(
        items.map((c) => ({
          ...c,
          variantAttributes: c.variants.map((v) => v.attributes),
        })),
        data.weights,
      ),
      ruleWeights: data.weights,
      feedback: data.feedback,
      community: data.edges,
    });
  }, [items, data]);
  const scopeIds = scope?.cardIds ?? [];
  const view = useMemo(
    () => explorerView({ cards, edges, settings, coreIds: scopeIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, edges, JSON.stringify(settings), scopeIds.join()],
  );

  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (status !== "loaded" || !data)
    return <Loading label="Loading the synergies" />;

  const nameOf = (id: string) => items.find((c) => c.id === id)?.name ?? id;
  // Selecting a card is a step you can go Back from.
  const select = (id: string) => go({ card: id, start: "card" }, true);

  function find(e: FormEvent) {
    e.preventDefault();
    const card = items.find(
      (c) => c.name.toLowerCase() === query.trim().toLowerCase(),
    );
    setNotFound(!card);
    if (card) {
      setQuery("");
      select(card.id);
    }
  }

  const toggleEngine = (id: (typeof ENGINE_IDS)[number]) =>
    go({
      engines: settings.engines.includes(id)
        ? settings.engines.filter((e) => e !== id)
        : [...settings.engines, id],
    });
  const minKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    const step = 0.1;
    const next = {
      ArrowRight: settings.min + step,
      ArrowUp: settings.min + step,
      ArrowLeft: settings.min - step,
      ArrowDown: settings.min - step,
      Home: 0,
      End: 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    go({ min: Math.round(Math.min(1, Math.max(0, next)) * 10) / 10 });
  };

  const selected = settings.card
    ? items.find((c) => c.id === settings.card)
    : undefined;
  const links = selected ? cardLinks(selected.id, edges) : null;
  const lines = selected ? linesThrough(selected.id, edges) : [];
  const line =
    shownLine && shownLine.card === settings.card ? shownLine.cards : undefined;
  const previewCard = preview ? items.find((c) => c.id === preview) : undefined;
  // Variants come red first (cards/pitch.ts), so this is the red version's art where it has one.
  const previewImage = previewCard?.variants.find((v) => v.imageUrl)?.imageUrl;

  /** A card name you can click to walk to, and point at to preview. */
  const walk = (id: string) => (
    <button
      type="button"
      className={styles.walk}
      onClick={() => select(id)}
      onMouseEnter={() => setPreview(id)}
      onMouseLeave={() => setPreview(null)}
      onFocus={() => setPreview(id)}
      onBlur={() => setPreview(null)}
    >
      {nameOf(id)}
    </button>
  );
  const linkList = (
    label: string,
    list: WeightedEdge[],
    other: (e: WeightedEdge) => string,
    empty: string,
  ) => (
    <>
      <h3>{label}</h3>
      {list.length === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        <ul aria-label={label} className={styles.links}>
          {list.map((e) => (
            <li key={`${e.from}→${e.to}`}>
              {walk(other(e))} · {e.weight} · {KIND_LABEL[e.kind]}
              {e.reasons.length > 0 && (
                <span className={styles.reasons}>
                  {" "}
                  · {e.reasons.map((r) => DESCRIPTIONS.get(r) ?? r).join("; ")}
                </span>
              )}
              {e.traverse && " · enables traverse"}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const isolated = scope ? isolatedCards(scope.cardIds, edges) : [];
  const next = scope ? bestNextCards(scope.cardIds, edges) : [];
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className={styles.layout}>
      <div className={styles.canvasWrap}>
        <Suspense fallback={<Loading label="Drawing the graph" />}>
          <GraphCanvas
            nodes={view.nodes}
            edges={view.edges}
            selected={settings.card}
            // A card's own view is already framed around it.
            follow={settings.start !== "card"}
            onSelect={select}
            onHover={setPreview}
            line={line}
          />
        </Suspense>
        {previewCard && (
          <figure aria-label="Card preview" className={styles.preview}>
            {previewImage ? (
              <img src={previewImage} alt={previewCard.name} />
            ) : (
              <span className={styles.standIn}>{previewCard.name}</span>
            )}
          </figure>
        )}
      </div>
      <aside aria-label="Explore" className={styles.panel}>
        <p className={styles.count}>
          {view.nodes.length} {view.nodes.length === 1 ? "card" : "cards"} ·{" "}
          {view.edges.length} {view.edges.length === 1 ? "link" : "links"}
        </p>

        <section className={styles.group}>
          <h2>Start from</h2>
          <form className={styles.find} onSubmit={find}>
            <label htmlFor={`${listId}-find`} className={styles.visuallyHidden}>
              Find a card
            </label>
            <input
              id={`${listId}-find`}
              list={listId}
              placeholder="Find a card"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setNotFound(false);
              }}
              autoComplete="off"
            />
            <datalist id={listId}>
              {items.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <Button type="submit">Go</Button>
          </form>
          {notFound && (
            <p className={styles.error}>Pick a card from the list.</p>
          )}
          <label className={styles.field}>
            <span>Show</span>
            <select
              value={settings.start}
              onChange={(e) => go({ start: e.target.value as Start })}
            >
              {scope && (
                <option value="core">
                  {capital(scope.label)} and what links to it
                </option>
              )}
              <option value="all">Everything</option>
              <option value="card" disabled={!settings.card}>
                The selected card and its neighbours
              </option>
            </select>
          </label>
        </section>

        {scope && (
          <section className={styles.group}>
            <h2>{capital(scope.label)}</h2>
            <h3>Links to nothing else in {scope.label}</h3>
            {isolated.length === 0 ? (
              <p className={styles.muted}>
                Every card links to another in {scope.label}.
              </p>
            ) : (
              <ul
                aria-label={`Links to nothing else in ${scope.label}`}
                className={styles.links}
              >
                {isolated.map((id) => (
                  <li key={id}>{walk(id)}</li>
                ))}
              </ul>
            )}
            <h3>Links most to {scope.label}</h3>
            {next.length === 0 ? (
              <p className={styles.muted}>Nothing outside links to it yet.</p>
            ) : (
              <ul
                aria-label={`Links most to ${scope.label}`}
                className={styles.links}
              >
                {next.map((c) => (
                  <li key={c.id}>
                    {walk(c.id)} · links to {c.links} of your cards · strength{" "}
                    {c.strength}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className={styles.group}>
          <h2>Refine</h2>
          <label className={styles.field}>
            <span>Links from</span>
            <select
              value={settings.source}
              onChange={(e) => go({ source: e.target.value as Source })}
            >
              <option value="both">Rules and scoring group</option>
              <option value="rule">Rules only</option>
              <option value="community">Scoring group only</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>
              Minimum strength <output>{settings.min}</output>
            </span>
            <input
              type="range"
              aria-label="Minimum strength"
              min={0}
              max={1}
              step={0.1}
              value={settings.min}
              onChange={(e) => go({ min: Number(e.target.value) })}
              onKeyDown={minKeys}
            />
          </label>
          <fieldset className={styles.engines}>
            <legend>Engines (none ticked: all)</legend>
            {ENGINE_IDS.map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={settings.engines.includes(id)}
                  onChange={() => toggleEngine(id)}
                />
                <span
                  className={styles.swatch}
                  style={{ background: ENGINE_COLOURS[id] }}
                />
                {ENGINE_LABEL[id]}
              </label>
            ))}
          </fieldset>
          <p className={styles.muted}>
            Links: <span style={{ color: KIND_COLOURS.rule }}>■</span> rules{" "}
            <span style={{ color: KIND_COLOURS.community }}>■</span> scoring
            group <span style={{ color: KIND_COLOURS.both }}>■</span> both.
            Thicker is stronger; arrows point at the card helped.
          </p>
        </section>

        {selected && links && (
          <section
            aria-labelledby={`${listId}-selected`}
            className={styles.group}
          >
            <div className={styles.selectedHead}>
              <h2 id={`${listId}-selected`}>{selected.name}</h2>
              <Button onClick={props.onBack}>Back</Button>
            </div>
            {linkList("Helps", links.helps, (e) => e.to, "Helps nothing yet.")}
            {linkList(
              "Helped by",
              links.helpedBy,
              (e) => e.from,
              "Nothing helps it yet.",
            )}
            <h3>Lines through this card</h3>
            {lines.length === 0 ? (
              <p className={styles.muted}>No lines through this card yet.</p>
            ) : (
              <ul aria-label="Lines through this card" className={styles.links}>
                {lines.map((l) => {
                  const key = l.cards.join("→");
                  const shown = line?.join("→") === key;
                  return (
                    <li key={key}>
                      <strong>{l.cards.map(nameOf).join(" → ")}</strong> ·
                      weakest link {l.weakest}
                      {l.traverse && " · enables traverse"}
                      {l.alike > 0 &&
                        ` · and ${l.alike} more ${l.cards[1] === selected.id ? `from ${nameOf(l.cards[0])}` : `through ${nameOf(l.cards[1])}`}`}
                      <span className={styles.reasons}>
                        {l.steps.map((e) => (
                          <span
                            key={`${e.from}→${e.to}`}
                            className={styles.step}
                          >
                            {nameOf(e.from)} → {nameOf(e.to)}:{" "}
                            {e.reasons.length > 0
                              ? e.reasons
                                  .map((r) => DESCRIPTIONS.get(r) ?? r)
                                  .join("; ")
                              : KIND_LABEL[e.kind]}
                          </span>
                        ))}
                      </span>
                      <Button
                        onClick={() =>
                          setShownLine(
                            shown
                              ? null
                              : { card: selected.id, cards: [...l.cards] },
                          )
                        }
                      >
                        {shown ? "Hide" : "Show in graph"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

/**
 * Explorer settings kept in memory, for a tab: selecting a card is a step Back returns from.
 * Starts on the core or deck.
 */
export function useLocalExplorer() {
  const [history, setHistory] = useState<ExplorerSettings[]>([]);
  const [settings, setSettings] = useState<ExplorerSettings>({
    start: "core",
    card: undefined,
    engines: [],
    source: "both",
    min: 0.5,
  });
  return {
    settings,
    onChange: (patch: Partial<ExplorerSettings>, push = false) => {
      if (push) setHistory((h) => [...h, settings]);
      setSettings({ ...settings, ...patch });
    },
    onBack: () => {
      const previous = history.at(-1);
      if (!previous) return;
      setHistory((h) => h.slice(0, -1));
      setSettings(previous);
    },
  };
}

/** The explorer on a core or deck, for a Synergies tab. */
export function ScopedSynergies(props: {
  scope: ExplorerScope;
  /** Shown when the core or deck is empty. */
  empty: string;
}) {
  const local = useLocalExplorer();
  if (props.scope.cardIds.length === 0)
    return <p className={styles.muted}>{props.empty}</p>;
  return <SynergyExplorer {...local} scope={props.scope} />;
}
