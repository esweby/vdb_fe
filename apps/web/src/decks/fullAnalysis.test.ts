import { describe, expect, it } from "vitest";
import type { RulesCard, RulesEvent, RunSummary } from "@vdb/engine/rules";
import {
  analysisCases,
  answerQuestions,
  comparisonSentence,
  pairedMeanDifference,
  profileRun,
  runFullAnalysis,
  watchedPlays,
  type AnalysisRow,
  type ProfileRun,
  HIDDEN_QUESTIONS,
  questions,
} from "./fullAnalysis.ts";

const card = (name: string, cost: number) =>
  ({ name, cost, traits: [], goAgain: false }) as unknown as RulesCard;

const turn = (threatened: number, arcane: number, gateBy = false) => ({
  runechants: 0,
  gateBy,
  onUsurperAtEnd: false,
  lifeLost: 0,
  arcane,
  threatened,
  queries: {},
});

const run = (over: Partial<ProfileRun> = {}): ProfileRun => ({
  completed: true,
  damage: [0, 0, 0, 0],
  gateTurn: null,
  usurperTurn: null,
  chain: { reached: 0, setupTurn: null, payoffTurn: null },
  cards: {},
  ...over,
});

const row = (
  id: string,
  label: string,
  runs: ProfileRun[],
  cardNames: string[] = [],
): AnalysisRow => ({
  id,
  label,
  source: id === "player" ? "player" : "fablazing",
  coverage: { modelled: 1, total: 1, unmodelled: [] },
  cardNames,
  runs,
});

const observed = {
  population: 24_789,
  completed: 6_152,
  byDelay: [2_551, 2_068, 1_533] as [number, number, number],
};

describe("full analysis: each game's measures", () => {
  it("adds up damage threatened and notes the first Gate, Usurper turn and chain", () => {
    const summary: RunSummary = {
      seed: 1,
      completed: true,
      turns: [turn(3, 0), turn(4, 2, true), turn(0, 1, true)],
      gateByTurn: [false, true, true],
      firstTraverseTurn: 3,
      bslGateBloodDebt: {
        reached: 3,
        setupTurn: 2,
        gateTurn: 2,
        payoffTurn: 2,
        delay: 0,
      },
    };

    expect(profileRun(summary, { trace: [], cards: new Map() })).toEqual({
      completed: true,
      damage: [3, 9, 10],
      gateTurn: 2,
      usurperTurn: 3,
      chain: { reached: 3, setupTurn: 2, payoffTurn: 2 },
      cards: {},
    });
  });

  it("keeps a failed game apart, with no measures", () => {
    expect(
      profileRun(
        {
          seed: 1,
          completed: false,
          turns: [],
          gateByTurn: [],
          firstTraverseTurn: null,
        },
        undefined,
      ),
    ).toMatchObject({ completed: false, damage: [] });
  });

  it("records the first play of each watched card, and whether it came from banish", () => {
    const cards = new Map([
      ["d0", card("Widespread Annihilation", 4)],
      ["d1", card("Usurp the Shadow Throne", 13)],
      ["d2", card("Usurp the Shadow Throne", 13)],
      ["d3", card("Deep Recesses of Existence", 4)],
    ]);
    const trace: RulesEvent[] = [
      { type: "turnStarted", turn: 2 },
      { type: "played", uid: "d1", cost: 13 },
      { type: "turnStarted", turn: 3 },
      { type: "playedFromBanish", uid: "d0" },
      { type: "played", uid: "d0", cost: 4 },
      { type: "turnStarted", turn: 4 },
      { type: "played", uid: "d2", cost: 7 },
      { type: "played", uid: "d3", cost: 4 },
    ];

    expect(watchedPlays(trace, cards)).toEqual({
      "Widespread Annihilation": { turn: 3, fromBanish: true },
      // The full-cost play on turn 2 doesn't count: only the reduced cost does.
      "Usurp the Shadow Throne": { turn: 4, fromBanish: false },
      "Deep Recesses of Existence": { turn: 4, fromBanish: false },
    });
  });
});

describe("full analysis: comparisons", () => {
  it("gives a paired mean difference with a 95% interval", () => {
    const d = pairedMeanDifference([10, 12, 14, 16], [9, 10, 12, 13]);
    expect(d.difference).toBe(2);
    expect(d.low).toBeGreaterThan(0.6);
    expect(d.high).toBeLessThan(3.4);
  });

  it("has no winner when there are no pairs", () => {
    expect(pairedMeanDifference([], [])).toEqual({
      difference: 0,
      low: -Infinity,
      high: Infinity,
    });
  });

  it("says which lists differ in words, with each list's figure", () => {
    expect(
      comparisonSentence([
        {
          label: "Common 60-card list A",
          verdict: "no clear difference",
          value: "18%",
        },
        {
          label: "Common 60-card list B",
          verdict: "no clear difference",
          value: "19%",
        },
        { label: "Common 70-card list", verdict: "higher", value: "14%" },
      ]),
    ).toBe(
      "Higher than the 70-card list (14%). No clear difference from list A (18%) or list B (19%).",
    );
    expect(
      comparisonSentence([
        { label: "Common 60-card list A", verdict: "lower", value: "18%" },
      ]),
    ).toBe("Lower than list A (18%).");
  });
});

describe("full analysis: the questions", () => {
  const output = (rows: AnalysisRow[]) => ({
    rows,
    runs: 2,
    seed: 1,
    turns: 4,
    policy: "reviewed-delayed-hands-v2" as const,
  });

  it("leaves out the damage, Gate and Usurper questions by default", () => {
    expect(questions(3, []).map((q) => q.id)).toEqual(["chain"]);
    expect(HIDDEN_QUESTIONS).toEqual(new Set(["damage", "gate", "usurper"]));
  });

  it("states each question for the chosen turn and answers it in a sentence", () => {
    const answers = answerQuestions(
      output([
        row("player", "This deck", [
          run({
            damage: [2, 6, 10, 14],
            gateTurn: 2,
            usurperTurn: 4,
            chain: { reached: 1, setupTurn: 2, payoffTurn: null },
          }),
          run({
            damage: [2, 4, 6, 8],
            chain: { reached: 1, setupTurn: 2, payoffTurn: null },
          }),
        ]),
        row("common-60-a", "Common 60-card list A", [run(), run()]),
      ]),
      3,
      observed,
      new Set(),
    );

    expect(answers.map((a) => a.question)).toEqual([
      "How much damage does this deck threaten by turn 3?",
      "How often has it made a Gate by turn 3?",
      "How often has Viserai become the Usurper by turn 3?",
      "How often do Become the Shadow Lord, a Gate and a blood debt card come together by turn 3?",
    ]);
    expect(answers[0]!.answer).toBe(
      "8 on average: attacks, usurps and Runechant damage, with nothing blocked.",
    );
    expect(answers[0]!.comparison).toBe("Higher than list A (0).");
    expect(answers[1]!.answer).toBe("In 50% of games.");
    expect(answers[2]!.answer).toBe("In 0% of games.");
    expect(answers[3]!.answer).toBe("In 0% of games.");
    expect(answers[3]!.notes.join(" ")).toContain(
      "Most games without it play Become the Shadow Lord but make no Gate within two turns: 100% of games by turn 4.",
    );
    expect(answers[3]!.notes.join(" ")).toMatch(
      /real games it's 41% \(40–43%\)/,
    );
    expect(answers[0]!.numbers.rows[0]).toEqual({
      label: "This deck",
      values: [2, 5, 8, 11],
    });
  });

  it("asks about Usurp the Shadow Throne and the blue Rune Gate cards only when the deck plays them", () => {
    const usurp = "Usurp the Shadow Throne";
    const annihilation = "Widespread Annihilation";
    const answers = answerQuestions(
      output([
        row(
          "player",
          "This deck",
          [
            run({
              cards: {
                [usurp]: { turn: 3, fromBanish: true },
                [annihilation]: { turn: 2, fromBanish: true },
              },
            }),
            run({ cards: { [annihilation]: { turn: 3, fromBanish: false } } }),
          ],
          [usurp, annihilation],
        ),
        row(
          "common-60-a",
          "Common 60-card list A",
          [run(), run()],
          [annihilation],
        ),
        row("common-70", "Common 70-card list", [run(), run()], []),
      ]),
      3,
      observed,
    );

    const usurpAnswer = answers.find((a) => a.id === "card:" + usurp)!;
    expect(usurpAnswer.question).toBe(
      "How often does it play Usurp the Shadow Throne at the reduced cost by turn 3?",
    );
    expect(usurpAnswer.answer).toBe("In 50% of games.");
    expect(usurpAnswer.comparison).toBe("None of the common lists play it.");

    const gate = answers.find((a) => a.id === "card:" + annihilation)!;
    expect(gate.question).toBe(
      "How often does it play Widespread Annihilation by turn 3?",
    );
    expect(gate.answer).toBe(
      "In 100% of games, 50% of them from banish through a Gate.",
    );
    expect(gate.comparison).toBe(
      "Higher than list A (0%). The 70-card list doesn't play it.",
    );
    expect(gate.notes.join(" ")).toMatch(/doesn't model Rune Gate yet/);
    expect(
      answers.some((a) => a.id === "card:Deep Recesses of Existence"),
    ).toBe(false);
  });

  it("pairs only games that both decks finished", () => {
    const answers = answerQuestions(
      output([
        row("player", "This deck", [
          run({ gateTurn: 1 }),
          run({ completed: false }),
        ]),
        row("common-60-a", "Common 60-card list A", [
          run({ completed: false }),
          run(),
        ]),
      ]),
      2,
      observed,
      new Set(),
    );
    expect(answers[1]!.differences[0]).toMatchObject({
      pairs: 0,
      verdict: "no clear difference",
    });
  });
});

describe("full analysis: running it", () => {
  it("shares the run budget across all fixed Cull and Scar answers", () => {
    const cases = analysisCases(1_000, 20_261_027);
    expect(cases).toHaveLength(4);
    expect(cases.reduce((total, item) => total + item.runs, 0)).toBe(1_000);
    expect(new Set(cases.map((item) => item.seed)).size).toBe(4);
    expect(cases.map((item) => item.choices.conditions)).toEqual([
      { hero_lost_life_this_turn: false, less_life_than_opposing_hero: false },
      { hero_lost_life_this_turn: false, less_life_than_opposing_hero: true },
      { hero_lost_life_this_turn: true, less_life_than_opposing_hero: false },
      { hero_lost_life_this_turn: true, less_life_than_opposing_hero: true },
    ]);
  });

  it("runs every case through the reviewed policy and keeps each game's measures", () => {
    const result = runFullAnalysis({
      kind: "full-analysis",
      runs: 4,
      seed: 17,
      turns: 2,
      decks: [
        {
          id: "empty",
          label: "Empty test deck",
          source: "player",
          deck: [card("Widespread Annihilation", 4)],
          weapons: [],
          equipment: [],
          coverage: { modelled: 0, total: 0, unmodelled: [] },
        },
      ],
    });

    expect(result.rows[0]!.runs).toHaveLength(4);
    expect(result.rows[0]!.cardNames).toEqual(["Widespread Annihilation"]);
    expect(result.rows[0]!.runs.every((r) => r.completed)).toBe(true);
  });
});
