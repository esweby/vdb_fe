// Build a scenario from blocks and run it against a deck (README "Building a rule" and "Running
// a scenario", phase two step 6), and save it (README "Saved scenarios"). Steps are stage 2.
import { ROLES } from "@vdb/cards";
import type { EngineCard, ScenarioDefinition } from "@vdb/engine";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { encodeFixed } from "../decks/goldfishLink.ts";
import { TYPE_LABELS } from "../cards/filterCards.ts";
import { PITCH_NAMES } from "../decks/deckRules.ts";
import { runScenario } from "../ranking/runScenarios.ts";
import { RUNS, type OneOutput } from "../ranking/scenarioRuns.ts";
import { BUILT_IN_SCENARIOS } from "../ranking/scenarios.ts";
import { Button, TextField } from "../ui/index.ts";
import { labelsOf, TRAITS } from "./blocks.ts";
import type { SavedScenario, Visibility } from "./scenarioRepository.ts";
import {
  fromDefinition,
  newBlock,
  newDraft,
  newGroup,
  numbering,
  toDefinition,
  updateAt,
  type BlockDraft,
  type Draft,
  type GroupDraft,
  type Path,
} from "./draft.ts";
import styles from "./ScenarioBuilder.module.css";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const rate = (x: number) => `${(x * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-GB");
const HORIZONS = [0, 2, 3, 4, 5, 6];
const ZONES = [
  { zone: "hand", label: "Hand" },
  { zone: "arsenal", label: "Arsenal" },
  { zone: "topOfDeck", label: "Top card of the deck" },
] as const;

export interface DeckForScenarios {
  core: { card: EngineCard; copies: number }[];
  gear: EngineCard[];
  deckSize: number;
}

const variantKey = (c: EngineCard) => `${c.name}|${c.pitch ?? ""}`;
const variantLabel = (c: EngineCard) =>
  c.pitch !== null && PITCH_NAMES[c.pitch]
    ? `${c.name} (${PITCH_NAMES[c.pitch]})`
    : c.name;

function Select(props: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.select}>
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export const VISIBILITY: Record<Visibility, string> = {
  private: "Private",
  link: "Anyone with the link",
  library: "In the library",
};

export const shareLink = (id: string) =>
  `${window.location.origin}/scenarios/${id}`;

export function ScenarioBuilder(props: {
  deck: DeckForScenarios;
  /** The deck's id, for opening failed runs in its goldfish tab. */
  deckId?: string;
  /** A saved scenario of the person's own, to edit. */
  editing?: SavedScenario;
  /** Saving is for signed-in people; without it there's no Save. */
  onSave?: (
    definition: ScenarioDefinition,
    visibility: Visibility,
    id?: string,
  ) => void;
  /** Curators and admins can save straight into the library. */
  canUseLibrary?: boolean;
}) {
  const { editing } = props;
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? fromDefinition(editing.definition) : newDraft(),
  );
  const [visibility, setVisibility] = useState<Visibility>(
    editing?.visibility ?? "private",
  );
  const [run, setRun] = useState<{
    output: OneOutput;
    key: string;
    definition: ScenarioDefinition;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const checked = useMemo(() => toDefinition(draft), [draft]);
  const key = JSON.stringify([checked, props.deck]);
  const { blocks, groups } = numbering(draft.condition);

  const names = [...new Set(props.deck.core.map((c) => c.card.name))].sort();
  const variants = props.deck.core
    .map((c) => c.card)
    .filter(
      (c, i, all) =>
        all.findIndex((d) => variantKey(d) === variantKey(c)) === i,
    )
    .sort((a, b) => variantLabel(a).localeCompare(variantLabel(b)));

  const set = (change: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...change }));
  const setAt = (
    path: Path,
    change: (item: GroupDraft | BlockDraft) => GroupDraft | BlockDraft | null,
  ) =>
    setDraft((d) => ({ ...d, condition: updateAt(d.condition, path, change) }));

  function start(seed: number) {
    if (!("definition" in checked)) return;
    setRunning(true);
    const used = key;
    const { definition } = checked;
    runScenario({
      definition,
      ...props.deck,
      runs: RUNS,
      seed,
    }).then(
      (output) => {
        setRun({ output, key: used, definition });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }

  function renderBlock(block: BlockDraft, path: Path) {
    const number = blocks.get(path.join("."));
    const setBlock = (change: Partial<BlockDraft>) =>
      setAt(path, (b) => ({ ...(b as BlockDraft), ...change }));
    const setFilter = (field: keyof BlockDraft["filter"], value: string) =>
      setBlock({
        filter: {
          ...block.filter,
          [field]:
            value === ""
              ? undefined
              : field === "pitch"
                ? Number(value)
                : value,
        },
      });
    return (
      <fieldset
        key={path.join(".")}
        className={styles.block}
        aria-label={`Block ${number}`}
      >
        <div className={styles.row}>
          <Select
            label="Count"
            value={block.measure}
            options={[
              ["cards", "Cards"],
              ["distinct", "Different cards"],
              ["runechants", "Runechants made"],
              ["gates", "Gates made"],
            ]}
            onChange={(v) => setBlock({ measure: v as BlockDraft["measure"] })}
          />
          <Select
            label="Compare"
            value={block.compare}
            options={[
              ["atLeast", "At least"],
              ["atMost", "At most"],
              ["exactly", "Exactly"],
            ]}
            onChange={(v) => setBlock({ compare: v as BlockDraft["compare"] })}
          />
          <TextField
            label="Amount"
            className={styles.amount}
            inputMode="numeric"
            value={block.amount}
            onChange={(e) => setBlock({ amount: e.target.value })}
          />
          <Button
            className={styles.remove}
            onClick={() => setAt(path, () => null)}
          >
            Remove block
          </Button>
        </div>
        <div className={styles.row}>
          <span className={styles.from}>from cards matching</span>
          <Select
            label="Card"
            value={block.filter.name ?? ""}
            options={[
              ["", "Any card"],
              ...names.map((x): [string, string] => [x, x]),
            ]}
            onChange={(v) => setFilter("name", v)}
          />
          <Select
            label="Card fact"
            value={block.filter.role ?? ""}
            options={[
              ["", "Any"],
              ...ROLES.map((r): [string, string] => [r.id, r.name]),
            ]}
            onChange={(v) => setFilter("role", v)}
          />
          <Select
            label="Class, talent or trait"
            value={block.filter.trait ?? ""}
            options={[["", "Any"], ...Object.entries(TRAITS)]}
            onChange={(v) => setFilter("trait", v)}
          />
          <Select
            label="Type"
            value={block.filter.type ?? ""}
            options={[["", "Any"], ...Object.entries(TYPE_LABELS)]}
            onChange={(v) => setFilter("type", v)}
          />
          <Select
            label="Pitch"
            value={
              block.filter.pitch === undefined ? "" : String(block.filter.pitch)
            }
            options={[
              ["", "Any"],
              ["1", "Red"],
              ["2", "Yellow"],
              ["3", "Blue"],
            ]}
            onChange={(v) => setFilter("pitch", v)}
          />
        </div>
      </fieldset>
    );
  }

  function renderGroup(group: GroupDraft, path: Path) {
    const number = groups.get(path.join("."))!;
    const top = path.length === 0;
    return (
      <fieldset
        key={path.join(".")}
        className={top ? styles.topGroup : styles.group}
        aria-label={top ? "Conditions" : `Group ${number}`}
      >
        <div className={styles.row}>
          <Select
            label="Match"
            value={group.match}
            options={[
              ["all", "All of these"],
              ["any", "Any of these"],
            ]}
            onChange={(v) =>
              setAt(path, (g) => ({
                ...(g as GroupDraft),
                match: v as "all" | "any",
              }))
            }
          />
          {!top && (
            <Button
              className={styles.remove}
              onClick={() => setAt(path, () => null)}
            >
              Remove group
            </Button>
          )}
        </div>
        {group.items.map((item, i) =>
          item.kind === "block"
            ? renderBlock(item, [...path, i])
            : renderGroup(item, [...path, i]),
        )}
        <div className={styles.row}>
          <Button
            onClick={() =>
              setAt(path, (g) => ({
                ...(g as GroupDraft),
                items: [...(g as GroupDraft).items, newBlock()],
              }))
            }
          >
            Add a block
          </Button>
          <Button
            onClick={() =>
              setAt(path, (g) => ({
                ...(g as GroupDraft),
                items: [...(g as GroupDraft).items, newGroup()],
              }))
            }
          >
            Add a group
          </Button>
        </div>
      </fieldset>
    );
  }

  const output = run?.output;
  const result = output?.result;
  return (
    <section className={styles.builder} aria-label="Build a scenario">
      <header className={styles.head}>
        <div>
          <h2>Build a scenario</h2>
          <p>
            Shuffles this deck {n(RUNS)} times and checks your conditions in
            each. It counts what's visible; it doesn't play the game.
          </p>
        </div>
        {!editing && (
          <Select
            label="Start from"
            value=""
            options={[
              ["", "Choose a scenario…"],
              ["blank", "A blank scenario"],
              ...BUILT_IN_SCENARIOS.map(
                ({ definition: d }): [string, string] => [d.name, d.name],
              ),
            ]}
            onChange={(v) => {
              const built = BUILT_IN_SCENARIOS.find(
                (s) => s.definition.name === v,
              );
              if (v === "blank") setDraft(newDraft());
              else if (built) setDraft(fromDefinition(built.definition));
            }}
          />
        )}
      </header>

      <div className={styles.settings}>
        <TextField
          label="Name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Select
          label="Check"
          value={String(draft.horizon)}
          options={HORIZONS.map((h) => [
            String(h),
            h === 0 ? "Opening hand" : `By turn ${h}`,
          ])}
          onChange={(v) => set({ horizon: Number(v) })}
        />
        {draft.horizon > 0 && (
          <Select
            label="Between turns"
            value={draft.turnModel}
            options={[
              ["fresh", "Fresh hand each turn"],
              ["drawUp", "Keep the hand, draw up to 4"],
            ]}
            onChange={(v) => set({ turnModel: v as Draft["turnModel"] })}
          />
        )}
        <fieldset className={styles.access}>
          <legend>Conditions can see</legend>
          {ZONES.map(({ zone, label }) => (
            <label key={zone}>
              <input
                type="checkbox"
                checked={draft.access.includes(zone)}
                onChange={(e) =>
                  set({
                    access: e.target.checked
                      ? ZONES.map((z) => z.zone).filter(
                          (z) => z === zone || draft.access.includes(z),
                        )
                      : draft.access.filter((z) => z !== zone),
                  })
                }
              />
              {label}
            </label>
          ))}
          <span className={styles.hint}>
            Weapons and equipment always count.
          </span>
        </fieldset>
      </div>

      <fieldset className={styles.fixed}>
        <legend>Fixed cards</legend>
        <p className={styles.hint}>
          Cards assumed to already be in hand or arsenal. Each takes one copy
          out of the deck before shuffling.
        </p>
        {draft.fixed.map((f, i) => (
          <div
            key={i}
            role="group"
            aria-label={`Fixed card ${i + 1}`}
            className={styles.row}
          >
            <Select
              label="Card"
              value={`${f.name}|${f.pitch ?? ""}`}
              options={variants.map((c) => [variantKey(c), variantLabel(c)])}
              onChange={(v) => {
                const c = variants.find((x) => variantKey(x) === v)!;
                set({
                  fixed: draft.fixed.map((g, j) =>
                    j === i
                      ? { ...g, name: c.name, pitch: c.pitch ?? undefined }
                      : g,
                  ),
                });
              }}
            />
            <Select
              label="Where"
              value={f.zone}
              options={[
                ["hand", "Hand"],
                ["arsenal", "Arsenal"],
              ]}
              onChange={(v) =>
                set({
                  fixed: draft.fixed.map((g, j) =>
                    j === i ? { ...g, zone: v as "hand" | "arsenal" } : g,
                  ),
                })
              }
            />
            <Button
              onClick={() =>
                set({ fixed: draft.fixed.filter((_, j) => j !== i) })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          disabled={variants.length === 0}
          onClick={() => {
            const c = variants[0]!;
            set({
              fixed: [
                ...draft.fixed,
                { name: c.name, pitch: c.pitch ?? undefined, zone: "hand" },
              ],
            });
          }}
        >
          Add a fixed card
        </Button>
      </fieldset>

      {renderGroup(draft.condition, [])}

      <div className={styles.runRow}>
        {props.onSave && (
          <div className={styles.save}>
            <Select
              label="Who can see it"
              value={visibility}
              options={(Object.keys(VISIBILITY) as Visibility[])
                .filter(
                  (v) =>
                    v !== "library" ||
                    props.canUseLibrary ||
                    editing?.visibility === "library",
                )
                .map((v) => [v, VISIBILITY[v]])}
              onChange={(v) => setVisibility(v as Visibility)}
            />
            {"definition" in checked && (
              <>
                <Button
                  onClick={() =>
                    props.onSave!(checked.definition, visibility, editing?.id)
                  }
                >
                  {editing ? "Save changes" : "Save scenario"}
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      props.onSave!(checked.definition, visibility)
                    }
                  >
                    Save as new
                  </Button>
                )}
              </>
            )}
            {editing && editing.visibility !== "private" && (
              <TextField
                label="Share link"
                className={styles.link}
                readOnly
                value={shareLink(editing.id)}
                onFocus={(e) => e.target.select()}
              />
            )}
          </div>
        )}
        {"problem" in checked && (
          <p className={styles.problem} role="status">
            {checked.problem}
          </p>
        )}
        {output && (
          <Button
            disabled={running || "problem" in checked}
            onClick={() => start(output.seed + 1)}
          >
            New seed
          </Button>
        )}
        <Button
          variant="primary"
          disabled={running || "problem" in checked}
          onClick={() => start(output?.seed ?? 1)}
        >
          {running ? "Running…" : "Run this scenario"}
        </Button>
      </div>

      {output && (
        <section className={styles.result} aria-label="Scenario result">
          {run.key !== key && (
            <p className={styles.stale}>
              The scenario or deck has changed since this run. Run again to
              update.
            </p>
          )}
          {output.error ? (
            <p className={styles.problem}>
              {`Can't run on this deck: ${output.error}`}
            </p>
          ) : (
            result && (
              <>
                <p className={styles.rate}>
                  {`${rate(result.successRate)} of ${n(output.runs)} runs · seed ${output.seed} · ${output.deck.coreCards} deck cards + ${output.deck.blanks} blanks (${output.deck.deckSize})`}
                </p>
                <h3 id="checks">What it checks</h3>
                <ul aria-labelledby="checks">
                  {labelsOf(run.definition.condition).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                {result.byTurn.length > 0 && (
                  <>
                    <h3 id="by-turn">By turn</h3>
                    <ul aria-labelledby="by-turn" className={styles.byTurn}>
                      {result.byTurn.map((p, i) => (
                        <li key={i}>{`Turn ${i + 1}: ${pct(p)}`}</li>
                      ))}
                    </ul>
                  </>
                )}
                <h3 id="why">Why runs failed</h3>
                {result.failures.length === 0 ? (
                  <p>Every run passed.</p>
                ) : (
                  <ul aria-labelledby="why">
                    {result.failures.map((f) => (
                      <li key={f.label}>
                        {`${pct(f.share)} of failed runs missed “${f.label}”`}
                      </li>
                    ))}
                  </ul>
                )}
                <p className={styles.hint}>
                  A run can miss more than one block, so these can add up to
                  more than 100%. Hands of 4 (Viserai's intellect)
                  {output.deck.blanks > 0 &&
                    ", padded with blanks up to the deck size"}
                  .
                </p>
                {props.deckId &&
                  result.failedSeeds.length > 0 &&
                  (output.deck.blanks > 0 ? (
                    <p className={styles.hint}>
                      {`Fill the deck to ${output.deck.deckSize} cards to open failed hands in goldfish: these runs pad it with blanks, which goldfish doesn't have.`}
                    </p>
                  ) : (
                    <>
                      <h3 id="failed-hands">Failed hands</h3>
                      <ul aria-labelledby="failed-hands">
                        {result.failedSeeds.map((seed) => (
                          <li key={seed}>
                            <Link
                              to="/decks/$deckId"
                              params={{ deckId: props.deckId! }}
                              search={{
                                tab: "goldfish",
                                seed,
                                ...(run.definition.fixed?.length
                                  ? { fixed: encodeFixed(run.definition.fixed) }
                                  : {}),
                              }}
                            >
                              {`Open in goldfish (seed ${seed})`}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <p className={styles.hint}>
                        Each opens that run's exact shuffle on turn 1, fixed
                        cards included, to play out by hand. A few examples: the
                        reasons above are the full picture.
                      </p>
                    </>
                  ))}
              </>
            )
          )}
        </section>
      )}
    </section>
  );
}
