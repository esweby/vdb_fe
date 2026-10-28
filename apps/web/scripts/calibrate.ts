// The simulated side of engine calibration (docs/engine-calibration.md), compared with the
// observed side that services/fablazing/cmd/fablazing-observed writes.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… node apps/web/scripts/calibrate.ts \
//     --deck deck.txt --observed observed.json [--out result.json] [--runs 10000] [--seed 20261021]
//
// Cards come from the given Supabase (local by default); only verified cards play by the rules.
// T1–T4 were approved before anything was compared; T6 is checked only with --t6, once approved.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  BLOOD_DEBT,
  compare,
  MIN_OBSERVED,
  robustness,
  RUNECHANT,
  runBatch,
  simulatedDistributions,
  VISERAI,
  type ObservedGroup,
  type Threshold,
} from "@esweby/fab-engine/rules";
import { supabaseCardRepository } from "../src/cards/cardRepository.ts";
import { parseDeckList } from "../src/calibration/deckList.ts";
import { resolveDeck } from "../src/calibration/resolveDeck.ts";
import { baselineScript } from "../src/ranking/scenarioRuns.ts";

const { values } = parseArgs({
  options: {
    deck: { type: "string" },
    observed: { type: "string" },
    out: { type: "string" },
    runs: { type: "string", default: "10000" },
    seed: { type: "string", default: "20261021" },
    turns: { type: "string", default: "8" },
    t6: { type: "boolean", default: false },
  },
});
if (!values.deck || !values.observed)
  throw new Error(
    "Usage: calibrate.ts --deck deck.txt --observed observed.json",
  );

const CHECKED_TURNS = 6;
const runs = Number(values.runs);
const seed = Number(values.seed);
const turns = Number(values.turns);
const thresholds: Threshold[] = [
  "T1",
  "T2",
  "T3",
  "T4",
  ...(values.t6 ? (["T6a", "T6b"] as const) : []),
];

const client = createClient(
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_ANON_KEY ?? "",
);
const cards = await supabaseCardRepository(client).listCards();
const resolved = resolveDeck(
  parseDeckList(readFileSync(values.deck, "utf8")),
  cards,
);
if (resolved.missing.length)
  throw new Error(`Cards not found: ${resolved.missing.join(", ")}`);

const report = runBatch(
  {
    deck: resolved.deck,
    weapons: resolved.weapons,
    equipment: resolved.equipment,
    side: "forsaken",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  },
  baselineScript(turns),
  { runs, seed },
);
const simulated = simulatedDistributions(report, turns);

const observed = JSON.parse(readFileSync(values.observed, "utf8")) as {
  pooled: ObservedGroup;
  by_opponent: Record<string, ObservedGroup>;
};
const comparisons = ([0, 1] as const).map((shift) => {
  const options = { shift, turns: CHECKED_TURNS, thresholds };
  const pooled = compare(observed.pooled, simulated, options);
  const matchups = Object.fromEntries(
    Object.entries(observed.by_opponent)
      .filter(([, g]) => g.sides >= MIN_OBSERVED)
      .map(([opp, g]) => [opp, compare(g, simulated, options)]),
  );
  return { shift, pooled, matchups, robustness: robustness(pooled, matchups) };
});

const result = {
  inputs: {
    ...report.inputs,
    script: "baseline",
    turns,
    checkedTurns: CHECKED_TURNS,
    thresholds,
  },
  runs: {
    total: report.runs,
    completed: report.completed,
    failed: report.failed,
    failures: report.failures,
  },
  coverage: {
    ...resolved.coverage,
    incomplete:
      resolved.coverage.copies.modelled < 0.8 * resolved.coverage.copies.total,
  },
  gear: {
    weapons: resolved.weapons.map((c) => c.name),
    equipment: resolved.equipment.map((c) => c.name),
  },
  simulated,
  comparisons,
};
const text = JSON.stringify(result, null, 2) + "\n";
if (values.out) writeFileSync(values.out, text);
else process.stdout.write(text);

const c = resolved.coverage;
console.error(
  `Coverage: ${c.copies.modelled} of ${c.copies.total} copies, ${c.distinct.modelled} of ${c.distinct.total} distinct cards verified.`,
);
for (const { shift, pooled } of comparisons)
  console.error(
    `Shift ${shift}: ${pooled.filter((x) => x.verdict === "investigate").length} to investigate, ` +
      `${pooled.filter((x) => x.verdict === "within").length} within, ` +
      `${pooled.filter((x) => x.verdict === "not enough data").length} not enough data.`,
  );
