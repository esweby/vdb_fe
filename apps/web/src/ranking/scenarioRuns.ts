// Runs every built-in scenario and the traverse timeline against a core. Pure, so the same code
// runs in the Web Worker and, where there's no Worker (tests), in the page.
import {
  buildDeck,
  runScenario,
  ScenarioCannotRun,
  type ScenarioDefinition,
  type Block,
  type ConditionGroup,
  type EngineCard,
  type ScenarioResult,
} from "@vdb/engine";
import {
  runTraverse,
  type TraverseResult,
} from "@vdb/engine/rulesets/viseraiTraverse";
import { BUILT_IN_SCENARIOS } from "./scenarios.ts";

export const RUNS = 10_000;
export const TRAVERSE_TURNS = 6;

export interface ScenarioInput {
  core: { card: EngineCard; copies: number }[];
  deckSize: number;
  runs: number;
  seed: number;
}

export interface ScenarioOutput {
  scenarios: {
    name: string;
    /** Something it needs that no card in the core has (a card, or a role such as "a
     * Gate maker"); the scenario didn't run, as it could only ever fail. */
    missing?: string;
    result?: ScenarioResult;
  }[];
  traverse: { met: TraverseResult; unmet: TraverseResult };
  deck: { deckSize: number; coreCards: number; blanks: number };
  runs: number;
  seed: number;
}

const isBlock = (x: ConditionGroup | Block): x is Block => "label" in x;

/** Whether any card in the core could ever meet a block. */
function possible(b: Block, cards: EngineCard[]) {
  const f = b.filter;
  return cards.some(
    (c) =>
      (f.name === undefined || c.name === f.name) &&
      (f.role === undefined || c.roles.includes(f.role)) &&
      (f.trait === undefined || c.traits.includes(f.trait)) &&
      (f.pitch === undefined || c.pitch === f.pitch) &&
      (!b.total || (c.amounts[b.total] ?? 0) > 0),
  );
}

/** The label of the first thing a condition needs that the core doesn't have at all. */
export function lacking(
  g: ConditionGroup,
  cards: EngineCard[],
): string | undefined {
  const items = "all" in g ? g.all : g.any;
  const missing = items.map((item) =>
    isBlock(item)
      ? item.min > 0 && !possible(item, cards)
        ? item.label
        : undefined
      : lacking(item, cards),
  );
  return "all" in g
    ? missing.find((m) => m !== undefined)
    : missing.every((m) => m !== undefined)
      ? missing[0]
      : undefined;
}

export function runAll(input: ScenarioInput): ScenarioOutput {
  const deck = buildDeck(input.core, input.deckSize);
  const cards = input.core.map((c) => c.card);
  const options = { runs: input.runs, seed: input.seed };
  return {
    scenarios: BUILT_IN_SCENARIOS.map((s) => {
      const missing = lacking(s.definition.condition, cards);
      return missing
        ? { name: s.definition.name, missing }
        : {
            name: s.definition.name,
            result: runScenario(s.definition, deck, options),
          };
    }),
    traverse: {
      met: runTraverse(deck, {
        ...options,
        turns: TRAVERSE_TURNS,
        conditions: "met",
      }),
      unmet: runTraverse(deck, {
        ...options,
        turns: TRAVERSE_TURNS,
        conditions: "unmet",
      }),
    },
    deck: {
      deckSize: deck.cards.length,
      coreCards: deck.coreCards,
      blanks: deck.blanks,
    },
    runs: input.runs,
    seed: input.seed,
  };
}

/** One scenario of the user's, run against a deck (phase two step 6). */
export interface OneInput {
  definition: ScenarioDefinition;
  core: { card: EngineCard; copies: number }[];
  /** Weapons and equipment: always visible to conditions. */
  gear: EngineCard[];
  deckSize: number;
  runs: number;
  seed: number;
}

export interface OneOutput {
  result?: ScenarioResult;
  /** Why it can't run on this deck, such as fixing more copies than the deck has. */
  error?: string;
  deck: { deckSize: number; coreCards: number; blanks: number };
  runs: number;
  seed: number;
}

export function runOne(input: OneInput): OneOutput {
  const deck = buildDeck(input.core, input.deckSize, input.gear);
  const base = {
    deck: {
      deckSize: deck.cards.length,
      coreCards: deck.coreCards,
      blanks: deck.blanks,
    },
    runs: input.runs,
    seed: input.seed,
  };
  try {
    return {
      ...base,
      result: runScenario(input.definition, deck, {
        runs: input.runs,
        seed: input.seed,
      }),
    };
  } catch (e) {
    if (e instanceof ScenarioCannotRun) return { ...base, error: e.message };
    throw e;
  }
}

/** Several scenarios on one deck, in one go (condition availability). */
export interface ManyInput extends Omit<OneInput, "definition"> {
  definitions: ScenarioDefinition[];
}

export function runMany(input: ManyInput): OneOutput[] {
  return input.definitions.map((definition) =>
    runOne({ ...input, definition }),
  );
}
