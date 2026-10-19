import { deriveSynergies, rolesOf, SYNERGY_RULES } from "@vdb/cards";
import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
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
import {
  cardLinks,
  ENGINE_IDS,
  explorerView,
  readExplorerSearch,
  writeExplorerSearch,
  type ExplorerSettings,
  type Source,
  type Start,
} from "./explorer.ts";
import { ENGINE_COLOURS, KIND_COLOURS } from "./colours.ts";
import styles from "./SynergyExplorerPage.module.css";

const route = getRouteApi("/synergies");
// sigma.js (WebGL) loads only when this page opens, not with the rest of the app.
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

/** The core as the ranking keeps it in the URL: variant id → copies. */
function readCore(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(
    Object.entries(v).filter(
      (e): e is [string, number] => typeof e[1] === "number" && e[1] > 0,
    ),
  );
}

/**
 * The synergy explorer (maintainer, 19 Oct 2026): a graph of how cards work together, with a
 * side panel to choose where to start, refine what's drawn, and walk from card to card.
 */
export function SynergyExplorerPage() {
  const { synergy } = useServices();
  const { status, items, retry } = useCards();
  const search = route.useSearch() as Record<string, unknown>;
  const navigate = useNavigate();
  const router = useRouter();
  const settings = readExplorerSearch(search);
  const core = readCore(search.core);
  const [data, setData] = useState<{
    weights: Record<string, number>;
    edges: CommunityEdgeRow[];
    feedback: CommunityFeedbackRow[];
  } | null>(null);
  const [query, setQuery] = useState("");
  // The card being pointed at, in the graph or the panel, for the preview.
  const [preview, setPreview] = useState<string | null>(null);
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
  const coreIds = useMemo(
    () =>
      items.filter((c) => c.variants.some((v) => core[v.id])).map((c) => c.id),
    // The core object is new on every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, JSON.stringify(core)],
  );
  const view = useMemo(
    () => explorerView({ cards, edges, settings, coreIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, edges, JSON.stringify(settings), coreIds],
  );

  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (status !== "loaded" || !data)
    return <Loading label="Loading the synergies" />;

  const nameOf = (id: string) => items.find((c) => c.id === id)?.name ?? id;
  const go = (patch: Partial<ExplorerSettings>, push = false) =>
    void navigate({
      to: ".",
      replace: !push,
      search: {
        ...writeExplorerSearch({ ...settings, ...patch }),
        ...(Object.keys(core).length ? { core } : {}),
      } as never,
    });
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
  const previewCard = preview ? items.find((c) => c.id === preview) : undefined;
  // Variants come red first (cards/pitch.ts), so this is the red version's art where it has one.
  const previewImage = previewCard?.variants.find((v) => v.imageUrl)?.imageUrl;
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
              <button
                type="button"
                className={styles.walk}
                onClick={() => select(other(e))}
                onMouseEnter={() => setPreview(other(e))}
                onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(other(e))}
                onBlur={() => setPreview(null)}
              >
                {nameOf(other(e))}
              </button>{" "}
              · {e.weight} · {KIND_LABEL[e.kind]}
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

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Synergies</h1>
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
              <label
                htmlFor={`${listId}-find`}
                className={styles.visuallyHidden}
              >
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
                <option value="all">Everything</option>
                <option value="card" disabled={!settings.card}>
                  The selected card and its neighbours
                </option>
                <option value="core" disabled={coreIds.length === 0}>
                  Your core and what links to it
                </option>
              </select>
            </label>
          </section>

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
                <Button onClick={() => router.history.back()}>Back</Button>
              </div>
              {linkList(
                "Helps",
                links.helps,
                (e) => e.to,
                "Helps nothing yet.",
              )}
              {linkList(
                "Helped by",
                links.helpedBy,
                (e) => e.from,
                "Nothing helps it yet.",
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
