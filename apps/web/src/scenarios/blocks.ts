// Condition blocks in plain words. Failures are grouped by block (README "Why runs failed"), so
// a block's label is what the user reads there.
import { ROLES } from "@vdb/cards";
import type { Block, ConditionGroup, Step } from "@esweby/fab-engine";
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

/** A filter's describing words: "blue Shadow attack action". */
export function filterWords(f: Block["filter"]): string[] {
  return [
    f.pitch !== undefined ? (PITCH_NAMES[f.pitch] ?? `pitch ${f.pitch}`) : "",
    f.trait ? (TRAITS[f.trait] ?? f.trait) : "",
    f.role ? roleName(f.role) : "",
    f.type ? (TYPE_LABELS[f.type] ?? f.type).toLowerCase() : "",
  ].filter(Boolean);
}

/** "Each turn, put the lowest-pitch Blood debt card in arsenal", "Turn 2, draw 2". */
export function stepLabel(step: Step): string {
  const when = step.turn === "each" ? "Each turn" : `Turn ${step.turn}`;
  const card = (f: Block["filter"]) =>
    f.name
      ? `the lowest-pitch ${f.name}`
      : `the lowest-pitch ${[...filterWords(f), "card"].join(" ")}`;
  switch (step.do) {
    case "draw":
      return `${when}, draw ${step.count}`;
    case "block":
      return `${when}, block with ${step.count} ${step.count === 1 ? "card" : "cards"}`;
    case "pitch":
      return `${when}, pitch ${card(step.filter)}`;
    case "arsenal":
      return `${when}, put ${card(step.filter)} in arsenal`;
    case "banish":
      return `${when}, banish ${card(step.filter)} from hand`;
  }
}

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
  const words = filterWords(f);
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

/** The block labels of a condition, in reading order. */
export function labelsOf(group: ConditionGroup): string[] {
  const out: string[] = [];
  const walk = (g: ConditionGroup) => {
    for (const item of "all" in g ? g.all : g.any) {
      if ("label" in item) {
        if (!out.includes(item.label)) out.push(item.label);
      } else walk(item);
    }
  };
  walk(group);
  return out;
}
