// A sideboard plan's goals (task 7c, docs/plan-goals.md): a scenario and a target success rate.
// A check runs each goal's scenario on the plan and on the main deck (or another plan) with the
// same seed, so the runs pair up. Which targets matter is the owner's call; the app suggests none.
import { useEffect, useMemo, useState } from "react";
import type { ScenarioDefinition } from "@esweby/fab-engine";
import { useAppSelector } from "../hooks.ts";
import { runPlanGoals } from "../ranking/runScenarios.ts";
import { RUNS } from "../ranking/scenarioRuns.ts";
import { BUILT_IN_SCENARIOS } from "../ranking/scenarios.ts";
import { scenarioDeck } from "../scenarios/scenarioDeck.ts";
import type { SavedScenario } from "../scenarios/scenarioRepository.ts";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { Matchup, PlanGoal } from "./deckRepository.ts";
import type { DeckEntry } from "./deckRules.ts";
import { entriesForMatchup } from "./matchupEntries.ts";
import {
  differenceVerdict,
  goalVerdict,
  pairedDifference,
  type GoalOutput,
} from "./planGoals.ts";
import styles from "./Decks.module.css";

/** One seed for every check, so a result can be repeated. */
const GOAL_SEED = 1;
const MAX_GOALS = 10;

const percent = (x: number) => `${(x * 100).toFixed(1)}%`;
const points = (x: number) =>
  `${x < 0 ? "−" : x > 0 ? "+" : ""}${Math.abs(x * 100).toFixed(1)}`;

interface Resolved {
  goal: PlanGoal;
  name: string;
  definition: ScenarioDefinition | null;
  builtIn: boolean;
}

export function PlanGoals(props: {
  planId: string;
  entries: DeckEntry[];
  /** The plan as it is on screen, saved or not. */
  plan: Map<string, number>;
  /** Every saved plan on the deck, to compare with. */
  plans: Matchup[];
}) {
  const { decks, scenarios: scenarioRepo } = useServices();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [goals, setGoals] = useState<PlanGoal[]>([]);
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const [target, setTarget] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [compareWith, setCompareWith] = useState("main");
  const [checked, setChecked] = useState<{
    signature: string;
    output: GoalOutput[];
  } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    setError(null);
    setChecked(null);
    setCompareWith("main");
    Promise.all([
      decks.listPlanGoals(props.planId),
      userId ? scenarioRepo.listScenarios(userId) : Promise.resolve([]),
    ]).then(
      ([nextGoals, nextSaved]) => {
        if (!live) return;
        setGoals(nextGoals);
        setSaved(nextSaved);
        setLoaded(true);
      },
      () => live && setError("Couldn't load the goals."),
    );
    return () => {
      live = false;
    };
  }, [decks, scenarioRepo, props.planId, userId]);

  const resolved: Resolved[] = goals.map((goal) => {
    if (goal.builtIn !== null) {
      const found = BUILT_IN_SCENARIOS.find(
        (s) => s.definition.name === goal.builtIn,
      );
      return {
        goal,
        name: found ? goal.builtIn : "A scenario that's no longer available",
        definition: found?.definition ?? null,
        builtIn: true,
      };
    }
    const found = saved.find((s) => s.id === goal.scenarioId);
    return {
      goal,
      name: found?.definition.name ?? "A scenario that's no longer available",
      definition: found?.definition ?? null,
      builtIn: false,
    };
  });

  const others = props.plans.filter((plan) => plan.id !== props.planId);
  const other = others.find((plan) => plan.id === compareWith);
  const otherName = other?.name ?? "Main deck";
  const planCards = [...props.plan].map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
  // What a check used; a result for anything else is cleared rather than shown.
  const signature = JSON.stringify([
    planCards
      .filter((c) => c.quantity > 0)
      .sort((a, b) => a.variantId.localeCompare(b.variantId)),
    compareWith,
    other?.cards,
    goals.map((g) => g.id),
  ]);
  const results = checked?.signature === signature ? checked.output : null;

  async function add() {
    const value = Number(target);
    if (!choice) {
      setTargetError("Choose a scenario.");
      return;
    }
    if (!/^\d+$/.test(target.trim()) || value < 1 || value > 99) {
      setTargetError("Give a target from 1% to 99%.");
      return;
    }
    const [kind, id] = [
      choice.slice(0, choice.indexOf(":")),
      choice.slice(choice.indexOf(":") + 1),
    ];
    setBusy(true);
    try {
      const added = await decks.addPlanGoal({
        planId: props.planId,
        scenarioId: kind === "saved" ? id : null,
        builtIn: kind === "built-in" ? id : null,
        target: value,
      });
      setGoals((current) => [...current, added]);
      setChoice("");
      setTarget("");
      setTargetError(null);
      setError(null);
    } catch (e) {
      setError(
        (e as { code?: string }).code === "23505"
          ? "That scenario already has a goal on this plan."
          : "Couldn't add the goal.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await decks.deletePlanGoal(id);
      setGoals((current) => current.filter((g) => g.id !== id));
      setError(null);
    } catch {
      setError("Couldn't remove the goal.");
    } finally {
      setBusy(false);
    }
  }

  const runnable = resolved.filter((r) => r.definition);
  function check() {
    setChecking(true);
    const used = signature;
    runPlanGoals({
      kind: "plan-goals",
      goals: runnable.map((r) => ({
        key: r.goal.id,
        definition: r.definition!,
        // The built-ins run without weapons and equipment, as on the Scenarios tab.
        gear: !r.builtIn,
      })),
      plan: scenarioDeck(entriesForMatchup(props.entries, planCards)),
      other: scenarioDeck(
        other ? entriesForMatchup(props.entries, other.cards) : props.entries,
      ),
      runs: RUNS,
      seed: GOAL_SEED,
    }).then(
      (output) => {
        setChecked({ signature: used, output });
        setChecking(false);
      },
      () => {
        setError("Couldn't check the goals.");
        setChecking(false);
      },
    );
  }

  const taken = new Set(goals.map((g) => g.scenarioId ?? `b:${g.builtIn}`));
  const options = useMemo(
    () => ({
      builtIn: BUILT_IN_SCENARIOS.map((s) => s.definition.name),
      mine: saved.filter((s) => s.mine),
      library: saved.filter((s) => !s.mine),
    }),
    [saved],
  );

  return (
    <section aria-label="Goals" className={styles.planGoals}>
      <h4>Goals</h4>
      <p className={styles.muted}>
        Set the success rate a scenario should reach with this plan. A check
        runs each one {RUNS.toLocaleString("en-GB")} times on the plan and on
        what you compare it with, using the same shuffles.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        !error && <p className={styles.muted}>Loading the goals…</p>
      ) : (
        <>
          {resolved.length > 0 && (
            <ul aria-label="This plan's goals" className={styles.goalList}>
              {resolved.map((r) => (
                <li key={r.goal.id}>
                  <span>{r.name}</span>
                  <span>{`at least ${r.goal.target}%`}</span>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Remove goal: ${r.name}`}
                    onClick={() => void remove(r.goal.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {goals.length < MAX_GOALS ? (
            <div className={styles.goalForm}>
              <label className={styles.matchupPick}>
                <span>Scenario</span>
                <select
                  value={choice}
                  disabled={busy}
                  onChange={(event) => {
                    setChoice(event.target.value);
                    setTargetError(null);
                  }}
                >
                  <option value="">Choose a scenario</option>
                  <optgroup label="Built-in">
                    {options.builtIn.map((name) => (
                      <option
                        key={name}
                        value={`built-in:${name}`}
                        disabled={taken.has(`b:${name}`)}
                      >
                        {name}
                      </option>
                    ))}
                  </optgroup>
                  {options.mine.length > 0 && (
                    <optgroup label="Your scenarios">
                      {options.mine.map((s) => (
                        <option
                          key={s.id}
                          value={`saved:${s.id}`}
                          disabled={taken.has(s.id)}
                        >
                          {s.definition.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {options.library.length > 0 && (
                    <optgroup label="Library">
                      {options.library.map((s) => (
                        <option
                          key={s.id}
                          value={`saved:${s.id}`}
                          disabled={taken.has(s.id)}
                        >
                          {s.definition.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <TextField
                label="Target (%)"
                inputMode="numeric"
                value={target}
                disabled={busy}
                error={targetError}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setTargetError(null);
                }}
              />
              <Button disabled={busy} onClick={() => void add()}>
                Add goal
              </Button>
            </div>
          ) : (
            <p className={styles.muted}>A plan holds up to 10 goals.</p>
          )}
          {runnable.length > 0 && (
            <div className={styles.goalCheck}>
              <label className={styles.matchupPick}>
                <span>Compare with</span>
                <select
                  value={compareWith}
                  disabled={checking}
                  onChange={(event) => setCompareWith(event.target.value)}
                >
                  <option value="main">Main deck</option>
                  {others.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={checking || busy} onClick={check}>
                {checking ? "Checking…" : "Check goals"}
              </Button>
            </div>
          )}
          {results && (
            <GoalResults
              resolved={resolved}
              output={results}
              otherName={otherName}
            />
          )}
        </>
      )}
    </section>
  );
}

function GoalResults(props: {
  resolved: Resolved[];
  output: GoalOutput[];
  otherName: string;
}) {
  return (
    <div className={styles.goalResults}>
      <table aria-label="Goal results">
        <thead>
          <tr>
            <th scope="col">Goal</th>
            <th scope="col">This plan</th>
            <th scope="col">Result</th>
            <th scope="col">{`vs ${props.otherName}`}</th>
          </tr>
        </thead>
        <tbody>
          {props.resolved.map((r) => {
            const out = props.output.find((o) => o.key === r.goal.id);
            if (!out) return null;
            const label = `${r.name}, at least ${r.goal.target}%`;
            if (!out.paired)
              return (
                <tr key={r.goal.id}>
                  <th scope="row">{label}</th>
                  <td colSpan={3}>{out.error ?? "Couldn't run."}</td>
                </tr>
              );
            const p = out.paired;
            const goal = goalVerdict(p.a, p.runs, r.goal.target / 100);
            const d = pairedDifference(p);
            const verdict = differenceVerdict(d);
            const interval = `95% interval ${points(d.low)} to ${points(d.high)}`;
            return (
              <tr key={r.goal.id}>
                <th scope="row">{label}</th>
                <td>
                  {percent(goal.rate)}
                  <small>{` (95%: ${percent(goal.low)}–${percent(goal.high)})`}</small>
                </td>
                <td data-verdict={goal.verdict}>
                  {goal.verdict === "met"
                    ? "Met"
                    : goal.verdict === "not met"
                      ? "Not met"
                      : "No clear answer"}
                </td>
                <td data-verdict={verdict}>
                  {verdict === "no clear difference"
                    ? d.low === 0 && d.high === 0
                      ? "No clear difference: the same result in every run"
                      : `No clear difference (${interval})`
                    : `${verdict === "higher" ? "Higher" : "Lower"} by ${Math.abs(d.difference * 100).toFixed(1)} points (${interval})`}
                  <small>{` · ${props.otherName} ${percent(p.b / p.runs)}`}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
