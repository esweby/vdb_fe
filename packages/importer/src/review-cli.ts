// Writes the review sheet for one batch to docs/reviews/<batch>.md.
// Usage: npm run review-sheet -w @vdb/importer -- <batch>
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { allAuthored, batches } from "./authored/index.ts";
import { loadDataset } from "./dataset.ts";
import { toImportCards } from "./map.ts";
import { reviewSheet } from "./review.ts";

const batch = process.argv[2];
if (!batch || !(batch in batches)) {
  throw new Error(`Usage: review-sheet <batch>. Batches: ${Object.keys(batches).join(", ")}`);
}

const names = new Set(Object.keys(batches[batch]!));
const cards = toImportCards(await loadDataset(), allAuthored()).filter((c) => names.has(c.name));
const dir = join(import.meta.dirname, "..", "..", "..", "docs", "reviews");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${batch}.md`), reviewSheet(batch, cards));
console.log(`Wrote docs/reviews/${batch}.md (${cards.length} cards)`);
