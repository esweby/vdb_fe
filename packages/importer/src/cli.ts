// Imports Viserai-legal cards from a pinned commit of the-fab-cube dataset.
// Usage: npm run import -w @vdb/importer [-- --yes-remote]
// DB_URL defaults to the local Supabase database.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { authored } from "./authored.ts";
import type { DatasetCard } from "./classify.ts";
import { upsertCards } from "./db.ts";
import { toImportCards } from "./map.ts";

// usurp-the-shadow-throne branch (pre-release). Re-pin once it merges to main.
const DATASET_COMMIT = "01fc9344a612a41e5dc451ccc1422050a25a2667";
const DATASET_URL = `https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/${DATASET_COMMIT}/json/english/card.json`;
const CACHE_DIR = join(import.meta.dirname, "..", ".cache");
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function loadDataset(): Promise<DatasetCard[]> {
  const path = join(CACHE_DIR, `card-${DATASET_COMMIT}.json`);
  if (!existsSync(path)) {
    console.log(`Downloading dataset at ${DATASET_COMMIT.slice(0, 7)}…`);
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path, await response.text());
  }
  return JSON.parse(await readFile(path, "utf8")) as DatasetCard[];
}

async function main() {
  const dbUrl = process.env.DB_URL ?? LOCAL_DB;
  const host = new URL(dbUrl).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) && !process.argv.includes("--yes-remote")) {
    throw new Error(`DB_URL points at ${host}. Pass --yes-remote to import into a non-local database.`);
  }

  const cards = toImportCards(await loadDataset(), authored);
  const byType = Object.groupBy(cards, (c) => c.type);
  console.log(`Importing ${cards.length} cards, ${cards.flatMap((c) => c.variants).length} variants`);
  for (const [type, group] of Object.entries(byType)) console.log(`  ${type}: ${group?.length}`);

  const sql = postgres(dbUrl, { onnotice: () => {} });
  try {
    await upsertCards(sql, cards);
  } finally {
    await sql.end();
  }
  console.log("Done.");
}

await main();
