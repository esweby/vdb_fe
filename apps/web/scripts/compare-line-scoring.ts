// Before and after for the line chooser (docs/turn-objectives.md, "Scoring settings"): average
// damage threatened per turn, on the same seeds, for the old policies and the new chooser.
//
//   node --experimental-transform-types apps/web/scripts/compare-line-scoring.ts \
//     --deck deck.txt [--runs 100] [--seed 20261028] [--turns 4]
//
// Cards come from the local Supabase; only verified cards play by the rules. A goldfish count, no
// opponent. UNVERIFIED, and not a calibration.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  BLOOD_DEBT,
  objectivePolicy,
  RUNECHANT,
  runBatch,
  VISERAI,
  type BatchReport,
  type BatchSetup,
} from "@vdb/engine/rules";
import { supabaseCardRepository } from "../src/cards/cardRepository.ts";
import { parseDeckList } from "../src/calibration/deckList.ts";
import { resolveDeck } from "../src/calibration/resolveDeck.ts";
import { runGateWeaponBatch } from "../src/calibration/gateWeaponBatch.ts";

const { values } = parseArgs({
  options: {
    deck: { type: "string" },
    runs: { type: "string", default: "100" },
    seed: { type: "string", default: "20261028" },
    turns: { type: "string", default: "4" },
  },
});
if (!values.deck)
  throw new Error("Usage: compare-line-scoring.ts --deck deck.txt");
const runs = Number(values.runs);
const seed = Number(values.seed);
const turns = Number(values.turns);
const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("This CLI reads only a local loopback Supabase.");
const client = createClient(url, process.env.SUPABASE_ANON_KEY ?? "");
const cards = await supabaseCardRepository(client).listCards();
const resolved = resolveDeck(
  parseDeckList(readFileSync(values.deck, "utf8")),
  cards,
);
if (resolved.missing.length)
  throw new Error(`Cards not found: ${resolved.missing.join(", ")}`);
const setup: BatchSetup = {
  deck: resolved.deck,
  weapons: resolved.weapons,
  equipment: resolved.equipment,
  side: "forsaken",
  triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
};

/** Mean threatened per turn over completed runs, and over turns 1 to `turns`. */
function threatened(report: BatchReport) {
  const done = report.perRun.filter((r) => r.completed);
  const byTurn = Array.from({ length: turns }, (_, t) => {
    const reached = done.flatMap((r) => (r.turns[t] ? [r.turns[t]!] : []));
    return reached.reduce((n, r) => n + r.threatened, 0) / reached.length;
  });
  return {
    completed: done.length,
    byTurn: byTurn.map((n) => Number(n.toFixed(2))),
    mean: Number((byTurn.reduce((a, b) => a + b, 0) / turns).toFixed(2)),
    flipBy: done.filter((r) => r.firstTraverseTurn !== null).length,
  };
}

const options = { runs, seed };
// The old policies need explicit answers; the full analysis's first case. The chooser's search
// answers "a hero has lost life" from Viserai's own life, and "less life" no.
const choices = {
  conditions: {
    hero_lost_life_this_turn: false,
    less_life_than_opposing_hero: false,
  },
};
const time = <T>(f: () => T) => {
  const t = performance.now();
  const result = f();
  return { result, ms: Math.round(performance.now() - t) };
};
const rows = {
  baseline: time(() =>
    runGateWeaponBatch(setup, { ...options, choices, turns, mode: "baseline" }),
  ),
  "full analysis (reviewed-delayed-hands-v2)": time(() =>
    runGateWeaponBatch(setup, {
      ...options,
      choices,
      turns,
      mode: "both",
      startingLife: 40,
      decisions: { traverseBack: true },
    }),
  ),
  "line chooser (defaults)": time(() =>
    runBatch(
      setup,
      { version: 1, steps: [] },
      { ...options, policy: objectivePolicy({ turns }) },
    ),
  ),
};
console.log(
  `${resolved.deck.length} cards (${resolved.coverage.copies.modelled} with verified rules), ${runs} runs, seed ${seed}`,
);
for (const [name, { result, ms }] of Object.entries(rows))
  console.log(name, JSON.stringify({ ...threatened(result), ms }));
