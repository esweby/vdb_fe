// Writes a review sheet to docs/reviews/<name>.md.
// Usage: npm run review-sheet -w @vdb/importer -- <batch>
//        npm run review-sheet -w @vdb/importer -- unverified   (every unverified card, all batches)
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { allAuthored, batches } from "./authored/index.ts";
import { loadDataset } from "./dataset.ts";
import { toImportCards } from "./map.ts";
import { reviewSheet } from "./review.ts";

const name = process.argv[2];
if (!name || !(name in batches || name === "unverified")) {
  throw new Error(
    `Usage: review-sheet <batch | unverified>. Batches: ${Object.keys(batches).join(", ")}`,
  );
}

const authored = allAuthored();
const names = new Set(
  name === "unverified"
    ? Object.entries(authored)
        .filter(([, entry]) => !entry.verified)
        .map(([card]) => card)
    : Object.keys(batches[name]!),
);
const cards = toImportCards(await loadDataset(), authored).filter((c) =>
  names.has(c.name),
);
const dir = join(import.meta.dirname, "..", "..", "..", "docs", "reviews");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${name}.md`), reviewSheet(name, cards));
console.log(`Wrote docs/reviews/${name}.md (${cards.length} cards)`);
