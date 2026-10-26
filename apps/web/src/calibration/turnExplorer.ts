// UNVERIFIED exploration scope and ordering; legal transitions use the existing rules engine.
import { z } from "zod";
import { ENGINE_VERSION } from "@vdb/engine";
import {
  applySessionAction,
  checkInvariants,
  NeedsChoice,
  RulesBudgetExceeded,
  RulesError,
  rulesDataVersion,
  type ChoiceRequest,
  type RulesInstance,
  type RulesState,
  type Selector,
  type SessionAction,
} from "@vdb/engine/rules";
import {
  summarisePatternTurns,
  visiblePatternState,
  type PatternTurn,
} from "./playPatternComparison.ts";
import { TRAVERSE_TRIGGER } from "./traverseBackPolicy.ts";

const selector = z.strictObject({
  name: z.string().min(1).optional(),
  pitch: z.number().int().min(0).max(3).optional(),
  type: z.string().min(1).optional(),
  trait: z.string().min(1).optional(),
});
const schema = z.strictObject({
  startingLife: z.number().int().positive(),
  conditions: z.strictObject({
    hero_lost_life_this_turn: z.boolean(),
    less_life_than_opposing_hero: z.boolean(),
  }),
  traverseBack: z.union([z.boolean(), z.literal("both")]),
  includeArsenal: z.boolean().default(true),
  includeAbilities: z.boolean().default(false),
  keep: z.array(selector).max(20).default([]),
  neverBanish: z.array(selector).max(20).default([]),
  limits: z
    .strictObject({
      maxDepth: z.number().int().min(1).max(16).default(6),
      maxStates: z.number().int().min(1).max(2000).default(500),
      maxAttempts: z.number().int().min(1).max(50000).default(5000),
      maxChoiceBranches: z.number().int().min(1).max(256).default(32),
      maxChoiceDepth: z.number().int().min(1).max(64).default(32),
    })
    .prefault({}),
});
type Options = z.infer<typeof schema>;
type Move = Extract<
  SessionAction,
  {
    type:
      | "play"
      | "pitch"
      | "activateGate"
      | "activate"
      | "weaponAttack"
      | "endTurn";
  }
>;
type Node = { state: RulesState; actions: Move[] };
type Reason =
  | "depth-limit"
  | "state-limit"
  | "attempt-limit"
  | "choice-limit"
  | "choice-depth-limit";
type Frontier = { actions: Move[]; reason: Reason; pendingAction?: Move };
const view = (state: RulesState, startingLife: number) => ({
  ...visiblePatternState(state, startingLife),
  arena: state.zones.arena.map((instance) => ({
    uid: instance.uid,
    name: instance.card.name,
    pitch: instance.card.pitch,
    counters: state.counters[instance.uid] ?? 0,
  })),
  weapons: state.zones.weapons.map((instance) => ({
    uid: instance.uid,
    name: instance.card.name,
    used: state.usedThisTurn.includes(instance.uid),
  })),
  equipment: state.zones.equipment.map((instance) => ({
    uid: instance.uid,
    name: instance.card.name,
  })),
});
type Line = {
  actions: Move[];
  turn: PatternTurn;
  final: ReturnType<typeof view>;
};
const matches = (instance: RulesInstance, wanted: Selector) =>
  (wanted.name === undefined || instance.card.name === wanted.name) &&
  (wanted.pitch === undefined || instance.card.pitch === wanted.pitch) &&
  (wanted.type === undefined || instance.card.type === wanted.type) &&
  (wanted.trait === undefined || instance.card.traits.includes(wanted.trait));
const sorted = (cards: RulesInstance[]) =>
  [...cards].sort((left, right) => left.uid.localeCompare(right.uid));

function moves(state: RulesState, options: Options): Move[] {
  const hand = sorted(state.zones.hand);
  const kept = (instance: RulesInstance) =>
    options.keep.some((wanted) => matches(instance, wanted));
  const result: Move[] = [{ type: "endTurn" }];
  if (options.includeArsenal && !state.zones.arsenal.length)
    result.push(
      ...hand.map((instance) => ({
        type: "endTurn" as const,
        arsenal: instance.uid,
      })),
    );
  result.push(
    ...hand
      .filter((instance) => instance.card.pitch !== null && !kept(instance))
      .map((instance) => ({ type: "pitch" as const, uid: instance.uid })),
  );
  for (const zone of ["hand", "arsenal", "banished"] as const) {
    for (const instance of sorted(state.zones[zone])) {
      if (
        instance.card.effects === undefined ||
        (zone === "hand" && kept(instance)) ||
        (zone === "banished" && state.faceDown.includes(instance.uid))
      )
        continue;
      result.push({ type: "play", uid: instance.uid });
    }
  }
  if ((state.tokens.gate ?? 0) > 0) {
    for (const instance of sorted(state.zones.banished)) {
      if (
        !state.faceDown.includes(instance.uid) &&
        instance.card.effects !== undefined &&
        instance.card.traits.includes("blood_debt") &&
        ["action", "attack_action"].includes(instance.card.type ?? "")
      )
        result.push({ type: "activateGate", target: instance.uid });
    }
  }
  for (const instance of sorted(state.zones.weapons)) {
    if (instance.card.weaponAttack)
      result.push({ type: "weaponAttack", uid: instance.uid });
  }
  if (options.includeAbilities) {
    for (const instance of sorted(
      [
        "hand",
        "arsenal",
        "arena",
        "banished",
        "weapons",
        "equipment",
        "graveyard",
      ]
        .flatMap((zone) => state.zones[zone as keyof typeof state.zones])
        .filter((instance) => instance.card.activate !== undefined),
    )) {
      if (
        !state.faceDown.includes(instance.uid) &&
        !(
          state.zones.hand.some((card) => card.uid === instance.uid) &&
          kept(instance)
        )
      )
        result.push({ type: "activate", uid: instance.uid });
    }
  }
  return result;
}

function* selections(
  options: string[],
  count: number,
  prefix: string[] = [],
): Generator<string[]> {
  if (!count) {
    yield prefix;
    return;
  }
  for (const option of options)
    yield* selections(
      options.filter((value) => value !== option),
      count - 1,
      [...prefix, option],
    );
}

function* answers(
  request: ChoiceRequest,
  options: Options,
  cards: Map<string, RulesInstance>,
): Generator<string[]> {
  if (request.kind === "condition") {
    if (!request.condition)
      throw new Error("A condition request must name its condition.");
    yield [options.conditions[request.condition] ? "yes" : "no"];
    return;
  }
  if (
    request.kind === "confirm" &&
    request.source === TRAVERSE_TRIGGER &&
    options.traverseBack !== "both"
  ) {
    yield options.traverseBack ? ["yes"] : [];
    return;
  }
  if (request.optional) yield [];
  const offered = [...request.options]
    .filter((uid) => {
      if (request.from !== "hand") return true;
      const card = cards.get(uid);
      if (!card) throw new Error(`Unknown choice card ${uid}.`);
      if (options.keep.some((wanted) => matches(card, wanted))) return false;
      return (
        !request.prompt.startsWith("Banish") ||
        ![...options.neverBanish, { name: "Arknight Shard" }].some((wanted) =>
          matches(card, wanted),
        )
      );
    })
    .sort();
  if (!request.count) {
    if (!request.optional) yield [];
    return;
  }
  yield* selections(offered, request.count);
}

export function exploreTurn(initial: RulesState, request: unknown) {
  const options = schema.parse(request);
  checkInvariants(initial);
  if (initial.phase !== "action")
    throw new Error("Turn exploration must start in the action phase.");
  const root = structuredClone(initial);
  const cards = new Map(
    Object.values(root.zones)
      .flat()
      .map((instance) => [instance.uid, instance]),
  );
  const queue: Node[] = [{ state: root, actions: [] }];
  const lines: Line[] = [],
    frontier: Frontier[] = [];
  const failures: {
    actions: Move[];
    action: Move;
    kind: "trigger-budget";
    message: string;
  }[] = [];
  const counts = { states: 1, attempts: 0, illegal: 0, choiceCuts: 0 };
  const illegalReasons: Record<string, number> = {};
  let stopped: "state-limit" | "attempt-limit" | undefined;
  let cursor = 0;
  outer: for (; cursor < queue.length; cursor++) {
    const node = queue[cursor]!;
    if (node.actions.length >= options.limits.maxDepth) {
      frontier.push({ actions: node.actions, reason: "depth-limit" });
      continue;
    }
    for (const action of moves(node.state, options)) {
      const pending: { answers: string[][] }[] = [{ answers: [] }];
      let generated = 0;
      for (let answerIndex = 0; answerIndex < pending.length; answerIndex++) {
        if (
          counts.states >= options.limits.maxStates ||
          counts.attempts >= options.limits.maxAttempts
        ) {
          stopped =
            counts.states >= options.limits.maxStates
              ? "state-limit"
              : "attempt-limit";
          frontier.push({
            actions: node.actions,
            reason: stopped,
            pendingAction: action,
          });
          break outer;
        }
        const supplied = pending[answerIndex]!.answers;
        const move = {
          ...action,
          ...(supplied.length ? { answers: supplied } : {}),
        };
        counts.attempts++;
        try {
          const state = applySessionAction(node.state, move);
          checkInvariants(state);
          counts.states++;
          const path = [...node.actions, move];
          if (action.type === "endTurn") {
            const turn = summarisePatternTurns(root, {
              state,
              trace: state.events,
              steps: [],
            })[0];
            if (!turn) throw new Error("End turn produced no completed turn.");
            lines.push({
              actions: path,
              turn,
              final: view(state, options.startingLife),
            });
          } else queue.push({ state, actions: path });
        } catch (error) {
          if (error instanceof NeedsChoice) {
            if (supplied.length >= options.limits.maxChoiceDepth) {
              counts.choiceCuts++;
              frontier.push({
                actions: node.actions,
                reason: "choice-depth-limit",
                pendingAction: move,
              });
              continue;
            }
            const fixed =
              error.request.kind === "condition" ||
              (error.request.kind === "confirm" &&
                error.request.source === TRAVERSE_TRIGGER &&
                options.traverseBack !== "both");
            for (const answer of answers(error.request, options, cards)) {
              if (!fixed && generated >= options.limits.maxChoiceBranches) {
                counts.choiceCuts++;
                frontier.push({
                  actions: node.actions,
                  reason: "choice-limit",
                  pendingAction: move,
                });
                break;
              }
              if (!fixed) generated++;
              pending.push({ answers: [...supplied, answer] });
            }
          } else if (error instanceof RulesBudgetExceeded) {
            failures.push({
              actions: node.actions,
              action: move,
              kind: "trigger-budget",
              message: error.message,
            });
          } else if (error instanceof RulesError) {
            counts.illegal++;
            illegalReasons[error.message] =
              (illegalReasons[error.message] ?? 0) + 1;
          } else throw error;
        }
      }
    }
  }
  if (stopped) {
    for (const node of queue.slice(cursor + 1))
      frontier.push({ actions: node.actions, reason: stopped });
  }
  return {
    coverage: {
      exhaustive: false as const,
      completeWithinScope: !frontier.length && !failures.length,
      scope:
        "One engine turn; verified plays, pitches, Gates, weapons, optional arsenal and abilities; explicit constraints; no opponent or combat hits",
    },
    inputs: {
      ...options,
      label: "Assumed",
      strategy:
        "UNVERIFIED exploration; deterministic breadth-first enumeration, not a policy or hidden-future optimiser",
      engineVersion: ENGINE_VERSION,
      explorerVersion: "bounded-turn-v1",
      seed: root.seed,
      turn: root.turn,
      rulesDataVersion: rulesDataVersion(
        [...cards.values()].map((instance) => instance.card),
        root.triggers,
      ),
      neverBanishFromHand: [...options.neverBanish, { name: "Arknight Shard" }],
    },
    initial: view(root, options.startingLife),
    counts,
    lines,
    frontier,
    failures,
    illegalReasons,
  };
}
