// Loads the pinned dataset, downloading it into .cache on first use.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatasetCard } from "./classify.ts";
import type { DatasetSet } from "./releases.ts";

// usurp-the-shadow-throne branch (pre-release). Re-pin once it merges to main.
export const DATASET_COMMIT = "01fc9344a612a41e5dc451ccc1422050a25a2667";
const DATASET_BASE = `https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/${DATASET_COMMIT}/json/english`;
const CACHE_DIR = join(import.meta.dirname, "..", ".cache");

/** A JSON file from the pinned commit, cached in .cache after the first download. */
async function loadJson<T>(file: string): Promise<T> {
  const path = join(CACHE_DIR, `${file}-${DATASET_COMMIT}.json`);
  if (!existsSync(path)) {
    console.log(`Downloading ${file}.json at ${DATASET_COMMIT.slice(0, 7)}…`);
    const response = await fetch(`${DATASET_BASE}/${file}.json`);
    if (!response.ok)
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      );
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path, await response.text());
  }
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export const loadDataset = () => loadJson<DatasetCard[]>("card");

/** The dataset's sets, with release dates: when each card first came out. */
export const loadSets = () => loadJson<DatasetSet[]>("set");
