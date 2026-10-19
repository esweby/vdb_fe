// What a saved result was worked out from, and what's changed since (README "Reproducibility").
import type { DeckEntry } from "../decks/deckRules.ts";
import type { ResultInputs } from "./scenarioRepository.ts";

/** The deck as a run saw it: each variant and its copies, sideboard left out. */
export function deckSnapshot(entries: DeckEntry[]): string[] {
  return entries
    .filter((e) => !e.sideboard)
    .map((e) => `${e.variant.id}×${e.quantity}`)
    .sort();
}

/** JSON with object keys sorted: Postgres jsonb doesn't keep the order they were saved in. */
function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(",")}]`;
  if (x && typeof x === "object")
    return `{${Object.keys(x)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stable((x as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(x);
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** The inputs that differ between a recorded result and a run now, in plain words. */
export function differences(was: ResultInputs, now: ResultInputs): string[] {
  return [
    !same(was.deckSnapshot, now.deckSnapshot) && "the deck",
    (!same(was.definition, now.definition) ||
      was.definitionVersion !== now.definitionVersion) &&
      "the scenario",
    was.runs !== now.runs && "the number of runs",
    was.engineVersion !== now.engineVersion && "the engine",
  ].filter((x): x is string => typeof x === "string");
}
