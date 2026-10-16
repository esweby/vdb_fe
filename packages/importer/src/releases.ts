// When cards first came out, from the dataset's sets: used to review the newest cards first.

export interface DatasetSet {
  id: string;
  name: string;
  printings?: { edition?: string; initial_release_date?: string | null }[];
}

export interface Release {
  /** The set the card first appeared in, e.g. "Usurp the Shadow Throne". */
  name: string;
  /** Its release date, YYYY-MM-DD. */
  released: string;
}

/** Each dated set's first release (its earliest edition); sets without a date are left out. */
export function setReleases(sets: DatasetSet[]): Map<string, Release> {
  const releases = new Map<string, Release>();
  for (const set of sets) {
    const dates = (set.printings ?? [])
      .map((p) => p.initial_release_date?.slice(0, 10))
      .filter((d): d is string => !!d)
      .sort();
    if (dates[0]) releases.set(set.id, { name: set.name, released: dates[0] });
  }
  return releases;
}

/** A card's first release: the earliest dated set it was printed in, or null. */
export function firstRelease(
  setIds: string[],
  releases: Map<string, Release>,
): Release | null {
  return (
    setIds
      .map((id) => releases.get(id))
      .filter((r): r is Release => !!r)
      .sort((a, b) => a.released.localeCompare(b.released))[0] ?? null
  );
}
