// Card ids and card sets for the FaBlazing data pipeline (services/fablazing).
// FaBlazing (Talishar) ids are the card name as a slug plus the pitch colour,
// e.g. "Open the Gate to i'Arathael", pitch 1 → open_the_gate_to_iarathael_red.
import type { ImportCard } from "./map.ts";

const COLOURS: Record<number, string> = {
  1: "red",
  2: "yellow",
  3: "blue",
  4: "purple",
};

export function fablazingSlug(name: string, pitch: number | null): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const colour = pitch === null ? undefined : COLOURS[pitch];
  return colour ? `${base}_${colour}` : base;
}

/** Named groups of FaBlazing ids that chain specs refer to, from our card facts. */
export function cardSets(cards: ImportCard[]): Record<string, string[]> {
  const slugs = (keep: (c: ImportCard) => boolean) =>
    cards
      .filter(keep)
      .flatMap((c) => c.variants.map((v) => fablazingSlug(c.name, v.pitch)))
      .sort();
  return {
    blood_debt: slugs((c) => c.attributes.hasBloodDebt === true),
    gate_target: slugs((c) => c.attributes.isGateTarget === true),
  };
}
