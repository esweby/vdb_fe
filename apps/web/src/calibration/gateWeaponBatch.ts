// UNVERIFIED batch scheduling and ablation; the worked lines and bounded extension are approved.
import {
  runBatch,
  runScriptFromState,
  setUp,
  type BatchOptions,
  type BatchReport,
  type BatchSetup,
  type RulesState,
  type Script,
  type ScriptRun,
} from "@vdb/engine/rules";
import { baselineScript } from "../ranking/baselineScript.ts";
import { GATE_WEAPON_EXAMPLES } from "./gateWeaponExamples.ts";
import { selectDescendancyPlan } from "./descendancySetup.ts";
import { withBanishPolicy } from "./banishPolicy.ts";
import {
  REVIEWED_DELAYED_HAND_IDS,
  selectReviewedDelayedHand,
} from "./reviewedDelayedHands.ts";
import {
  returnAlreadyEnabled,
  selectTraverseBackPlan,
  TRAVERSE_TRIGGER,
} from "./traverseBackPolicy.ts";
import {
  selectGateWeaponExample,
  type GateWeaponDecisions,
} from "./gateWeaponSelection.ts";

export type GateWeaponMode = "baseline" | "gates" | "weapons" | "both";
export interface GateWeaponPolicyOptions {
  turns: number;
  mode: GateWeaponMode;
  startingLife?: number;
  decisions?: Omit<GateWeaponDecisions, "currentLife">;
  choices?: Script["choices"];
  traverseBackByTurn?: Record<number, boolean>;
}
export interface GateWeaponBatchOptions extends GateWeaponPolicyOptions {
  measureBslGateBloodDebt?: boolean;
  runs: number;
  seed: number;
  queries?: BatchOptions["queries"];
  /** Sees each policy run, in the same order as the report's perRun, before it's summarised. */
  onRun?: (run: ScriptRun) => void;
}
export interface GateWeaponPolicyRun extends ScriptRun {
  policyMatches: Record<string, number>;
}

const GATE_LINES = [
  "descendancy-first",
  "own-usurp-no-gate",
  "own-usurp-traverse-back",
  "spare-shard-descendancy",
];

function scriptFor(options: GateWeaponPolicyOptions): Script {
  if (options.traverseBackByTurn !== undefined) {
    if (options.mode === "baseline")
      throw new Error(
        "Per-turn traverse decisions require a non-baseline policy mode.",
      );
    if (
      !options.traverseBackByTurn ||
      typeof options.traverseBackByTurn !== "object" ||
      Array.isArray(options.traverseBackByTurn) ||
      Object.entries(options.traverseBackByTurn).some(
        ([turn, value]) =>
          !Number.isSafeInteger(Number(turn)) ||
          Number(turn) < 1 ||
          String(Number(turn)) !== turn ||
          typeof value !== "boolean",
      )
    )
      throw new Error(
        "Traverse-back decisions must map positive engine-turn numbers to booleans.",
      );
  }
  if (!["baseline", "gates", "weapons", "both"].includes(options.mode)) {
    throw new Error("Unknown Gate and weapon policy mode.");
  }
  if (
    options.startingLife !== undefined &&
    (!Number.isInteger(options.startingLife) || options.startingLife < 1)
  ) {
    throw new Error("Starting life must be a positive integer.");
  }
  const script = baselineScript(options.turns);
  const choices =
    options.mode === "baseline"
      ? options.choices
      : withBanishPolicy(options.choices);
  if (options.mode !== "baseline" && options.decisions?.reserveBsl === true)
    return {
      ...script,
      choices: {
        ...choices,
        keep: [
          ...(choices?.keep ?? []),
          { name: "Become the Shadow Lord", pitch: 3 },
        ],
      },
    };
  return choices ? { ...script, choices } : script;
}

export function runGateWeaponPolicyFromState(
  initial: RulesState,
  options: GateWeaponPolicyOptions,
): GateWeaponPolicyRun {
  const baseline = scriptFor(options);
  const policyMatches = Object.fromEntries(
    [
      ...GATE_WEAPON_EXAMPLES.map((example) => example.id),
      "descendancy-setup",
      "funded-descendancy",
      "explicit-usurp-traverse",
      ...REVIEWED_DELAYED_HAND_IDS,
    ].map((id) => [id, 0]),
  );
  if (options.mode === "baseline")
    return { ...runScriptFromState(initial, baseline), policyMatches };

  const decisionForTurn = (turn: number) =>
    (options.traverseBackByTurn &&
    Object.hasOwn(options.traverseBackByTurn, turn)
      ? options.traverseBackByTurn[turn]
      : undefined) ??
    options.decisions?.traverseBack ??
    baseline.choices?.optional?.[TRAVERSE_TRIGGER];
  if (options.traverseBackByTurn !== undefined) {
    for (let turn = initial.turn; turn < initial.turn + options.turns; turn++) {
      if (decisionForTurn(turn) === undefined)
        throw new Error(
          `An explicit traverse-back decision is required for engine turn ${turn}.`,
        );
    }
  }
  const reviewedChoices = new Map<number, Script["choices"]>();
  const choicesForTurn = (turn: number): Script["choices"] => {
    const traverseBack = decisionForTurn(turn);
    const choices = reviewedChoices.has(turn)
      ? { ...baseline.choices, ...reviewedChoices.get(turn) }
      : baseline.choices;
    return traverseBack === undefined
      ? choices
      : {
          ...choices,
          optional: {
            ...choices?.optional,
            [TRAVERSE_TRIGGER]: traverseBack,
          },
        };
  };

  let state = initial;
  let trace = state.events;
  let failure: string | undefined;
  const steps: ScriptRun["steps"] = [];
  const allowedIds = GATE_WEAPON_EXAMPLES.filter(
    (example) =>
      options.mode === "both" ||
      (options.mode === "gates"
        ? GATE_LINES.includes(example.id)
        : !GATE_LINES.includes(example.id)),
  ).map((example) => example.id);
  const append = (run: ScriptRun) => {
    state = run.state;
    trace = run.trace;
    failure = run.failure;
    steps.push(...run.steps);
  };
  const attemptPolicy = () => {
    const traverseBack = decisionForTurn(state.turn);
    const turnChoices = choicesForTurn(state.turn);
    const ids =
      traverseBack === true && returnAlreadyEnabled(state)
        ? allowedIds.filter((id) => id !== "own-usurp-traverse-back")
        : allowedIds;
    const example = selectGateWeaponExample(
      state,
      {
        ...options.decisions,
        traverseBack,
        currentLife:
          options.startingLife === undefined
            ? undefined
            : options.startingLife - state.lifeLost,
      },
      ids,
    );
    if (!example) {
      if (options.mode === "weapons") return;
      const preferred =
        selectReviewedDelayedHand(
          state,
          options.startingLife === undefined
            ? undefined
            : options.startingLife - state.lifeLost,
          turnChoices,
          options.mode === "both" &&
            options.decisions?.nebulaAfterDescendancy !== false,
        ) ??
        selectDescendancyPlan(
          state,
          options.startingLife,
          turnChoices,
          options.mode === "both" &&
            options.decisions?.nebulaAfterDescendancy !== false,
        );
      const usurp = preferred
        ? undefined
        : selectTraverseBackPlan(state, traverseBack, turnChoices);
      const plan =
        preferred ??
        (usurp ? { id: "explicit-usurp-traverse", script: usurp } : undefined);
      if (!plan) return;
      const run = runScriptFromState(state, plan.script);
      if (run.failure) {
        append(run);
        return;
      }
      const required = run.steps.filter(
        (step) => step.step !== "attackWithWeapon",
      );
      append(run);
      if (!required.length || required.some((step) => step.outcome !== "done"))
        return;
      if (REVIEWED_DELAYED_HAND_IDS.some((id) => id === plan.id))
        reviewedChoices.set(state.turn, { keep: plan.script.choices?.keep });
      policyMatches[plan.id]!++;
      return plan.id;
    }
    const script: Script = {
      ...example.script,
      choices: {
        ...turnChoices,
        ...example.script.choices,
        optional: {
          ...example.script.choices?.optional,
          ...turnChoices?.optional,
        },
      },
      steps:
        options.mode === "gates"
          ? example.script.steps.filter(
              (step) => step.do !== "attackWithWeapon",
            )
          : example.script.steps,
    };
    const run = runScriptFromState(state, script);
    if (run.failure || run.steps.some((step) => step.outcome !== "done"))
      return;
    append(run);
    policyMatches[example.id]!++;
    return example.id;
  };
  const applyBaseline = (step: Script["steps"][number]) =>
    append(
      runScriptFromState(state, {
        ...baseline,
        choices: choicesForTurn(state.turn),
        steps: [step],
      }),
    );

  for (let turn = 0; turn < options.turns && !failure; turn++) {
    const started = state.turn;
    for (let attempt = 0; attempt < 10 && !failure; attempt++) {
      const applied = attemptPolicy();
      if (
        failure ||
        state.turn !== started ||
        applied === "spare-shard-descendancy"
      )
        break;
      if (applied === "descendancy-setup") continue;
      applyBaseline({ do: "play", card: {} });
    }
    if (!failure && state.turn === started) {
      attemptPolicy();
      if (!failure && state.turn === started) applyBaseline({ do: "endTurn" });
    }
  }
  return {
    state,
    trace,
    steps,
    policyMatches,
    ...(failure ? { failure } : {}),
  };
}

export function runGateWeaponBatch(
  setup: BatchSetup,
  options: GateWeaponBatchOptions,
): BatchReport {
  const script = scriptFor(options);
  const batchOptions: BatchOptions = {
    ...(options.measureBslGateBloodDebt
      ? { measureBslGateBloodDebt: true }
      : {}),
    runs: options.runs,
    seed: options.seed,
    ...(options.queries ? { queries: options.queries } : {}),
  };
  if (options.mode === "baseline") return runBatch(setup, script, batchOptions);
  const assumptions: Record<string, string | number | boolean> = {
    label: "Assumed",
    mode: options.mode,
    strategy:
      "UNVERIFIED: BSL setup, bounded Descendancy life payment and highest-pitch funding from non-kept cards",
    ...options.decisions,
  };
  if (options.startingLife !== undefined)
    assumptions.startingLife = options.startingLife;
  if (options.traverseBackByTurn !== undefined)
    assumptions.traverseBackByTurn = JSON.stringify(options.traverseBackByTurn);
  return runBatch(setup, script, {
    ...batchOptions,
    policy: {
      id: "reviewed-delayed-hands-v2",
      assumptions,
      run: (input) => {
        const run = runGateWeaponPolicyFromState(setUp(input), options);
        options.onRun?.(run);
        return run;
      },
    },
  });
}
