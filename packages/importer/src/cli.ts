// Imports Viserai-legal cards from a pinned commit of the-fab-cube dataset.
// Usage: npm run import -w @vdb/importer [-- --yes-remote]
// DB_URL defaults to the local Supabase database.
import postgres from "postgres";
import { allAuthored } from "./authored/index.ts";
import { loadDataset } from "./dataset.ts";
import { upsertCards } from "./db.ts";
import { toImportCards } from "./map.ts";

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function main() {
  const dbUrl = process.env.DB_URL ?? LOCAL_DB;
  const host = new URL(dbUrl).hostname;
  if (!["127.0.0.1", "localhost"].includes(host) && !process.argv.includes("--yes-remote")) {
    throw new Error(`DB_URL points at ${host}. Pass --yes-remote to import into a non-local database.`);
  }

  const cards = toImportCards(await loadDataset(), allAuthored());
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
