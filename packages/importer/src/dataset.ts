// Loads the pinned dataset, downloading it into .cache on first use.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatasetCard } from "./classify.ts";

// usurp-the-shadow-throne branch (pre-release). Re-pin once it merges to main.
export const DATASET_COMMIT = "01fc9344a612a41e5dc451ccc1422050a25a2667";
const DATASET_URL = `https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/${DATASET_COMMIT}/json/english/card.json`;
const CACHE_DIR = join(import.meta.dirname, "..", ".cache");

export async function loadDataset(): Promise<DatasetCard[]> {
  const path = join(CACHE_DIR, `card-${DATASET_COMMIT}.json`);
  if (!existsSync(path)) {
    console.log(`Downloading dataset at ${DATASET_COMMIT.slice(0, 7)}…`);
    const response = await fetch(DATASET_URL);
    if (!response.ok)
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      );
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path, await response.text());
  }
  return JSON.parse(await readFile(path, "utf8")) as DatasetCard[];
}
