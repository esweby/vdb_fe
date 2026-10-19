// Condition blocks in plain words. Failures are grouped by block (README "Why runs failed"), so
// a block's label is what the user reads there.
import { ROLES } from "@vdb/cards";
import type { Block } from "@vdb/engine";
import { TYPE_LABELS } from "../cards/filterCards.ts";
import { PITCH_NAMES } from "../decks/deckRules.ts";

/** What a block can total instead of counting cards (amounts on each engine card). */
export const TOTALS: Record<string, [string, string]> = {
  runechants: ["Runechant", "Runechants"],
  gates: ["Gate", "Gates"],
};

/** Traits a block can filter on: talents, classes and facts. */
export const TRAITS: Record<string, string> = {
  shadow: "Shadow",
  runeblade: "Runeblade",
  generic: "Generic",
  blood_debt: "Blood debt",
};

const roleName = (id: string) => ROLES.find((r) => r.id === id)?.name ?? id;

/** "at least 2 different Shadow attack action cards", "exactly 1 Become the Shadow Lord". */
export function blockLabel(block: Omit<Block, "label">): string {
  const { filter: f, min, max } = block;
  const n = max === undefined ? min : max;
  const compare =
    max === undefined
      ? `at least ${min}`
      : max === 0
        ? "no"
        : min === max
          ? `exactly ${max}`
          : min === 0
            ? `at most ${max}`
            : `${min} to ${max}`;
  const plural = max === 0 || n !== 1;
  const words = [
    f.pitch !== undefined ? (PITCH_NAMES[f.pitch] ?? `pitch ${f.pitch}`) : "",
    f.trait ? (TRAITS[f.trait] ?? f.trait) : "",
    f.role ? roleName(f.role) : "",
    f.type ? (TYPE_LABELS[f.type] ?? f.type).toLowerCase() : "",
  ].filter(Boolean);
  const cards = f.name
    ? f.name
    : [...words, plural ? "cards" : "card"].join(" ");
  if (block.total) {
    const [one, many] = TOTALS[block.total] ?? [block.total, block.total];
    const what = `${compare === "no" ? "no" : compare} ${plural ? many : one} made`;
    const anyCard = !f.name && words.length === 0;
    return anyCard
      ? what
      : `${what} by ${f.name ?? [...words, "cards"].join(" ")}`;
  }
  const distinct = block.distinct ? "different " : "";
  return `${compare} ${distinct}${cards}`;
}
