// UNVERIFIED batch scheduling and ablation; the five exact worked lines are approved.
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
  runs: number;
  seed: number;
  queries?: BatchOptions["queries"];
}
export interface GateWeaponPolicyRun extends ScriptRun {
  policyMatches: Record<string, number>;
}

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
  return options.choices ? { ...script, choices: options.choices } : script;
}

export function runGateWeaponPolicyFromState(
  initial: RulesState,
  options: GateWeaponPolicyOptions,
): GateWeaponPolicyRun {
  const baseline = scriptFor(options);
  const policyMatches = Object.fromEntries(
    GATE_WEAPON_EXAMPLES.map((example) => [example.id, 0]),
  );
  if (options.mode === "baseline")
    return { ...runScriptFromState(initial, baseline), policyMatches };

  let state = initial;
  let trace = state.events;
  let failure: string | undefined;
  const steps: ScriptRun["steps"] = [];
  const append = (run: ScriptRun) => {
    state = run.state;
    trace = run.trace;
    failure = run.failure;
    steps.push(...run.steps);
  };
  const attemptPolicy = () => {
    const example = selectGateWeaponExample(state, {
      ...options.decisions,
      currentLife:
        options.startingLife === undefined
          ? undefined
          : options.startingLife - state.lifeLost,
    });
    if (!example) return;
    const gateLine = [
      "descendancy-first",
      "own-usurp-no-gate",
      "own-usurp-traverse-back",
    ].includes(example.id);
    if (
      (options.mode === "gates" && !gateLine) ||
      (options.mode === "weapons" && gateLine)
    )
      return;
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
  };
  const applyBaseline = (step: Script["steps"][number]) =>
    append(runScriptFromState(state, { ...baseline, steps: [step] }));

  for (let turn = 0; turn < options.turns && !failure; turn++) {
    const started = state.turn;
    for (let attempt = 0; attempt < 10 && !failure; attempt++) {
      attemptPolicy();
      if (state.turn !== started) break;
      applyBaseline({ do: "play", card: {} });
    }
    if (!failure && state.turn === started) {
      attemptPolicy();
      if (state.turn === started) applyBaseline({ do: "endTurn" });
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
    runs: options.runs,
    seed: options.seed,
    ...(options.queries ? { queries: options.queries } : {}),
  };
  if (options.mode === "baseline") return runBatch(setup, script, batchOptions);
  const assumptions: Record<string, string | number | boolean> = {
    label: "Assumed",
    mode: options.mode,
    ...options.decisions,
  };
  if (options.startingLife !== undefined)
    assumptions.startingLife = options.startingLife;
  return runBatch(setup, script, {
    ...batchOptions,
    policy: {
      id: "reviewed-gate-weapon-v1",
      assumptions,
      run: (input) => runGateWeaponPolicyFromState(setUp(input), options),
    },
  });
}
