// A scenario in one sentence (the maintainer, 19 Oct 2026: the form was hard to read back). Built
// from the definition the run will use, so what it says is what runs.
import type {
  Block,
  ConditionGroup,
  ScenarioDefinition,
  Step,
} from "@vdb/engine";
import { filterWords } from "./blocks.ts";

const ZONE_WORDS: Record<ScenarioDefinition["access"][number], string> = {
  hand: "hand",
  arsenal: "arsenal",
  topOfDeck: "the top card of your deck",
  banished: "banished zone",
};

/** "a, b and c" */
function list(items: string[]) {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const card = (f: Block["filter"]) =>
  `the lowest-pitch ${f.name ?? [...filterWords(f), "card"].join(" ")}`;

function stepWords(step: Step): string {
  const when = step.turn === "each" ? "each turn" : `on turn ${step.turn}`;
  switch (step.do) {
    case "draw":
      return `${when} drawing ${step.count}`;
    case "pitch":
      return `${when} pitching ${card(step.filter)}`;
    case "arsenal":
      return `${when} putting ${card(step.filter)} in arsenal`;
    case "banish":
      return `${when} banishing ${card(step.filter)} from hand`;
    case "block":
      return `${when} blocking with ${step.count} ${step.count === 1 ? "card" : "cards"}`;
  }
}

function conditionWords(g: ConditionGroup, nested: boolean): string {
  const items = ("all" in g ? g.all : g.any).map((item) =>
    "label" in item ? item.label : conditionWords(item, true),
  );
  const words =
    "all" in g
      ? list(items)
      : items.length < 2
        ? (items[0] ?? "")
        : `either ${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
  return nested && items.length > 1 ? `(${words})` : words;
}

export function describeScenario(def: ScenarioDefinition): string {
  const head =
    def.horizon === 0
      ? "In your opening hand"
      : `By turn ${def.horizon} (${def.turnModel === "fresh" ? "a fresh hand each turn" : "keeping the hand and drawing up to 4"})`;
  const clauses: string[] = [];
  if (!(
    def.horizon === 0 &&
    def.access.length === 1 &&
    def.access[0] === "hand"
  )) {
    const zones = def.access.map((z) => ZONE_WORDS[z]);
    const first = def.access[0] === "topOfDeck" ? "" : "your ";
    clauses.push(`looking at ${first}${list(zones)}`);
  }
  if (def.fixed?.length)
    clauses.push(
      `starting with ${list(def.fixed.map((f) => `${f.name} in ${f.zone}`))}`,
    );
  if (def.horizon > 0 && def.steps?.length)
    clauses.push(def.steps.map(stepWords).join(", then "));
  const lead =
    clauses.length === 0
      ? head
      : clauses.length === 1
        ? `${head}, ${clauses[0]}`
        : `${head}, ${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
  return `${lead}: ${conditionWords(def.condition, false)}.`;
}
