// The engine board's lanes, read from the card roles in @vdb/cards (docs/roles.md).
// UNVERIFIED: the roles are a first pass for the maintainer to correct.
import {
  fits,
  ROLES,
  type Engine,
  type RoleId,
  type RoleKind,
} from "@vdb/cards";
import type { PitchTargets } from "../decks/deckRepository.ts";

export type HeroSide = "forsaken" | "usurper" | "both";

export interface EngineDef {
  id: Engine;
  name: string;
  /** The side this engine matters most to; it comes first when that side is chosen. */
  side: HeroSide;
  /** What the hero does with it (README "The hero"). */
  note: string;
  generators: string;
  payoffs: string;
  /** Short words for the core's balance, e.g. "3 make", "2 targets". */
  makeWord: string;
  useWord: string;
  noGenerators: string;
  noPayoffs: string;
}

export const ENGINES: EngineDef[] = [
  {
    id: "runechant",
    name: "Runechant engine",
    side: "forsaken",
    note: "Forsaken banishes your top card when you create Runechants, and traverses at 3 in a turn.",
    generators: "Make Runechants",
    payoffs: "Use Runechants",
    makeWord: "make",
    useWord: "use",
    noGenerators: "Nothing makes Runechants yet.",
    noPayoffs: "Nothing uses Runechants yet.",
  },
  {
    id: "gate",
    name: "Gate engine",
    side: "usurper",
    note: "Usurper gives the first blood debt attack each turn go again, and traverses after you create or use a Gate.",
    generators: "Make Gates",
    payoffs: "Gate targets",
    makeWord: "make",
    useWord: "targets",
    noGenerators: "Nothing makes Gates yet.",
    noPayoffs: "No Gate targets yet.",
  },
  {
    id: "banish",
    name: "Banish engine",
    side: "both",
    note: "Both sides fill the banished zone; these cards make use of it.",
    generators: "Banish your cards",
    payoffs: "Use the banished zone",
    makeWord: "banish",
    useWord: "use",
    noGenerators: "Nothing banishes your cards yet.",
    noPayoffs: "Nothing uses the banished zone yet.",
  },
  {
    id: "aura",
    name: "Aura engine",
    side: "both",
    note: "Runechants, Gates and Eloquence are all aura tokens.",
    generators: "Make auras",
    payoffs: "Care about auras",
    makeWord: "make",
    useWord: "use",
    noGenerators: "Nothing makes auras yet.",
    noPayoffs: "Nothing cares about auras yet.",
  },
  {
    id: "tempo",
    name: "Tempo engine",
    side: "both",
    note: "More action cards in a turn.",
    generators: "Give go again",
    payoffs: "Need an action played first",
    makeWord: "give",
    useWord: "use",
    noGenerators: "Nothing gives go again yet.",
    noPayoffs: "Nothing needs an action played first yet.",
  },
];

/** Starting pitch targets when a deck has none: the example in docs/phase-one.md. UNVERIFIED. */
export const EXAMPLE_TARGETS: PitchTargets = { 1: 18, 2: 5, 3: 22 };

/** The chosen side's engine first; otherwise the order above. */
export function engineOrder(side: HeroSide): EngineDef[] {
  if (side === "both") return ENGINES;
  return [
    ...ENGINES.filter((e) => e.side === side),
    ...ENGINES.filter((e) => e.side !== side),
  ];
}

const roleById = new Map<string, (typeof ROLES)[number]>(
  ROLES.map((r) => [r.id, r]),
);

/** Whether a card with these roles belongs in an engine's generator or payoff lane. */
export function inLane(roles: RoleId[], engine: Engine, kind: RoleKind) {
  return roles.some((id) => {
    const r = roleById.get(id);
    return r?.engine === engine && r.kind === kind;
  });
}

/** Whether any of these roles links to anything. */
export const linked = (roles: RoleId[]) =>
  roles.some((id) => roleById.get(id)?.kind != null);

export interface CoreCard {
  name: string;
  roles: RoleId[];
  quantity: number;
}

/** The cards in the core that a card fits with, by name (other pitches of itself don't count). */
export function partners(
  name: string,
  roles: RoleId[],
  core: CoreCard[],
): string[] {
  const names = core
    .filter((c) => c.name !== name && fits(roles, c.roles))
    .map((c) => c.name);
  return [...new Set(names)];
}

/** Copies of generators and payoffs in an engine. A card with both counts on both sides. */
export function balance(core: CoreCard[], engine: Engine) {
  const sum = (kind: RoleKind) =>
    core
      .filter((c) => inLane(c.roles, engine, kind))
      .reduce((n, c) => n + c.quantity, 0);
  return { generators: sum("generator"), payoffs: sum("payoff") };
}

/** A lane by value, or by fits first and then value. */
export function sortLane<T extends { value: number; fits: number }>(
  items: T[],
  order: "score" | "fits",
): T[] {
  return [...items].sort((a, b) =>
    order === "fits" ? b.fits - a.fits || b.value - a.value : b.value - a.value,
  );
}
