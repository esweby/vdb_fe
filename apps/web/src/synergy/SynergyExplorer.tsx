import { deriveSynergies, rolesOf, SYNERGY_RULES } from "@vdb/cards";
import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useCards } from "../cards/useCards.ts";
import { weightedEdges, type WeightedEdge } from "../ranking/synergyCore.ts";
import { useServices } from "../servicesContext.ts";
import { Button, ErrorBoundary, LoadError, Loading } from "../ui/index.ts";
import { ENGINE_COLOURS, STATUS_COLOURS } from "./colours.ts";
import {
  bestNextCards,
  bestWith,
  cardLinks,
  ENGINE_IDS,
  explorerView,
  isolatedCards,
  linesThrough,
  type ExplorerSettings,
  type Source,
  type Start,
} from "./explorer.ts";
import { cardScores, hiddenGems, packages } from "./discover.ts";
import { formatScore } from "../scoring/scoreFormat.ts";
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
/** How sure we are of a link, in words (maintainer, 19 Oct 2026). */
const statusLabel = (e: WeightedEdge) =>
  e.status === "suggested"
    ? "suggested"
    : e.status === "confirmed"
      ? `confirmed by ${e.raters}`
      : e.status === "disputed"
        ? `disputed by ${e.raters}`
        : `added by the scoring group (${e.raters})`;

/** How a package's card names the others. */
const RULE_VERB: Record<string, string> = {
  "tutor-finds": "searches for them",
  "enables-play-from-banish": "lets them be played from banish",
  supports: "works with them",
  community: "the scoring group links them",
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
function ExplorerBody(props: {
  settings: ExplorerSettings;
  /** `push`: a step Back can return from (selecting a card). */
  onChange: (patch: Partial<ExplorerSettings>, push?: boolean) => void;
  onBack: () => void;
  scope?: ExplorerScope;
}) {
  const { settings, onChange: go, scope } = props;
  const { synergy, scores } = useServices();
  const { status, items, retry } = useCards();
  const [data, setData] = useState<{
    weights: Record<string, number>;
    edges: CommunityEdgeRow[];
    feedback: CommunityFeedbackRow[];
  } | null>(null);
  const [query, setQuery] = useState("");
  // The card being pointed at, in the graph or the panel, for the preview.
  const [preview, setPreview] = useState<string | null>(null);
  // A line or package picked out in the graph. A line belongs to the card it was shown from.
  const [picked, setPicked] = useState<{
    key: string;
    card?: string;
    cards: string[];
    steps?: [string, string][];
  } | null>(null);
  // The scoring group's ratings, for hidden gems; none if they can't be loaded.
  const [ratings, setRatings] = useState<Map<string, number> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const listId = useId();

  useEffect(() => {
    let live = true;
    Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
    ]).then(
      ([dimensions, rows, min]) => {
        const overall = dimensions.find((d) => d.key === "overall");
        if (live)
          setRatings(overall ? cardScores(rows, overall.id, min) : new Map());
      },
      () => live && setRatings(new Map()),
    );
    return () => {
      live = false;
    };
  }, [scores]);

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
  const shownPick =
    picked && (!picked.card || picked.card === settings.card)
      ? picked
      : undefined;
  const view = useMemo(
    () =>
      explorerView({
        cards,
        edges,
        settings,
        coreIds: scopeIds,
        include: shownPick?.cards,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, edges, JSON.stringify(settings), scopeIds.join(), shownPick?.key],
  );
  // A picked line or package is drawn on its own, laid out for just its cards: in the whole
  // pool's layout a package's cards sit on top of each other.
  const drawn = useMemo(() => {
    if (!shownPick) return view;
    const cardsIn = new Set(shownPick.cards);
    const steps = shownPick.steps
      ? new Set(shownPick.steps.map(([a, b]) => `${a}\u0000${b}`))
      : null;
    return {
      nodes: view.nodes.filter((n) => cardsIn.has(n.id)),
      // All of its own links, whatever the refine settings hide elsewhere.
      edges: edges.filter((e) =>
        steps
          ? steps.has(`${e.from}\u0000${e.to}`)
          : cardsIn.has(e.from) && cardsIn.has(e.to),
      ),
    };
  }, [view, edges, shownPick]);
  const packageList = useMemo(() => packages(edges), [edges]);
  // Discover lists start short, so they don't bury Refine (the maintainer, 20 Oct 2026).
  const [showAll, setShowAll] = useState({ packages: false, gems: false });
  const gems = useMemo(
    () => (ratings ? hiddenGems(edges, ratings) : []),
    [edges, ratings],
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
  // Ranked by link strength × the partner's rating (unrated counts as middling).
  const best = selected
    ? bestWith(selected.id, edges, ratings ?? new Map())
    : [];
  const lines = selected ? linesThrough(selected.id, edges) : [];

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
              {walk(other(e))} · {e.weight} · {statusLabel(e)}
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
            nodes={drawn.nodes}
            edges={drawn.edges}
            selected={settings.card}
            // A card's own view is already framed around it.
            follow={settings.start !== "card"}
            onSelect={select}
            onHover={setPreview}
            highlight={shownPick}
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
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.disputed}
              onChange={(e) => go({ disputed: e.target.checked })}
            />
            Show disputed links
          </label>
          <p className={styles.muted}>
            Links: <span style={{ color: STATUS_COLOURS.suggested }}>■</span>{" "}
            suggested by the rules{" "}
            <span style={{ color: STATUS_COLOURS.confirmed }}>■</span> confirmed
            by scorers{" "}
            <span style={{ color: STATUS_COLOURS.community }}>■</span> added by
            scorers <span style={{ color: STATUS_COLOURS.disputed }}>■</span>{" "}
            disputed. Thicker is stronger; arrows point at the card helped.
          </p>
        </section>
        <section className={styles.group}>
          <h2>Discover</h2>
          <h3>Packages</h3>
          {packageList.length === 0 ? (
            <p className={styles.muted}>
              No packages yet: they come from cards that name others, and links
              the scoring group adds.
            </p>
          ) : (
            <ul aria-label="Packages" className={styles.links}>
              {packageList.slice(0, showAll.packages ? 8 : 3).map((p) => {
                const members = [...p.referrers, ...p.targets];
                const key = `package:${p.id}`;
                const shown = shownPick?.key === key;
                const inScope = scope
                  ? members.filter((id) => scope.cardIds.includes(id)).length
                  : 0;
                return (
                  <li key={key}>
                    <strong>{p.referrers.map(nameOf).join(" + ")}</strong> ·{" "}
                    {members.length} cards
                    {scope && ` · ${inScope} in ${scope.label}`}
                    <span className={styles.reasons}>
                      {p.why.map((w) => (
                        <span
                          key={`${w.card}:${w.rule}`}
                          className={styles.step}
                        >
                          {nameOf(w.card)}: {RULE_VERB[w.rule] ?? w.rule}
                        </span>
                      ))}
                      <span className={styles.step}>
                        {p.targets.map(nameOf).join(", ")}
                      </span>
                    </span>
                    <Button
                      className={styles.inGraph}
                      onClick={() =>
                        setPicked(shown ? null : { key, cards: members })
                      }
                    >
                      {shown ? "Hide" : "Show in graph"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {packageList.length > 3 && (
            <Button
              variant="ghost"
              onClick={() =>
                setShowAll((a) => ({ ...a, packages: !a.packages }))
              }
            >
              {showAll.packages
                ? "Show fewer packages"
                : `Show all ${Math.min(packageList.length, 8)} packages`}
            </Button>
          )}
          <h3>Hidden gems</h3>
          {gems.length === 0 ? (
            <p className={styles.muted}>
              No hidden gems yet: they need cards the scoring group has rated.
            </p>
          ) : (
            <ul aria-label="Hidden gems" className={styles.links}>
              {gems.slice(0, showAll.gems ? undefined : 3).map((g) => {
                const key = `gem:${g.id}`;
                const shown = shownPick?.key === key;
                return (
                  <li key={g.id}>
                    {walk(g.id)} · rated {formatScore(g.score)} · works with{" "}
                    {g.partners.length}{" "}
                    {g.partners.length === 1 ? "card" : "cards"} rated 7 or
                    more: {g.partners.slice(0, 3).map(nameOf).join(", ")}
                    {g.partners.length > 3 &&
                      ` and ${g.partners.length - 3} more`}
                    <Button
                      className={styles.inGraph}
                      onClick={() =>
                        setPicked(
                          shown ? null : { key, cards: [g.id, ...g.partners] },
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
          {gems.length > 3 && (
            <Button
              variant="ghost"
              onClick={() => setShowAll((a) => ({ ...a, gems: !a.gems }))}
            >
              {showAll.gems
                ? "Show fewer gems"
                : `Show all ${gems.length} gems`}
            </Button>
          )}
          <p className={styles.muted}>
            Low-rated cards linked strongly to high-rated ones: underrated, or a
            link worth a second look. Thresholds are unverified.
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
            <p className={styles.bestWith}>
              {best.length === 0
                ? "Best with: nothing yet."
                : `Best with: ${best
                    .map(
                      (b) =>
                        `${nameOf(b.id)} (${
                          b.edge.reasons.length > 0
                            ? (DESCRIPTIONS.get(b.edge.reasons[0]!) ??
                              b.edge.reasons[0])
                            : "a link the scoring group added"
                        } · ${statusLabel(b.edge)})`,
                    )
                    .join(", ")}.`}
            </p>
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
                  const key = `line:${l.cards.join("→")}`;
                  const shown = shownPick?.key === key;
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
                        className={styles.inGraph}
                        onClick={() =>
                          setPicked(
                            shown
                              ? null
                              : {
                                  key,
                                  card: selected.id,
                                  cards: [...l.cards],
                                  steps: [
                                    [l.cards[0], l.cards[1]],
                                    [l.cards[1], l.cards[2]],
                                  ],
                                },
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
    disputed: false,
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

/** The explorer, kept from blanking the page if it crashes. */
export function SynergyExplorer(props: ComponentProps<typeof ExplorerBody>) {
  return (
    <ErrorBoundary what="The synergy graph">
      <ExplorerBody {...props} />
    </ErrorBoundary>
  );
}
