// Play by the rules (docs/rules-engine.md, step 7b): the rules engine's baseline script run on
// this deck, with coverage shown before anything runs. A preview: only cards with signed-off
// rules are played; the rest can be pitched or held.
import { coverage, type RulesCard } from "@esweby/fab-engine/rules";
import { useMemo, useState } from "react";
import { sectionOf, type DeckEntry } from "../decks/deckRules.ts";
import { runByTheRules } from "../ranking/runScenarios.ts";
import { RULES_RUNS, type RulesOutput } from "../ranking/scenarioRuns.ts";
import { Button } from "../ui/index.ts";
import { rulesCardOf } from "./rulesCards.ts";
import styles from "./ScenarioBuilder.module.css";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => x.toLocaleString("en-GB");
const avg = (x: number) => x.toFixed(1);

export function RulesPanel(props: { entries: DeckEntry[] }) {
  const main = props.entries.filter((e) => !e.sideboard);
  const signature = JSON.stringify(
    main.map((e) => [e.variant.id, e.quantity]).sort(),
  );
  const { deck, weapons } = useMemo(() => {
    const copies = (section: "deck" | "weapon") =>
      main
        .filter((e) => sectionOf(e.card) === section)
        .flatMap((e): RulesCard[] =>
          Array.from({ length: e.quantity }, () =>
            rulesCardOf(e.card, e.variant),
          ),
        );
    return { deck: copies("deck"), weapons: copies("weapon") };
    // The signature covers the main deck and loadout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const covered = coverage(deck);
  const [turns, setTurns] = useState(3);
  const [side, setSide] = useState<"forsaken" | "usurper">("forsaken");
  const [run, setRun] = useState<{
    output: RulesOutput;
    key: string;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const key = JSON.stringify([signature, turns, side]);

  function start() {
    setRunning(true);
    const used = key;
    runByTheRules({
      kind: "rules",
      deck,
      weapons,
      side,
      turns,
      runs: RULES_RUNS,
      seed: 1,
    }).then(
      (output) => {
        setRun({ output, key: used });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }

  const output = run?.output;
  return (
    <section className={styles.builder} aria-label="Play by the rules">
      <header className={styles.head}>
        <div>
          <h2>Play by the rules (preview)</h2>
          <p>
            Plays this deck's turns with the rules engine: Viserai's two sides,
            Runechants, Usurp, Blood Debt and Gates, and only the cards whose
            rules have been signed off.
          </p>
        </div>
        <div className={styles.save}>
          <label className={styles.select}>
            <span>Turns</span>
            <select
              value={turns}
              onChange={(e) => setTurns(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.select}>
            <span>Start on</span>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as typeof side)}
            >
              <option value="forsaken">Forsaken</option>
              <option value="usurper">Usurper</option>
            </select>
          </label>
          <Button
            variant="primary"
            disabled={running || deck.length === 0}
            onClick={start}
          >
            {running ? "Running…" : "Run by the rules"}
          </Button>
        </div>
      </header>

      <p>
        {`${covered.modelled} of ${covered.total} deck cards modelled (${covered.total ? pct(covered.modelled / covered.total) : "0%"}).`}
      </p>
      {covered.unmodelled.length > 0 && (
        <p className={styles.hint}>
          {`Not modelled yet: ${covered.unmodelled.join(", ")}. The engine can pitch or hold these, but won't play them.`}
        </p>
      )}

      {output && (
        <div className={styles.result}>
          {run.key !== key && (
            <p className={styles.stale}>
              The deck or settings have changed since this run. Run again to
              update.
            </p>
          )}
          <p className={styles.rate}>
            {`${n(output.runs)} runs · ${n(output.completed)} completed · ${n(output.failed)} failed · seed ${output.inputs.seed} · rules data ${output.inputs.rulesDataVersion}`}
          </p>
          {output.failures.length > 0 && (
            <ul aria-label="Failed runs">
              {output.failures.map((f) => (
                <li key={f.message}>{`${n(f.count)} runs: ${f.message}`}</li>
              ))}
            </ul>
          )}
          {output.byTurn.length > 0 && (
            <table className={styles.table} aria-label="By turn">
              <thead>
                <tr>
                  <th scope="col">Turn</th>
                  <th scope="col">Runechants made</th>
                  <th scope="col">A Gate by now</th>
                  <th scope="col">On Usurper at the end</th>
                  <th scope="col">Life lost by now</th>
                  <th scope="col">Blood debt card in the banished zone</th>
                </tr>
              </thead>
              <tbody>
                {output.byTurn.map((t) => (
                  <tr key={t.turn}>
                    <th scope="row">{`Turn ${t.turn}`}</th>
                    <td>{avg(t.runechantsMade)}</td>
                    <td>{pct(t.gateBy)}</td>
                    <td>{pct(t.onUsurperAtEnd)}</td>
                    <td>{avg(t.lifeLost)}</td>
                    <td>{pct(t.queries.bloodDebtBanished ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={styles.hint}>
            Each turn plays every card the rules allow, lowest pitch first,
            pitching the highest first to pay, then ends the turn. That's a
            fixed policy, not the best play. Averages and shares are over
            completed runs. On-hit effects aren't counted.
          </p>
        </div>
      )}
    </section>
  );
}
