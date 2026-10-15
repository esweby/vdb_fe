// Runs every built-in scenario and the traverse timeline against a core. Pure, so the same code
// runs in the Web Worker and, where there's no Worker (tests), in the page.
import {
  buildDeck,
  runScenario,
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
    /** A needed card that isn't in the core; the scenario didn't run. */
    missing?: string;
    result?: ScenarioResult;
  }[];
  traverse: { met: TraverseResult; unmet: TraverseResult };
  deck: { deckSize: number; coreCards: number; blanks: number };
  runs: number;
  seed: number;
}

export function runAll(input: ScenarioInput): ScenarioOutput {
  const deck = buildDeck(input.core, input.deckSize);
  const names = new Set(input.core.map((c) => c.card.name));
  const options = { runs: input.runs, seed: input.seed };
  return {
    scenarios: BUILT_IN_SCENARIOS.map((s) => {
      const missing = s.needs?.find((n) => !names.has(n));
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
