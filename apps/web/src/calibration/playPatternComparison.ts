// UNVERIFIED priority experiments; the runner compares declared policies, not optimal play.
import { z } from "zod";
import { ENGINE_VERSION } from "@esweby/fab-engine";
import {
  checkInvariants,
  parseScript,
  rulesDataVersion,
  runScriptFromState,
  setUp,
  type BatchSetup,
  type RulesInstance,
  type RulesState,
  type Script,
  type ScriptRun,
  type ScriptStep,
} from "@esweby/fab-engine/rules";
import { runGateWeaponPolicyFromState } from "./gateWeaponBatch.ts";
import { TRAVERSE_TRIGGER } from "./traverseBackPolicy.ts";

const identity = {
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().min(1).max(100),
};
const choices = z
  .unknown()
  .transform(
    (value) => parseScript({ version: 1, steps: [], choices: value }).choices,
  );
function boundedScript(value: unknown): Script {
  const script = parseScript(value);
  const work = (steps: ScriptStep[], depth = 0): number => {
    if (depth > 8) throw new Error("Custom script nesting limit is eight.");
    const total = steps.reduce(
      (sum, step) =>
        sum +
        1 +
        (step.do === "repeat"
          ? step.times * work(step.steps, depth + 1)
          : step.do === "if"
            ? Math.max(
                work(step.then, depth + 1),
                work(step.else ?? [], depth + 1),
              )
            : 0),
      0,
    );
    if (total > 5000)
      throw new Error("Custom scripts are limited to 5000 expanded commands.");
    return total;
  };
  work(script.steps);
  return script;
}
const patternSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...identity,
    kind: z.literal("script"),
    script: z.unknown().transform(boundedScript),
  }),
  z.strictObject({
    ...identity,
    kind: z.literal("gate"),
    mode: z.enum(["baseline", "gates", "weapons", "both"]).default("both"),
    decisions: z
      .strictObject({
        reserveBsl: z.boolean().optional(),
        nebulaAfterDescendancy: z.boolean().optional(),
        otherPlaysFinished: z.boolean().optional(),
        spareShard: z.boolean().optional(),
      })
      .optional(),
    choices: choices.optional(),
  }),
]);
const requestSchema = z.strictObject({
  seeds: z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(2 ** 31 - 1),
    )
    .min(1)
    .max(1000)
    .refine(
      (values) => new Set(values).size === values.length,
      "Seeds must be distinct",
    ),
  turns: z.number().int().min(1).max(20),
  startingLife: z.number().int().positive(),
  traverseBack: z.boolean(),
  conditions: z.strictObject({
    hero_lost_life_this_turn: z.boolean(),
    less_life_than_opposing_hero: z.boolean(),
  }),
  patterns: z
    .array(patternSchema)
    .min(1)
    .max(16)
    .refine(
      (values) =>
        new Set(values.map((pattern) => pattern.id)).size === values.length,
      "Pattern IDs must be distinct",
    ),
});
type Pattern = z.infer<typeof patternSchema>;
type CardRef = Pick<RulesInstance["card"], "name" | "pitch"> & { uid: string };
export interface PatternTurn {
  turn: number;
  threatened: number;
  arcane: number;
  selfLoss: number;
  lifeLost: number;
  gatesActivated: number;
  runechantsMade: number;
  floatingBeforeEnd: number;
  held: CardRef[];
  refilledHand: CardRef[];
  tokens: Record<string, number>;
  side: RulesState["side"];
  actions: {
    type: "pitch" | "play" | "gate" | "weapon" | "activate";
    card: CardRef;
    amount?: number;
  }[];
}

const ref = (instance: RulesInstance): CardRef => ({
  uid: instance.uid,
  name: instance.card.name,
  pitch: instance.card.pitch,
});
export const visiblePatternState = (
  state: RulesState,
  startingLife: number,
) => ({
  turn: state.turn,
  side: state.side,
  hand: state.zones.hand.map(ref),
  arsenal: state.zones.arsenal.map(ref),
  banished: state.zones.banished
    .filter((instance) => !state.faceDown.includes(instance.uid))
    .map(ref),
  faceDownBanish: state.zones.banished.filter((instance) =>
    state.faceDown.includes(instance.uid),
  ).length,
  deckRemaining: state.zones.deck.length,
  tokens: { ...state.tokens },
  resources: state.resources,
  actionPoints: state.actionPoints,
  lifeLost: state.lifeLost,
  remainingLife: startingLife - state.lifeLost,
});

export function summarisePatternTurns(
  initial: RulesState,
  run: ScriptRun,
): PatternTurn[] {
  const cards = new Map(
    Object.values(initial.zones)
      .flat()
      .map((instance) => [instance.uid, instance]),
  );
  const hand = new Set(initial.zones.hand.map((instance) => instance.uid));
  const held = () => [...hand].map((uid) => ref(cards.get(uid)!));
  const tokens = { ...initial.tokens };
  let side = initial.side,
    lifeLost = initial.lifeLost,
    resources = initial.resources;
  const turns: PatternTurn[] = [];
  const fresh = (turn: number): PatternTurn => ({
    turn,
    threatened: 0,
    arcane: 0,
    selfLoss: 0,
    lifeLost,
    gatesActivated: 0,
    runechantsMade: 0,
    floatingBeforeEnd: 0,
    held: [],
    refilledHand: [],
    tokens: {},
    side,
    actions: [],
  });
  let current = fresh(initial.turn);
  for (const event of run.trace.slice(initial.events.length)) {
    if (event.type === "moved") {
      if (event.from === "hand") hand.delete(event.uid);
      if (event.to === "hand") hand.add(event.uid);
    }
    if (event.type === "drew") event.uids.forEach((uid) => hand.add(uid));
    if (event.type === "pitched") {
      resources += event.amount;
      current.actions.push({
        type: "pitch",
        card: ref(cards.get(event.uid)!),
        amount: event.amount,
      });
    }
    if (event.type === "resourcesGained") resources += event.amount;
    if (event.type === "played") {
      resources -= event.cost;
      current.actions.push({
        type: "play",
        card: ref(cards.get(event.uid)!),
        amount: event.cost,
      });
    }
    if (event.type === "attackPlayed") {
      const instance = cards.get(event.uid)!;
      current.threatened += instance.card.power ?? 0;
      if (instance.card.type === "weapon") {
        resources -= instance.card.weaponAttack?.cost ?? 0;
        current.actions.push({ type: "weapon", card: ref(instance) });
      }
    }
    if (event.type === "activated") {
      const instance = cards.get(event.uid)!;
      resources -= instance.card.activate?.cost ?? 0;
      current.actions.push({ type: "activate", card: ref(instance) });
    }
    if (event.type === "gateActivated") {
      resources -= 1;
      current.gatesActivated++;
      current.actions.push({
        type: "gate",
        card: ref(cards.get(event.target)!),
      });
    }
    if (event.type === "tokensCreated") {
      tokens[event.token] = (tokens[event.token] ?? 0) + event.amount;
      if (event.token === "runechant") current.runechantsMade += event.amount;
    }
    if (event.type === "tokensRemoved")
      tokens[event.token] = (tokens[event.token] ?? 0) - event.amount;
    if (event.type === "usurped") current.threatened += 2;
    if (event.type === "arcaneDamage") current.arcane += event.amount;
    if (event.type === "lifeLost") {
      lifeLost += event.amount;
      current.selfLoss += event.amount;
    }
    if (event.type === "traversed") side = event.to;
    if (event.type === "endPhaseStarted") current.floatingBeforeEnd = resources;
    if (event.type === "turnEnded") {
      turns.push({
        ...current,
        lifeLost,
        side,
        held: held(),
        tokens: { ...tokens },
      });
      resources = 0;
    }
    if (event.type === "turnStarted") {
      if (turns.length) turns.at(-1)!.refilledHand = held();
      current = fresh(event.turn);
    }
  }
  return turns;
}

export function priorityPatterns(): Pattern[] {
  return [
    {
      id: "current",
      label: "Current reviewed policy",
      kind: "gate",
      mode: "both",
    },
    {
      id: "keep-bsl",
      label: "Keep BSL",
      kind: "gate",
      mode: "both",
      decisions: { reserveBsl: true },
    },
    {
      id: "no-auto-sword",
      label: "No automatic sword after funded Descendancy",
      kind: "gate",
      mode: "both",
      decisions: { nebulaAfterDescendancy: false },
    },
    {
      id: "keep-bsl-no-auto-sword",
      label: "Keep BSL; no automatic sword after funded Descendancy",
      kind: "gate",
      mode: "both",
      decisions: { reserveBsl: true, nebulaAfterDescendancy: false },
    },
    {
      id: "no-extra-life",
      label: "No voluntary life payments",
      kind: "gate",
      mode: "both",
      choices: { lifePayment: 0 },
    },
  ];
}

export function comparePlayPatterns(setup: BatchSetup, request: unknown) {
  const options = requestSchema.parse(request);
  const patterns = options.patterns.map((pattern) => {
    const supplied =
      pattern.kind === "script" ? pattern.script.choices : pattern.choices;
    for (const [condition, answer] of Object.entries(options.conditions)) {
      if (
        supplied?.conditions?.[condition as keyof typeof options.conditions] !==
          undefined &&
        supplied.conditions[condition as keyof typeof options.conditions] !==
          answer
      )
        throw new Error(
          `Pattern ${pattern.id} conflicts with common condition ${condition}.`,
        );
    }
    if (
      supplied?.optional?.[TRAVERSE_TRIGGER] !== undefined &&
      supplied.optional[TRAVERSE_TRIGGER] !== options.traverseBack
    )
      throw new Error(
        `Pattern ${pattern.id} conflicts with the common return answer.`,
      );
    const choices: Script["choices"] = {
      ...supplied,
      conditions: options.conditions,
      optional: {
        ...supplied?.optional,
        [TRAVERSE_TRIGGER]: options.traverseBack,
      },
    };
    return pattern.kind === "script"
      ? { ...pattern, script: { ...pattern.script, choices } }
      : { ...pattern, choices };
  });
  return {
    coverage: {
      exhaustive: false as const,
      patterns: patterns.length,
      seeds: options.seeds.length,
    },
    inputs: {
      ...options,
      patterns,
      label: "Assumed" as const,
      strategy:
        "UNVERIFIED priority experiments; listed patterns only, not optimal play or exhaustive legal-move search",
      engineVersion: ENGINE_VERSION,
      rulesDataVersion: rulesDataVersion(
        [...setup.deck, ...(setup.weapons ?? []), ...(setup.equipment ?? [])],
        setup.triggers ?? [],
      ),
      deckSize: setup.deck.length,
      order: setup.order ?? "shuffled",
      startSide: setup.side ?? "forsaken",
      gatePolicyVersion: "reviewed-delayed-hands-v2",
    },
    cases: options.seeds.map((seed) => {
      const initial = setUp(structuredClone({ ...setup, seed }));
      return {
        seed,
        initialHand: initial.zones.hand.map(ref),
        patterns: patterns.map((pattern) => {
          const state = structuredClone(initial);
          const run =
            pattern.kind === "script"
              ? runScriptFromState(state, pattern.script)
              : runGateWeaponPolicyFromState(state, {
                  turns: options.turns,
                  mode: pattern.mode,
                  startingLife: options.startingLife,
                  decisions: {
                    ...pattern.decisions,
                    traverseBack: options.traverseBack,
                  },
                  choices: pattern.choices,
                });
          checkInvariants(run.state);
          const turns = summarisePatternTurns(initial, run);
          return {
            id: pattern.id,
            label: pattern.label,
            status: run.failure
              ? ("failed" as const)
              : turns.length === options.turns
                ? ("completed" as const)
                : ("incomplete" as const),
            ...(run.failure ? { failure: run.failure } : {}),
            turns,
            steps: run.steps,
            ...(run.policyMatches ? { policyMatches: run.policyMatches } : {}),
            final: visiblePatternState(run.state, options.startingLife),
          };
        }),
      };
    }),
  };
}
