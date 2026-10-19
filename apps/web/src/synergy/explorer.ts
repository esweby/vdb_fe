// The synergy explorer (maintainer, 19 Oct 2026): a graph-only tool. The side panel chooses
// where to start (a card, your core, or everything) and refines what's drawn (engines, where
// links come from, how strong); the graph shows the answer, and you walk from card to card.
import { ROLES, type Engine, type RoleId } from "@vdb/cards";
import type { WeightedEdge } from "../ranking/synergyCore.ts";

export type Start = "card" | "core" | "all";
export type Source = "both" | "rule" | "community";

export interface ExplorerSettings {
  start: Start;
  /** The selected card's id. */
  card: string | undefined;
  /** Engines whose links are drawn; empty means all. */
  engines: Engine[];
  source: Source;
  /** Minimum link strength, 0–1. */
  min: number;
  /** Show links the scoring group disputes (hidden by default). */
  disputed: boolean;
}

export interface ExplorerCard {
  id: string;
  name: string;
  roles: RoleId[];
}

export interface ExplorerNode {
  id: string;
  name: string;
  engine: Engine | null;
  inCore: boolean;
  selected: boolean;
  /** Links from the selected card (0 for the card itself); null when not starting from one. */
  distance: number | null;
}

export const ENGINE_IDS: Engine[] = [
  "gate",
  "banish",
  "runechant",
  "aura",
  "tempo",
  "usurp",
];

const engineOf = new Map(ROLES.map((r) => [r.id, r.engine]));

/** Most telling first: Runechants and auras come with most Shadow cards, so they come last. */
const ENGINE_PRIORITY: Engine[] = [
  "gate",
  "usurp",
  "banish",
  "tempo",
  "runechant",
  "aura",
];

/** The engine a card is coloured by: its most telling one, or none. */
export function primaryEngine(roles: RoleId[]): Engine | null {
  const engines = new Set(roles.map((id) => engineOf.get(id)));
  return ENGINE_PRIORITY.find((e) => engines.has(e)) ?? null;
}

/** The links the refine settings let through. */
function refine(edges: WeightedEdge[], s: ExplorerSettings): WeightedEdge[] {
  return edges.filter(
    (e) =>
      (s.disputed || e.status !== "disputed") &&
      e.weight >= s.min &&
      (s.source === "both" || e.kind === "both" || e.kind === s.source) &&
      (s.engines.length === 0 ||
        e.bucket === "community" ||
        e.bucket === "reference" ||
        (s.engines as string[]).includes(e.bucket)),
  );
}

export function explorerView(input: {
  cards: ExplorerCard[];
  edges: WeightedEdge[];
  settings: ExplorerSettings;
  coreIds: string[];
  /** In the core view, how many cards outside the core to show: those linking to it most. */
  near?: number;
  /** Cards to show whatever the view, e.g. a package picked out in the graph. */
  include?: string[];
}): { nodes: ExplorerNode[]; edges: WeightedEdge[] } {
  const s = input.settings;
  const links = refine(input.edges, s);
  const neighbours = new Map<string, Set<string>>();
  const add = (a: string, b: string) =>
    neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b));
  for (const e of links) {
    add(e.from, e.to);
    add(e.to, e.from);
  }

  const core = new Set(input.coreIds);
  const distance = new Map<string, number>();
  let shown: Set<string>;
  if (s.start === "card") {
    // One link out, either way round: the rules link whole groups, so two pulls in about
    // a hundred cards. Walking from card to card goes further.
    if (s.card && input.cards.some((c) => c.id === s.card)) {
      distance.set(s.card, 0);
      let frontier = [s.card];
      for (let d = 1; d <= 1; d++) {
        const next: string[] = [];
        for (const id of frontier)
          for (const n of neighbours.get(id) ?? [])
            if (!distance.has(n)) {
              distance.set(n, d);
              next.push(n);
            }
        frontier = next;
      }
    }
    shown = new Set(distance.keys());
  } else if (s.start === "core") {
    // A real core links to well over a hundred cards, so only those linking to it most.
    shown = new Set(core);
    for (const c of bestNextCards([...core], links, input.near ?? 10))
      shown.add(c.id);
  } else {
    shown = new Set(neighbours.keys());
  }

  for (const id of input.include ?? []) shown.add(id);

  return {
    nodes: input.cards
      .filter((c) => shown.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        engine: primaryEngine(c.roles),
        inCore: core.has(c.id),
        selected: c.id === s.card,
        distance: s.start === "card" ? (distance.get(c.id) ?? null) : null,
      })),
    edges: links.filter((e) => shown.has(e.from) && shown.has(e.to)),
  };
}

/** Every link to or from a card, strongest first, whatever the filters. */
export function cardLinks(cardId: string, edges: WeightedEdge[]) {
  const byWeight = (a: WeightedEdge, b: WeightedEdge) => b.weight - a.weight;
  return {
    helps: edges.filter((e) => e.from === cardId).sort(byWeight),
    helpedBy: edges.filter((e) => e.to === cardId).sort(byWeight),
  };
}

export interface ExplorerSearch {
  start?: Start;
  card?: string;
  /** Engines, comma separated. */
  eng?: string;
  src?: Exclude<Source, "both">;
  /** Minimum strength as a percentage. */
  min?: number;
  /** 1: show disputed links. */
  disp?: number;
}

const DEFAULT_MIN = 0.5;

export function readExplorerSearch(
  search: Partial<Record<keyof ExplorerSearch, unknown>>,
): ExplorerSettings {
  const card =
    typeof search.card === "string" && search.card ? search.card : undefined;
  const start: Start =
    search.start === "card" || search.start === "core" || search.start === "all"
      ? search.start
      : card
        ? "card"
        : "all";
  const min = Number(search.min);
  return {
    start,
    card,
    engines:
      typeof search.eng === "string"
        ? (search.eng
            .split(",")
            .filter((e) => (ENGINE_IDS as string[]).includes(e)) as Engine[])
        : [],
    source:
      search.src === "rule" || search.src === "community" ? search.src : "both",
    min:
      search.min !== undefined && search.min !== "" && Number.isFinite(min)
        ? Math.min(100, Math.max(0, Math.round(min))) / 100
        : DEFAULT_MIN,
    disputed: search.disp === 1 || search.disp === "1",
  };
}

/** Only what differs from the defaults is written, to keep URLs short. */
export function writeExplorerSearch(s: ExplorerSettings): ExplorerSearch {
  const impliedStart: Start = s.card ? "card" : "all";
  return {
    ...(s.start !== impliedStart ? { start: s.start } : {}),
    ...(s.card ? { card: s.card } : {}),
    ...(s.engines.length ? { eng: s.engines.join(",") } : {}),
    ...(s.source !== "both" ? { src: s.source } : {}),
    ...(s.min !== DEFAULT_MIN ? { min: Math.round(s.min * 100) } : {}),
    ...(s.disputed ? { disp: 1 } : {}),
  };
}

/** Cards in a core or deck that link to nothing else in it, in the order given. */
export function isolatedCards(
  scopeIds: string[],
  edges: WeightedEdge[],
): string[] {
  const scope = new Set(scopeIds);
  const linked = new Set<string>();
  for (const e of edges) {
    if (e.from === e.to || !scope.has(e.from) || !scope.has(e.to)) continue;
    linked.add(e.from);
    linked.add(e.to);
  }
  return [...scope].filter((id) => !linked.has(id));
}

/**
 * Cards outside a core or deck, by how strongly they link to it, either way round: the sum
 * of their links' weights, then how many. A suggestion of what to look at, not a ranking of
 * how good the card is.
 */
export function bestNextCards(
  scopeIds: string[],
  edges: WeightedEdge[],
  limit = 5,
): { id: string; links: number; strength: number }[] {
  const scope = new Set(scopeIds);
  const pull = new Map<string, { links: number; strength: number }>();
  for (const e of edges) {
    const outside = scope.has(e.from) ? e.to : scope.has(e.to) ? e.from : null;
    if (!outside || scope.has(outside)) continue;
    const p = pull.get(outside) ?? { links: 0, strength: 0 };
    pull.set(outside, { links: p.links + 1, strength: p.strength + e.weight });
  }
  return [...pull]
    .map(([id, p]) => ({
      id,
      links: p.links,
      strength: Math.round(p.strength * 100) / 100,
    }))
    .sort((a, b) => b.strength - a.strength || b.links - a.links)
    .slice(0, limit);
}

export interface Line {
  /** Three card ids: each helps the next. */
  cards: [string, string, string];
  steps: [WeightedEdge, WeightedEdge];
  /** A chain is only as strong as its weakest link. */
  weakest: number;
  total: number;
  traverse: boolean;
  /** Its two steps are in different engines: the less obvious idea. */
  crosses: boolean;
  /** How many weaker lines share this one's card next to the selected card. */
  alike: number;
}

/**
 * Three-card chains through a card, at any position (maintainer, 19 Oct 2026): A helps B,
 * which helps C. The middle card is the glue a plain list of links doesn't show. Strongest
 * weakest link first, then lines crossing from one engine into another, then the strongest
 * overall. Loops back to the first card are left out.
 */
export function linesThrough(
  cardId: string,
  edges: WeightedEdge[],
  limit = 5,
): Line[] {
  const out = new Map<string, WeightedEdge[]>();
  const into = new Map<string, WeightedEdge[]>();
  for (const e of edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
    into.set(e.to, [...(into.get(e.to) ?? []), e]);
  }
  const found = new Map<string, Line>();
  const add = (a: WeightedEdge, b: WeightedEdge) => {
    if (a.from === b.to || a.from === a.to || b.from === b.to) return;
    const key = `${a.from}\u0000${a.to}\u0000${b.to}`;
    if (found.has(key)) return;
    found.set(key, {
      cards: [a.from, a.to, b.to],
      steps: [a, b],
      weakest: Math.min(a.weight, b.weight),
      total: Math.round((a.weight + b.weight) * 100) / 100,
      traverse: a.traverse || b.traverse,
      crosses: a.bucket !== b.bucket,
      alike: 0,
    });
  };
  // The card first, in the middle, or last.
  for (const a of out.get(cardId) ?? [])
    for (const b of out.get(a.to) ?? []) add(a, b);
  for (const a of into.get(cardId) ?? [])
    for (const b of out.get(cardId) ?? []) add(a, b);
  for (const b of into.get(cardId) ?? [])
    for (const a of into.get(b.from) ?? []) add(a, b);
  // Lines sharing the card next to this one say the same thing (Cull's top five were all
  // "X → Breach Flesh → Cull"), so keep the strongest of each and count the rest.
  const groups = new Map<string, Line>();
  for (const l of [...found.values()].sort(
    (x, y) =>
      y.weakest - x.weakest ||
      Number(y.crosses) - Number(x.crosses) ||
      y.total - x.total,
  )) {
    const key =
      l.cards[1] === cardId ? `before:${l.cards[0]}` : `middle:${l.cards[1]}`;
    const kept = groups.get(key);
    if (kept) kept.alike += 1;
    else groups.set(key, l);
  }
  return [...groups.values()].slice(0, limit);
}

/**
 * "Best with" (maintainer, 19 Oct 2026): a card's partners, either way round, by link strength
 * times the partner's rating (0–100; an unrated partner counts as 50), with a confirmed link
 * counting a quarter more. Disputed links are left out. Each partner comes with its strongest link to the card.
 */
/** A link the scoring group confirmed counts for a quarter more (maintainer, 19 Oct 2026). */
const CONFIRMED_BOOST = 1.25;

export function bestWith(
  cardId: string,
  edges: WeightedEdge[],
  ratings: Map<string, number>,
  limit = 3,
): { id: string; edge: WeightedEdge; score: number }[] {
  const best = new Map<
    string,
    { id: string; edge: WeightedEdge; score: number }
  >();
  for (const e of edges) {
    if (e.status === "disputed") continue;
    const other = e.from === cardId ? e.to : e.to === cardId ? e.from : null;
    if (!other || other === cardId) continue;
    const score =
      e.weight *
      ((ratings.get(other) ?? 50) / 100) *
      (e.status === "confirmed" ? CONFIRMED_BOOST : 1);
    const kept = best.get(other);
    if (!kept || score > kept.score)
      best.set(other, { id: other, edge: e, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
