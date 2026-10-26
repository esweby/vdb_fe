import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { BLOOD_DEBT, RUNECHANT, VISERAI } from "@vdb/engine/rules";
import { supabaseCardRepository } from "../src/cards/cardRepository.ts";
import { parseDeckList } from "../src/calibration/deckList.ts";
import { resolveDeck } from "../src/calibration/resolveDeck.ts";
import {
  comparePlayPatterns,
  priorityPatterns,
} from "../src/calibration/playPatternComparison.ts";

const { values } = parseArgs({
  options: {
    deck: { type: "string" },
    config: { type: "string" },
    out: { type: "string" },
  },
});
if (!values.deck || !values.config || !values.out)
  throw new Error(
    "Usage: compare-play-patterns.ts --deck deck.txt --config patterns.json --out report.json",
  );
if (existsSync(values.out))
  throw new Error("Output already exists; refusing to overwrite it.");
const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error(
    "This comparison CLI reads only a local loopback Supabase, never a hosted project.",
  );
const config: unknown = JSON.parse(readFileSync(values.config, "utf8"));
if (!config || typeof config !== "object" || Array.isArray(config))
  throw new Error("Configuration must be an object.");
const request = {
  ...config,
  patterns: "patterns" in config ? config.patterns : priorityPatterns(),
};
const client = createClient(url, process.env.SUPABASE_ANON_KEY ?? "");
const cards = await supabaseCardRepository(client).listCards();
const resolved = resolveDeck(
  parseDeckList(readFileSync(values.deck, "utf8")),
  cards,
);
if (resolved.missing.length)
  throw new Error(`Cards not found: ${resolved.missing.join(", ")}`);
if (resolved.coverage.copies.modelled !== resolved.coverage.copies.total)
  throw new Error(
    "All deck cards must have verified rules for this comparison.",
  );
if (!resolved.deck.length) throw new Error("The deck is empty.");
const report = comparePlayPatterns(
  {
    deck: resolved.deck,
    weapons: resolved.weapons,
    equipment: resolved.equipment,
    side: "forsaken",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  },
  request,
);
writeFileSync(
  values.out,
  JSON.stringify(
    { ...report, coverage: { ...report.coverage, cards: resolved.coverage } },
    null,
    2,
  ) + "\n",
  { flag: "wx", mode: 0o600 },
);
const results = report.cases.flatMap((row) => row.patterns);
console.log(
  `${report.cases.length} seeds, ${report.coverage.patterns} patterns: ${results.filter((result) => result.status === "completed").length} completed, ${results.filter((result) => result.status === "failed").length} failed, ${results.filter((result) => result.status === "incomplete").length} incomplete. Assumed results; not exhaustive.`,
);
