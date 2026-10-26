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
import { baselineScript } from "../ranking/scenarioRuns.ts";
import { GATE_WEAPON_EXAMPLES } from "./gateWeaponExamples.ts";
import { selectDescendancyPlan } from "./descendancySetup.ts";
import { withBanishPolicy } from "./banishPolicy.ts";
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
}
export interface GateWeaponBatchOptions extends GateWeaponPolicyOptions {
  measureBslGateBloodDebt?: boolean;
  runs: number;
  seed: number;
  queries?: BatchOptions["queries"];
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
    ].map((id) => [id, 0]),
  );
  if (options.mode === "baseline")
    return { ...runScriptFromState(initial, baseline), policyMatches };

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
    const example = selectGateWeaponExample(
      state,
      {
        ...options.decisions,
        currentLife:
          options.startingLife === undefined
            ? undefined
            : options.startingLife - state.lifeLost,
      },
      allowedIds,
    );
    if (!example) {
      if (options.mode === "weapons") return;
      const plan = selectDescendancyPlan(
        state,
        options.startingLife,
        baseline.choices,
        options.mode === "both" &&
          options.decisions?.nebulaAfterDescendancy !== false,
      );
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
      policyMatches[plan.id]!++;
      return plan.id;
    }
    const script: Script = {
      ...example.script,
      choices: {
        ...baseline.choices,
        ...example.script.choices,
        optional: {
          ...baseline.choices?.optional,
          ...example.script.choices?.optional,
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
    append(runScriptFromState(state, { ...baseline, steps: [step] }));

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
  return runBatch(setup, script, {
    ...batchOptions,
    policy: {
      id: "draft-forsaken-funding-v1",
      assumptions,
      run: (input) => runGateWeaponPolicyFromState(setUp(input), options),
    },
  });
}
