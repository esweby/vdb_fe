// A scenario while it's being built: easier to edit than a definition (amounts as typed, a
// compare word instead of min and max). It becomes a definition, checked against the scenario
// contract, when it runs.
import {
  scenarioSchema,
  type Block,
  type ConditionGroup,
  type ScenarioDefinition,
} from "@vdb/engine";
import { blockLabel } from "./blocks.ts";

export type Measure = "cards" | "distinct" | "runechants" | "gates";
export type Compare = "atLeast" | "atMost" | "exactly";
export type Filter = Block["filter"];

export interface BlockDraft {
  kind: "block";
  measure: Measure;
  compare: Compare;
  /** As typed, so a half-typed number doesn't jump about. */
  amount: string;
  filter: Filter;
}
export interface GroupDraft {
  kind: "group";
  match: "all" | "any";
  items: (GroupDraft | BlockDraft)[];
}
export interface Draft {
  name: string;
  horizon: number;
  turnModel: ScenarioDefinition["turnModel"];
  access: ScenarioDefinition["access"];
  fixed: NonNullable<ScenarioDefinition["fixed"]>;
  condition: GroupDraft;
}

export const newBlock = (): BlockDraft => ({
  kind: "block",
  measure: "cards",
  compare: "atLeast",
  amount: "1",
  filter: {},
});
export const newGroup = (): GroupDraft => ({
  kind: "group",
  match: "all",
  items: [newBlock()],
});
export const newDraft = (): Draft => ({
  name: "My scenario",
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  fixed: [],
  condition: { ...newGroup() },
});

/** A path of item indexes from the top group. */
export type Path = number[];

/** The item at a path replaced by what `change` returns. */
export function updateAt(
  group: GroupDraft,
  path: Path,
  change: (item: GroupDraft | BlockDraft) => GroupDraft | BlockDraft | null,
): GroupDraft {
  if (path.length === 0) return change(group) as GroupDraft;
  const [i, ...rest] = path;
  const items = group.items.flatMap((item, j) => {
    if (j !== i) return [item];
    if (rest.length === 0) {
      const next = change(item);
      return next ? [next] : [];
    }
    return [updateAt(item as GroupDraft, rest, change)];
  });
  return { ...group, items };
}

/** "Block 3", "Group 2": numbered in reading order, the top group being group 1. */
export function numbering(group: GroupDraft) {
  const blocks = new Map<string, number>();
  const groups = new Map<string, number>();
  let b = 0;
  let g = 0;
  const walk = (x: GroupDraft, path: Path) => {
    groups.set(path.join("."), ++g);
    x.items.forEach((item, i) => {
      const p = [...path, i];
      if (item.kind === "block") blocks.set(p.join("."), ++b);
      else walk(item, p);
    });
  };
  walk(group, []);
  return { blocks, groups };
}

function toBlock(d: BlockDraft): Omit<Block, "label"> {
  const n = Number(d.amount);
  const range =
    d.compare === "atLeast"
      ? { min: n }
      : d.compare === "atMost"
        ? { min: 0, max: n }
        : { min: n, max: n };
  return {
    filter: Object.fromEntries(
      Object.entries(d.filter).filter(([, v]) => v !== undefined && v !== ""),
    ),
    ...range,
    ...(d.measure === "distinct" ? { distinct: true } : {}),
    ...(d.measure === "runechants" || d.measure === "gates"
      ? { total: d.measure }
      : {}),
  };
}

function toGroup(g: GroupDraft): ConditionGroup {
  const items = g.items.map((item) => {
    if (item.kind === "group") return toGroup(item);
    const block = toBlock(item);
    return { label: blockLabel(block), ...block };
  });
  return g.match === "all" ? { all: items } : { any: items };
}

const hasEmptyGroup = (g: GroupDraft): boolean =>
  g.items.length === 0 ||
  g.items.some((i) => i.kind === "group" && hasEmptyGroup(i));
const blocksOf = (g: GroupDraft): BlockDraft[] =>
  g.items.flatMap((i) => (i.kind === "block" ? [i] : blocksOf(i)));

/** The definition to run, or why it can't run yet. */
export function toDefinition(
  draft: Draft,
): { definition: ScenarioDefinition } | { problem: string } {
  if (hasEmptyGroup(draft.condition))
    return { problem: "Add a block to check." };
  if (blocksOf(draft.condition).some((b) => !/^\d+$/.test(b.amount.trim())))
    return { problem: "Amounts are whole numbers, 0 or more." };
  const parsed = scenarioSchema.safeParse({
    version: 1,
    name: draft.name.trim() || "Untitled scenario",
    horizon: draft.horizon,
    turnModel: draft.turnModel,
    access: draft.access,
    ...(draft.fixed.length ? { fixed: draft.fixed } : {}),
    condition: toGroup(draft.condition),
  });
  if (parsed.success) return { definition: parsed.data };
  const issue = parsed.error.issues[0]!;
  return {
    problem:
      issue.path[0] === "access"
        ? "Choose at least one zone for conditions to see."
        : issue.message,
  };
}

function fromGroup(g: ConditionGroup): GroupDraft {
  const items = "all" in g ? g.all : g.any;
  return {
    kind: "group",
    match: "all" in g ? "all" : "any",
    items: items.map((item) =>
      "label" in item ? fromBlock(item) : fromGroup(item),
    ),
  };
}

function fromBlock(b: Block): BlockDraft {
  const measure: Measure =
    b.total === "runechants" || b.total === "gates"
      ? b.total
      : b.distinct
        ? "distinct"
        : "cards";
  const [compare, amount]: [Compare, number] =
    b.max === undefined
      ? ["atLeast", b.min]
      : b.min === b.max
        ? ["exactly", b.max]
        : ["atMost", b.max];
  return {
    kind: "block",
    measure,
    compare,
    amount: String(amount),
    filter: { ...b.filter },
  };
}

/** A definition (a built-in, say) to edit. */
export function fromDefinition(def: ScenarioDefinition): Draft {
  return {
    name: def.name,
    horizon: def.horizon,
    turnModel: def.turnModel,
    access: [...def.access],
    fixed: [...(def.fixed ?? [])],
    condition: fromGroup(def.condition),
  };
}
