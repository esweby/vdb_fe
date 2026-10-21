// Writes the card sets that FaBlazing chain specs use, from our card facts.
// Usage: npm run fablazing-sets -w @vdb/importer
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { allAuthored } from "./authored/index.ts";
import { loadDataset, loadSets } from "./dataset.ts";
import { cardSets } from "./fablazing.ts";
import { toImportCards } from "./map.ts";
import { setReleases } from "./releases.ts";

const out = join(
  import.meta.dirname,
  "../../../services/fablazing/chains/sets.json",
);

const cards = toImportCards(
  await loadDataset(),
  allAuthored(),
  setReleases(await loadSets()),
);
const sets = cardSets(cards);
await writeFile(out, JSON.stringify(sets, null, 2) + "\n");
for (const [name, ids] of Object.entries(sets))
  console.log(`${name}: ${ids.length}`);
console.log(`Wrote ${out}`);
