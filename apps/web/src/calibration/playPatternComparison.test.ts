import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  RUNECHANT,
  type BatchSetup,
  type RulesCard,
  type Script,
} from "@esweby/fab-engine/rules";
import {
  comparePlayPatterns,
  priorityPatterns,
} from "./playPatternComparison.ts";

const card = (name: string, overrides: Partial<RulesCard> = {}): RulesCard => ({
  id: name,
  name,
  pitch: 3,
  type: "action",
  cost: 0,
  power: null,
  goAgain: false,
  traits: [],
  roles: [],
  amounts: {},
  effects: [],
  ...overrides,
});
const setup = (): BatchSetup => ({
  deck: Array.from({ length: 20 }, (_, index) =>
    card(`Card ${index}`, { type: "attack_action", cost: 1, power: 4 }),
  ),
  triggers: [RUNECHANT],
});
const script: Script = {
  version: 1,
  steps: [{ do: "play", card: {} }, { do: "endTurn" }],
};
const request = () => ({
  seeds: [17, 23],
  turns: 1,
  startingLife: 40,
  traverseBack: false,
  conditions: {
    hero_lost_life_this_turn: false,
    less_life_than_opposing_hero: false,
  },
  patterns: [
    { id: "first", label: "First", kind: "script", script },
    { id: "second", label: "Second", kind: "script", script },
  ],
});

describe("same-seed play-pattern comparison", () => {
  it("runs each listed pattern on identical initial cards without mutating inputs", () => {
    const deck = setup(),
      options = request();
    const before = structuredClone({ deck, options });
    const report = comparePlayPatterns(deck, options);
    expect(report.coverage).toEqual({
      exhaustive: false,
      patterns: 2,
      seeds: 2,
    });
    expect(report.cases.map((row) => row.seed)).toEqual([17, 23]);
    for (const row of report.cases) {
      expect(row.patterns[0]!.turns).toEqual(row.patterns[1]!.turns);
      expect(row.patterns[0]!.final).toEqual(row.patterns[1]!.final);
      expect(
        row.patterns.every((pattern) => pattern.status === "completed"),
      ).toBe(true);
      expect(row.initialHand).toHaveLength(4);
    }
    expect({ deck, options }).toEqual(before);
    expect(comparePlayPatterns(deck, options)).toEqual(report);
  });

  it("records actual pitches, printed threat and held cards before refill", () => {
    const report = comparePlayPatterns(setup(), request());
    const turn = report.cases[0]!.patterns[0]!.turns[0]!;
    expect(turn.threatened).toBe(4);
    expect(turn.arcane).toBe(0);
    expect(turn.lifeLost).toBe(0);
    expect(turn.gatesActivated).toBe(0);
    expect(turn.held).toHaveLength(2);
    expect(turn.refilledHand).toHaveLength(4);
    expect(turn.floatingBeforeEnd).toBe(2);
    expect(turn.actions.map((action) => action.type)).toEqual([
      "pitch",
      "play",
    ]);
    expect(turn.tokens).toEqual({});
    expect(report.inputs.label).toBe("Assumed");
    expect(report.inputs.rulesDataVersion).toMatch(/^[a-f0-9]{8}$/);
    expect(
      report.cases[0]!.patterns[0]!.steps.every(
        (step) => step.outcome === "done",
      ),
    ).toBe(true);
  });

  it("separates usurp threat, arcane, Gate spending and end-phase blood debt", () => {
    const deck: BatchSetup = {
      order: "asGiven",
      triggers: [RUNECHANT, BLOOD_DEBT],
      deck: [
        card("Setup", {
          goAgain: true,
          effects: [
            { op: "createToken", token: "gate", amount: 1 },
            { op: "createToken", token: "runechant", amount: 2 },
            { op: "banish", from: "deckTop", amount: 2 },
          ],
        }),
        card("Fuel", { type: "resource" }),
        card("Held"),
        card("Held again"),
        card("Banish attack", {
          type: "attack_action",
          cost: 1,
          power: 6,
          usurp: true,
          traits: ["blood_debt"],
        }),
        card("Debt", { traits: ["blood_debt"] }),
        ...setup().deck,
      ],
    };
    const options = request();
    options.patterns[0]!.script = {
      version: 1,
      steps: [
        { do: "play", card: { name: "Setup" } },
        { do: "pitch", card: { name: "Fuel" } },
        { do: "activateGate", target: { name: "Banish attack" } },
        { do: "play", from: "banished", card: { name: "Banish attack" } },
        { do: "endTurn" },
      ],
    };
    const turn = comparePlayPatterns(deck, options).cases[0]!.patterns[0]!
      .turns[0]!;
    expect(turn).toMatchObject({
      threatened: 8,
      arcane: 1,
      selfLoss: 1,
      lifeLost: 1,
      gatesActivated: 1,
      runechantsMade: 2,
      floatingBeforeEnd: 1,
      tokens: { gate: 0, runechant: 0 },
    });
    expect(turn.actions.map((action) => action.type)).toEqual([
      "play",
      "pitch",
      "gate",
      "play",
    ]);
  });

  it("shows an explicit keep priority trading immediate play for a held starter", () => {
    const options = request();
    options.patterns[1]!.script = { version: 1, steps: [{ do: "endTurn" }] };
    const row = comparePlayPatterns(setup(), options).cases[0]!;
    expect(row.patterns[0]!.turns[0]!.threatened).toBe(4);
    expect(row.patterns[1]!.turns[0]!.threatened).toBe(0);
    expect(row.patterns[1]!.turns[0]!.held).toHaveLength(4);
  });

  it("compares an explicit cheaper pitch without spending a kept starter", () => {
    const deck = setup();
    deck.order = "asGiven";
    deck.deck[1] = card("Red spare", {
      pitch: 1,
      type: "resource",
      cost: null,
    });
    deck.deck[2] = card("Another red", {
      pitch: 1,
      type: "resource",
      cost: null,
    });
    deck.deck[3] = card("Starter", { type: "resource", cost: null });
    const options = request();
    options.patterns[1]!.script = {
      version: 1,
      choices: { keep: [{ name: "Starter" }] },
      steps: [
        { do: "pitch", card: { name: "Red spare" } },
        { do: "play", card: { name: "Card 0" } },
        { do: "endTurn" },
      ],
    };
    const results = comparePlayPatterns(deck, options).cases[0]!.patterns;
    expect(results[0]!.turns[0]!.actions[0]!.card.name).toBe("Starter");
    expect(results[1]!.turns[0]!.actions[0]!.card.name).toBe("Red spare");
    expect(results[0]!.turns[0]!.threatened).toBe(
      results[1]!.turns[0]!.threatened,
    );
    expect(
      results[1]!.turns[0]!.held.some((fact) => fact.name === "Starter"),
    ).toBe(true);
    expect(results[1]!.turns[0]!.floatingBeforeEnd).toBe(0);
  });

  it("does not count a stopped script as a completed turn or invent an end phase", () => {
    const options = request();
    options.patterns[0]!.script = { version: 1, steps: [{ do: "stop" }] };
    const result = comparePlayPatterns(setup(), options).cases[0]!.patterns;
    expect(result[0]!.status).toBe("incomplete");
    expect(result[0]!.turns).toEqual([]);
    expect(result[1]!.status).toBe("completed");
  });

  it("keeps failed trigger-budget runs apart from successful patterns", () => {
    const deck = setup();
    deck.budget = 1;
    deck.triggers = [
      {
        id: "loop",
        on: { event: "tokensCreated", token: "loop" },
        effects: [{ op: "createToken", token: "loop", amount: 1 }],
      },
    ];
    deck.deck = deck.deck.map((fact) => ({
      ...fact,
      effects: [{ op: "createToken", token: "loop", amount: 1 }],
    }));
    const options = request();
    options.patterns[1]!.script = { version: 1, steps: [{ do: "endTurn" }] };
    const result = comparePlayPatterns(deck, options).cases[0]!.patterns;
    expect(result[0]!.status).toBe("failed");
    expect(result[0]!.failure).toMatch(/triggers.*one action/i);
    expect(result[1]!.status).toBe("completed");
  });

  it("records illegal steps as skipped rather than treating their threat as dealt", () => {
    const options = request();
    options.patterns[0]!.script = {
      version: 1,
      steps: [{ do: "play", card: { name: "Absent" } }, { do: "endTurn" }],
    };
    const result = comparePlayPatterns(setup(), options).cases[0]!.patterns[0]!;
    expect(result.steps[0]!.outcome).toBe("skipped");
    expect(result.turns[0]!.threatened).toBe(0);
  });

  it("supplies common opponent assumptions and return choices to every pattern", () => {
    const report = comparePlayPatterns(setup(), request());
    for (const pattern of report.inputs.patterns) {
      expect(pattern.kind).toBe("script");
      if (pattern.kind === "script") {
        expect(pattern.script.choices?.conditions).toEqual(
          request().conditions,
        );
        expect(
          pattern.script.choices?.optional?.["viserai-usurper-traverse"],
        ).toBe(false);
      }
    }
  });

  it("compares existing Gate policies without claiming their priorities are optimal", () => {
    const options = { ...request(), patterns: priorityPatterns() };
    const report = comparePlayPatterns(setup(), options);
    expect(report.inputs.patterns.map((pattern) => pattern.id)).toEqual([
      "current",
      "keep-bsl",
      "no-auto-sword",
      "keep-bsl-no-auto-sword",
      "no-extra-life",
    ]);
    expect(report.cases[0]!.patterns).toHaveLength(5);
    expect(report.inputs.strategy).toMatch(/UNVERIFIED/);
  });

  it("does not choose a winner or expose the hidden shuffle in its report", () => {
    const report = comparePlayPatterns(setup(), request());
    expect(report).not.toHaveProperty("winner");
    expect(report.cases[0]).not.toHaveProperty("deck");
    expect(report.cases[0]!.patterns[0]!.final).not.toHaveProperty("deck");
  });

  it("bounds expanded custom scripts rather than silently cutting off their branches", () => {
    const options = request();
    options.patterns[0]!.script = {
      version: 1,
      steps: [
        {
          do: "repeat",
          times: 10,
          steps: [
            {
              do: "repeat",
              times: 10,
              steps: [
                {
                  do: "repeat",
                  times: 10,
                  steps: [{ do: "repeat", times: 10, steps: [{ do: "stop" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() => comparePlayPatterns(setup(), options)).toThrow(/5000|limit/i);
  });

  it.each([
    { seeds: [] },
    { seeds: [17, 17] },
    { seeds: [-1] },
    { seeds: [1.5] },
    { seeds: [2 ** 31] },
    { turns: 0 },
    { turns: 21 },
    { patterns: [] },
    { startingLife: 0 },
    { conditions: undefined },
    { traverseBack: undefined },
    { patterns: [request().patterns[0], request().patterns[0]] },
    {
      patterns: [
        {
          ...request().patterns[0],
          script: { version: 1, steps: [{ do: "invent" }] },
        },
      ],
    },
    {
      patterns: [
        { id: "bad", label: "Bad", kind: "gate", decisions: { unknown: true } },
      ],
    },
    {
      patterns: [
        {
          ...request().patterns[0],
          script: {
            ...script,
            choices: { conditions: { hero_lost_life_this_turn: true } },
          },
        },
      ],
    },
  ])("rejects invalid or conflicting inputs before running: %j", (change) => {
    expect(() =>
      comparePlayPatterns(setup(), { ...request(), ...change }),
    ).toThrow();
  });
});
