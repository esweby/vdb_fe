// Imports Viserai-legal cards from a pinned commit of the-fab-cube dataset.
// Usage: npm run import -w @vdb/importer [-- --yes-remote]
// DB_URL defaults to the local Supabase database. Put the hosted one in packages/importer/.env
// (git-ignored) as DB_URL="postgresql://…" to import there with --yes-remote.
import postgres from "postgres";
import { allAuthored } from "./authored/index.ts";
import { loadDataset, loadSets } from "./dataset.ts";
import { hideRetired, upsertCards, upsertHeroes } from "./db.ts";
import { retiredNames } from "./classify.ts";
import { toHeroes, toImportCards } from "./map.ts";
import { setReleases } from "./releases.ts";

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function main() {
  const dbUrl = process.env.DB_URL ?? LOCAL_DB;
  const host = new URL(dbUrl).hostname;
  if (
    !["127.0.0.1", "localhost"].includes(host) &&
    !process.argv.includes("--yes-remote")
  ) {
    throw new Error(
      `DB_URL points at ${host}. Pass --yes-remote to import into a non-local database.`,
    );
  }

  const dataset = await loadDataset();
  const cards = toImportCards(
    dataset,
    allAuthored(),
    setReleases(await loadSets()),
  );
  const byType = Object.groupBy(cards, (c) => c.type);
  console.log(
    `Importing ${cards.length} cards, ${cards.flatMap((c) => c.variants).length} variants`,
  );
  for (const [type, group] of Object.entries(byType))
    console.log(`  ${type}: ${group?.length}`);

  const sql = postgres(dbUrl, { onnotice: () => {} });
  try {
    await upsertCards(sql, cards);
    // Cards are keyed by name, so a retired card's external id is its name.
    const hidden = await hideRetired(sql, retiredNames(dataset));
    if (hidden > 0)
      console.log(`Hid ${hidden} retired cards (no longer playable).`);
    const heroes = toHeroes(dataset);
    await upsertHeroes(sql, heroes);
    console.log(`Heroes for matchups: ${heroes.length}.`);
  } finally {
    await sql.end();
  }
  console.log("Done.");
}

await main();
