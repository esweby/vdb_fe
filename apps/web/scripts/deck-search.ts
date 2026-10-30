// The deck-search spike (docs/deck-search-spike.md): hill climbs over decks of verified cards,
// scored by goldfish turns that hold blockers back. UNVERIFIED score, blocking model and pilot.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… node apps/web/scripts/deck-search.ts \
//     --start a.txt --start b.txt [--random 2] [--steps 60] [--runs 200] [--turns 4] \
//     [--hold 2] [--margin 0.15] [--confirm 1000] [--seed 20261030] [--out result.json]
//
// Weapons and equipment come from the first --start list and aren't searched. Unverified cards
// in a start list are swapped for random verified ones before the climb.
import { readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { Worker } from "node:worker_threads";
import { createClient } from "@supabase/supabase-js";
import type { RulesCard } from "@esweby/fab-engine/rules";
import { supabaseCardRepository } from "../src/cards/cardRepository.ts";
import { parseDeckList } from "../src/calibration/deckList.ts";
import {
  climb,
  deckCards,
  fill,
  poolOf,
  summarise,
  type DeckCounts,
  type HeldTurn,
} from "../src/calibration/deckSearch.ts";
import { resolveDeck } from "../src/calibration/resolveDeck.ts";

const { values } = parseArgs({
  options: {
    start: { type: "string", multiple: true, default: [] },
    random: { type: "string", default: "0" },
    size: { type: "string", default: "52" },
    steps: { type: "string", default: "60" },
    runs: { type: "string", default: "200" },
    turns: { type: "string", default: "4" },
    hold: { type: "string", default: "2" },
    confirm: { type: "string", default: "1000" },
    margin: { type: "string", default: "0.15" },
    seed: { type: "string", default: "20261030" },
    out: { type: "string" },
  },
});
if (!values.start.length)
  throw new Error("Usage: deck-search.ts --start deck.txt [--start …]");
const n = (k: keyof typeof values) => Number(values[k]);
const [runs, turns, hold, steps, confirmRuns, seed] = [
  n("runs"),
  n("turns"),
  n("hold"),
  n("steps"),
  n("confirm"),
  n("seed"),
];

const client = createClient(
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_ANON_KEY ?? "",
);
const cards = await supabaseCardRepository(client).listCards();
const pool = poolOf(cards);
const byKey = new Map(pool.map((e) => [e.key, e]));

/** A start list as pool keys; unverified cards come back as a count, to be filled at random. */
function countsOf(text: string) {
  const deck: DeckCounts = new Map();
  let unverified = 0;
  for (const e of parseDeckList(text)) {
    const card = cards.find(
      (c) => c.name.toLowerCase() === e.name.toLowerCase(),
    );
    if (card?.type === "weapon" || card?.type === "equipment") continue;
    const variant = card?.variants.find((v) => v.pitch === e.pitch);
    if (!variant || !byKey.has(variant.id)) unverified += e.copies;
    else deck.set(variant.id, (deck.get(variant.id) ?? 0) + e.copies);
  }
  return { deck, unverified };
}

const firstList = readFileSync(values.start[0]!, "utf8");
const gear = resolveDeck(parseDeckList(firstList), cards);
const starts: { name: string; deck: DeckCounts; filled: number }[] = [];
for (const [i, path] of values.start.entries()) {
  const { deck, unverified } = countsOf(readFileSync(path, "utf8"));
  starts.push({
    name: path.split("/").pop()!,
    deck: fill(deck, pool, seed + 100 + i, unverified),
    filled: unverified,
  });
}
for (let i = 0; i < n("random"); i++)
  starts.push({
    name: `random ${i + 1}`,
    deck: fill(new Map(), pool, seed + 200 + i, n("size")),
    filled: n("size"),
  });

const threads = Math.max(1, availableParallelism() - 1);
const workers = Array.from(
  { length: threads },
  () =>
    new Worker(new URL("./deck-search-worker.ts", import.meta.url), {
      workerData: { weapons: gear.weapons, equipment: gear.equipment },
    }),
);
let jobId = 0;
function playOn(
  worker: Worker,
  deck: RulesCard[],
  seeds: number[],
  holdBack: number,
) {
  const id = jobId++;
  return new Promise<HeldTurn[][]>((resolve, reject) => {
    const done = (m: { id: number; games: HeldTurn[][] }) => {
      if (m.id !== id) return;
      worker.off("message", done);
      resolve(m.games);
    };
    worker.on("message", done);
    worker.once("error", reject);
    worker.postMessage({ id, deck, seeds, turns, holdBack });
  });
}
async function play(
  deck: DeckCounts,
  from: number,
  count: number,
  holdBack: number,
) {
  const cardsOf = deckCards(deck, pool);
  const seeds = Array.from({ length: count }, (_, i) => from + i);
  const shares = workers.map((_, w) =>
    seeds.filter((_, i) => i % threads === w),
  );
  const parts = await Promise.all(
    workers.map((w, i) => playOn(w, cardsOf, shares[i]!, holdBack)),
  );
  return parts.flat();
}

const listOf = (deck: DeckCounts) =>
  [...deck]
    .map(([k, c]) => ({ label: byKey.get(k)!.label, copies: c }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((e) => `${e.copies} ${e.label}`);

// The climb plays the same seeds for every deck, so a change in score comes from the cards.
const t0 = performance.now();
const climbs = [];
for (const [i, s] of starts.entries()) {
  const result = await climb(
    s.deck,
    pool,
    async (deck) => summarise(await play(deck, 1, runs, hold)).score,
    {
      steps,
      seed: seed + i,
      margin: n("margin"),
      onStep: (step, score, accepted) => {
        if (accepted || step % 10 === 0)
          console.error(
            `${s.name} step ${step}/${steps}: ${score.toFixed(2)}${accepted ? " (kept)" : ""} [${((performance.now() - t0) / 1000).toFixed(0)}s]`,
          );
      },
    },
  );
  climbs.push({ start: s, ...result });
}

// Confirm on fresh seeds, at every hold-back level, the start and where it climbed to.
const FRESH = 1_000_000;
const confirmed = [];
for (const c of climbs) {
  const row: Record<string, unknown> = {
    start: c.start.name,
    filled: c.start.filled,
  };
  for (const [which, deck] of [
    ["start", c.start.deck],
    ["best", c.best],
  ] as const) {
    const byHold: Record<number, ReturnType<typeof summarise>> = {};
    for (const h of [0, 1, 2])
      byHold[h] = summarise(await play(deck, FRESH, confirmRuns, h));
    row[which] = { byHold, list: listOf(deck) };
  }
  row.accepted = c.history.length - 1;
  row.searchScore = c.score;
  confirmed.push(row);
}
await Promise.all(workers.map((w) => w.terminate()));

const result = {
  inputs: {
    starts: values.start,
    random: n("random"),
    runs,
    turns,
    hold,
    steps,
    margin: n("margin"),
    confirmRuns,
    seed,
    pool: pool.length,
    weapons: gear.weapons.map((c) => c.name),
    equipment: gear.equipment.map((c) => c.name),
    seconds: Math.round((performance.now() - t0) / 1000),
  },
  confirmed,
  climbs: climbs.map((c) => ({
    start: c.start.name,
    history: c.history.map((h) => ({ step: h.step, score: h.score })),
  })),
};
const text = JSON.stringify(result, null, 2) + "\n";
if (values.out) writeFileSync(values.out, text);
else process.stdout.write(text);
