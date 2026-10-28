// UNVERIFIED deck comparison. It runs the current reviewed goldfish policy with no opponent, then
// answers a fixed set of questions about this deck next to common real lists. Every deck runs on
// the same seeds, so game i of this deck and game i of a list are a pair (docs/plan-goals.md).
import type {
  RulesCard,
  RulesEvent,
  RulesState,
  RunSummary,
} from "@vdb/engine/rules";
import { BLOOD_DEBT, RUNECHANT, VISERAI } from "@vdb/engine/rules";
import { runGateWeaponBatch } from "../calibration/gateWeaponBatch.ts";
import { wilson } from "../fablazing/stats.ts";
import {
  differenceVerdict,
  pairedDifference,
  pairOutcomes,
  type Difference,
  type DifferenceVerdict,
} from "./planGoals.ts";

export const FULL_ANALYSIS_RUNS = 1_000;
export const FULL_ANALYSIS_TURNS = 8;
/** UNVERIFIED: the turn the answers open on. The maintainer decides which turns matter. */
export const DEFAULT_ANSWER_TURN = 6;

export const USURP_THE_SHADOW_THRONE = "Usurp the Shadow Throne";
/** The blue 4-cost Rune Gate cards the maintainer named (28 Oct 2026). */
export const RUNE_GATE_CARDS = [
  "Widespread Annihilation",
  "Deep Recesses of Existence",
];
const WATCHED_CARDS = [USURP_THE_SHADOW_THRONE, ...RUNE_GATE_CARDS];

/** One finished game's measures. Damage is the running total at the end of each turn. */
export interface ProfileRun {
  completed: boolean;
  damage: number[];
  gateTurn: number | null;
  usurperTurn: number | null;
  chain: {
    reached: 0 | 1 | 2 | 3;
    setupTurn: number | null;
    payoffTurn: number | null;
  };
  /** The first play of each watched card; Usurp the Shadow Throne only at its reduced cost. */
  cards: Record<string, { turn: number; fromBanish: boolean }>;
}

export function watchedPlays(
  trace: readonly RulesEvent[],
  cards: ReadonlyMap<string, RulesCard>,
): ProfileRun["cards"] {
  const plays: ProfileRun["cards"] = {};
  let turn = 1;
  let previous: RulesEvent | undefined;
  for (const event of trace) {
    if (event.type === "turnStarted") turn = event.turn;
    if (event.type === "played") {
      const card = cards.get(event.uid);
      const name = card?.name;
      if (
        name &&
        WATCHED_CARDS.includes(name) &&
        !plays[name] &&
        (name !== USURP_THE_SHADOW_THRONE || event.cost < (card.cost ?? 0))
      )
        plays[name] = {
          turn,
          fromBanish:
            previous?.type === "playedFromBanish" && previous.uid === event.uid,
        };
    }
    previous = event;
  }
  return plays;
}

export function profileRun(
  summary: RunSummary,
  run:
    | { trace: readonly RulesEvent[]; cards: ReadonlyMap<string, RulesCard> }
    | undefined,
): ProfileRun {
  if (!summary.completed || !run)
    return {
      completed: false,
      damage: [],
      gateTurn: null,
      usurperTurn: null,
      chain: { reached: 0, setupTurn: null, payoffTurn: null },
      cards: {},
    };
  let total = 0;
  const gate = summary.turns.findIndex((turn) => turn.gateBy);
  const chain = summary.bslGateBloodDebt;
  return {
    completed: true,
    damage: summary.turns.map(
      (turn) => (total += turn.threatened + turn.arcane),
    ),
    gateTurn: gate === -1 ? null : gate + 1,
    usurperTurn: summary.firstTraverseTurn,
    chain: {
      reached: chain?.reached ?? 0,
      setupTurn: chain?.setupTurn ?? null,
      payoffTurn: chain?.payoffTurn ?? null,
    },
    cards: watchedPlays(run.trace, run.cards),
  };
}

const cardsIn = (state: RulesState) =>
  new Map(
    Object.values(state.zones)
      .flat()
      .map((i) => [i.uid, i.card] as const),
  );

export interface AnalysisDeckInput {
  id: string;
  label: string;
  source: "player" | "fablazing";
  sides?: number;
  deck: RulesCard[];
  weapons: RulesCard[];
  equipment: RulesCard[];
  coverage: {
    modelled: number;
    total: number;
    unmodelled: string[];
  };
}

export interface FullAnalysisInput {
  kind: "full-analysis";
  decks: AnalysisDeckInput[];
  runs: number;
  seed: number;
  turns: number;
}

export interface AnalysisRow {
  id: string;
  label: string;
  source: AnalysisDeckInput["source"];
  sides?: number;
  coverage: AnalysisDeckInput["coverage"];
  /** Each card name in the deck once, so a question about a card knows who plays it. */
  cardNames: string[];
  runs: ProfileRun[];
}

export interface FullAnalysisOutput {
  rows: AnalysisRow[];
  runs: number;
  seed: number;
  turns: number;
  policy: "reviewed-delayed-hands-v2";
}

/** The same four explicit Cull and Scar answers used by the T5 investigation. */
export function analysisCases(runs: number, seed: number) {
  const answers = [
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ] as const;
  return answers
    .map(([lostLife, lessLife], index) => ({
      runs:
        Math.floor(runs / answers.length) +
        (index < runs % answers.length ? 1 : 0),
      seed: seed + index * 1_000_003,
      choices: {
        conditions: {
          hero_lost_life_this_turn: lostLife,
          less_life_than_opposing_hero: lessLife,
        },
      },
    }))
    .filter((item) => item.runs > 0);
}

export function runFullAnalysis(input: FullAnalysisInput): FullAnalysisOutput {
  return {
    rows: input.decks.map((deck) => {
      const runs = analysisCases(input.runs, input.seed).flatMap((item) => {
        const played: { trace: RulesEvent[]; cards: Map<string, RulesCard> }[] =
          [];
        const report = runGateWeaponBatch(
          {
            deck: deck.deck,
            weapons: deck.weapons,
            equipment: deck.equipment,
            side: "forsaken",
            triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
          },
          {
            ...item,
            turns: input.turns,
            mode: "both",
            startingLife: 40,
            decisions: { traverseBack: true },
            measureBslGateBloodDebt: true,
            onRun: (run) =>
              played.push({ trace: run.trace, cards: cardsIn(run.state) }),
          },
        );
        return report.perRun.map((summary, i) =>
          profileRun(summary, played[i]),
        );
      });
      return {
        id: deck.id,
        label: deck.label,
        source: deck.source,
        ...(deck.sides === undefined ? {} : { sides: deck.sides }),
        coverage: deck.coverage,
        cardNames: [...new Set(deck.deck.map((card) => card.name))],
        runs,
      };
    }),
    runs: input.runs,
    seed: input.seed,
    turns: input.turns,
    policy: "reviewed-delayed-hands-v2",
  };
}

const Z = 1.96;

/** A's mean minus B's over paired games, with a 95% interval. No pairs: no winner. */
export function pairedMeanDifference(a: number[], b: number[]): Difference {
  const n = a.length;
  if (n !== b.length) throw new Error("Paired runs must line up.");
  if (n === 0) return { difference: 0, low: -Infinity, high: Infinity };
  const diffs = a.map((x, i) => x - b[i]!);
  const difference = diffs.reduce((t, d) => t + d, 0) / n;
  const variance =
    n > 1
      ? diffs.reduce((t, d) => t + (d - difference) ** 2, 0) / (n - 1)
      : Infinity;
  const se = Math.sqrt(variance / n);
  return { difference, low: difference - Z * se, high: difference + Z * se };
}

/** "Common 60-card list A" reads as "list A"; "Common 70-card list" as "the 70-card list". */
function named(label: string): string {
  const short = label.replace(/^Common /, "");
  const lettered = /\blist ([A-Z])$/.exec(short);
  return lettered ? "list " + lettered[1] : "the " + short;
}

const joinNames = (names: string[], last: string) =>
  names.length < 2
    ? names.join("")
    : names.slice(0, -1).join(", ") + " " + last + " " + names.at(-1);

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** Which lists this deck differs from, in words, with each list's own figure. */
export function comparisonSentence(
  items: { label: string; verdict: DifferenceVerdict; value: string }[],
): string {
  const group = (verdict: DifferenceVerdict) =>
    items
      .filter((item) => item.verdict === verdict)
      .map((item) => named(item.label) + " (" + item.value + ")");
  const sentences = [
    ["higher", "Higher than", "and"],
    ["lower", "Lower than", "and"],
    ["no clear difference", "No clear difference from", "or"],
  ] as const;
  return sentences
    .flatMap(([verdict, opening, last]) => {
      const names = group(verdict);
      return names.length ? [opening + " " + joinNames(names, last) + "."] : [];
    })
    .join(" ");
}

type Measure =
  | { kind: "share"; hit: (run: ProfileRun, turn: number) => boolean }
  | { kind: "mean"; value: (run: ProfileRun, turn: number) => number };

export interface ListDifference {
  label: string;
  pairs: number;
  difference: Difference;
  verdict: DifferenceVerdict;
}

export interface Answer {
  id: string;
  question: string;
  answer: string;
  comparison: string;
  notes: string[];
  differences: ListDifference[];
  numbers: {
    caption: string;
    kind: Measure["kind"];
    rows: { label: string; values: (number | null)[] }[];
  };
}

const by = (turn: number | null, limit: number) =>
  turn !== null && turn <= limit;

const damageBy = (run: ProfileRun, turn: number) =>
  run.damage[Math.min(turn, run.damage.length) - 1] ?? 0;

const pct = (share: number) => String(Math.round(share * 100)) + "%";
const amount = (mean: number) => String(Math.round(mean * 10) / 10);

function measured(runs: ProfileRun[], measure: Measure, turn: number) {
  const done = runs.filter((run) => run.completed);
  if (!done.length) return null;
  return measure.kind === "share"
    ? done.filter((run) => measure.hit(run, turn)).length / done.length
    : done.reduce((t, run) => t + measure.value(run, turn), 0) / done.length;
}

function compare(
  player: AnalysisRow,
  list: AnalysisRow,
  measure: Measure,
  turn: number,
): ListDifference {
  const pairs = player.runs.flatMap((run, i) => {
    const other = list.runs[i];
    return run.completed && other?.completed ? [[run, other] as const] : [];
  });
  let difference: Difference;
  if (measure.kind === "share") {
    difference = pairs.length
      ? pairedDifference(
          pairOutcomes(
            pairs.map(([a]) => measure.hit(a, turn)),
            pairs.map(([, b]) => measure.hit(b, turn)),
          ),
        )
      : { difference: 0, low: -1, high: 1 };
  } else
    difference = pairedMeanDifference(
      pairs.map(([a]) => measure.value(a, turn)),
      pairs.map(([, b]) => measure.value(b, turn)),
    );
  return {
    label: list.label,
    pairs: pairs.length,
    difference,
    verdict: differenceVerdict(difference),
  };
}

export interface Question {
  id: string;
  question: string;
  caption: string;
  measure: Measure;
  card?: string;
}

/** The questions, stated before anything runs. Card questions only for cards the deck plays. */
export function questions(turn: number, cardNames: string[]): Question[] {
  const list: Question[] = [
    {
      id: "damage",
      question: `How much damage does this deck threaten by turn ${turn}?`,
      caption: "Damage threatened, by turn",
      measure: { kind: "mean", value: damageBy },
    },
    {
      id: "gate",
      question: `How often has it made a Gate by turn ${turn}?`,
      caption: "Gate made, by turn",
      measure: { kind: "share", hit: (run, t) => by(run.gateTurn, t) },
    },
    {
      id: "usurper",
      question: `How often has Viserai become the Usurper by turn ${turn}?`,
      caption: "Usurper, by turn",
      measure: { kind: "share", hit: (run, t) => by(run.usurperTurn, t) },
    },
    {
      id: "chain",
      question: `How often do Become the Shadow Lord, a Gate and a blood debt card come together by turn ${turn}?`,
      caption: "Become the Shadow Lord, Gate and blood debt, by turn",
      measure: {
        kind: "share",
        hit: (run, t) => by(run.chain.payoffTurn, t),
      },
    },
  ];
  for (const card of WATCHED_CARDS.filter((name) => cardNames.includes(name)))
    list.push({
      id: "card:" + card,
      card,
      question:
        card === USURP_THE_SHADOW_THRONE
          ? `How often does it play ${card} at the reduced cost by turn ${turn}?`
          : `How often does it play ${card} by turn ${turn}?`,
      caption: card + " played, by turn",
      measure: {
        kind: "share",
        hit: (run, t) => by(run.cards[card]?.turn ?? null, t),
      },
    });
  return list;
}

const STOPS = [
  "never play Become the Shadow Lord (blue)",
  "play Become the Shadow Lord but make no Gate within two turns",
  "make a Gate but play no blood debt card that turn",
];

function chainNotes(
  runs: ProfileRun[],
  turns: number,
  observed: { completed: number; byDelay: [number, number, number] },
): string[] {
  const done = runs.filter((run) => run.completed);
  const notes: string[] = [];
  const stops = [0, 1, 2].map(
    (reached) => done.filter((run) => run.chain.reached === reached).length,
  );
  const most = stops.indexOf(Math.max(...stops));
  if (done.length && stops[most]! > 0)
    notes.push(
      `Most games without it ${STOPS[most]}: ${pct(stops[most]! / done.length)} of games by turn ${turns}.`,
    );
  const chains = done.filter((run) => run.chain.payoffTurn !== null);
  const sameTurn = chains.filter(
    (run) => run.chain.payoffTurn === run.chain.setupTurn,
  ).length;
  const real = observed.byDelay[0] / observed.completed;
  const { low, high } = wilson(observed.byDelay[0], observed.completed);
  notes.push(
    (chains.length
      ? `When it happens here, all three land in one turn ${pct(sameTurn / chains.length)} of the time. `
      : "") +
      `In real games it's ${pct(real)} (${Math.round(low * 100)}–${Math.round(high * 100)}%), so treat this speed as a best case.`,
  );
  return notes;
}

export function answerQuestions(
  output: FullAnalysisOutput,
  turn: number,
  observed: { completed: number; byDelay: [number, number, number] },
): Answer[] {
  const player = output.rows.find((row) => row.source === "player");
  if (!player) return [];
  const lists = output.rows.filter((row) => row.source !== "player");
  return questions(turn, player.cardNames).map((q) => {
    const value = measured(player.runs, q.measure, turn) ?? 0;
    const format = q.measure.kind === "share" ? pct : amount;
    const playing = q.card
      ? lists.filter((list) => list.cardNames.includes(q.card!))
      : lists;
    const differences = playing.map((list) =>
      compare(player, list, q.measure, turn),
    );
    let comparison = comparisonSentence(
      differences.map((d, i) => ({
        label: d.label,
        verdict: d.verdict,
        value: format(measured(playing[i]!.runs, q.measure, turn) ?? 0),
      })),
    );
    if (q.card) {
      const absent = lists.filter((list) => !playing.includes(list));
      if (!playing.length) comparison = "None of the common lists play it.";
      else if (absent.length)
        comparison +=
          " " +
          capitalise(
            joinNames(
              absent.map((list) => named(list.label)),
              "and",
            ),
          ) +
          (absent.length > 1 ? " don't" : " doesn't") +
          " play it.";
    }

    let answer = `In ${pct(value)} of games.`;
    const notes: string[] = [];
    if (q.id === "damage")
      answer = `${amount(value)} on average: attacks, usurps and Runechant damage, with nothing blocked.`;
    if (q.id === "chain")
      notes.push(...chainNotes(player.runs, output.turns, observed));
    if (q.card === USURP_THE_SHADOW_THRONE)
      notes.push(
        "The reduced cost is after a usurp that turn: it costs 6 less and can be played from banish.",
      );
    if (q.card && RUNE_GATE_CARDS.includes(q.card)) {
      const played = player.runs.filter(
        (run) => run.completed && by(run.cards[q.card!]?.turn ?? null, turn),
      );
      const banished = played.filter(
        (run) => run.cards[q.card!]!.fromBanish,
      ).length;
      if (played.length)
        answer = `In ${pct(value)} of games, ${pct(banished / played.length)} of them from banish through a Gate.`;
      notes.push(
        "The engine doesn't model Rune Gate yet, so these games pay its full cost.",
      );
    }
    return {
      id: q.id,
      question: q.question,
      answer,
      comparison,
      notes,
      differences,
      numbers: {
        caption: q.caption,
        kind: q.measure.kind,
        rows: (q.card ? [player, ...playing] : [player, ...lists]).map(
          (row) => ({
            label: row.label,
            values: Array.from({ length: output.turns }, (_, t) =>
              measured(row.runs, q.measure, t + 1),
            ),
          }),
        ),
      },
    };
  });
}
