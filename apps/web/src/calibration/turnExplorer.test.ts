import { describe, expect, it } from "vitest";
import {
  applySessionAction,
  BLOOD_DEBT,
  cardWithRules,
  RUNECHANT,
  setUp,
  VISERAI,
  type RulesCard,
  type RulesState,
} from "@vdb/engine/rules";
import { exploreTurn } from "./turnExplorer.ts";

const fact = (name: string, overrides: Partial<RulesCard> = {}): RulesCard => ({
  id: name,
  name,
  pitch: 3,
  cost: 0,
  type: "action",
  power: null,
  goAgain: false,
  traits: [],
  roles: [],
  amounts: {},
  effects: [],
  ...overrides,
});
const resource = (name: string) => fact(name, { type: "resource", cost: null });
const position = (
  cards: RulesCard[] = [
    fact("Attack", { type: "attack_action", cost: 1, power: 4 }),
    resource("Blue"),
    resource("Other blue"),
    resource("Last blue"),
  ],
): RulesState =>
  setUp({
    deck: [
      ...cards,
      ...Array.from({ length: 12 }, (_, index) => resource(`Filler ${index}`)),
    ],
    seed: 17,
    order: "asGiven",
    triggers: [RUNECHANT, BLOOD_DEBT],
  });
const request = (change = {}) => ({
  startingLife: 40,
  conditions: {
    hero_lost_life_this_turn: false,
    less_life_than_opposing_hero: false,
  },
  traverseBack: false,
  includeArsenal: false,
  limits: {
    maxDepth: 6,
    maxStates: 1000,
    maxAttempts: 10000,
    maxChoiceBranches: 64,
  },
  ...change,
});

describe("bounded one-turn exploration", () => {
  it("finds pitch/play alternatives and stopping without changing the input", () => {
    const initial = position(),
      before = structuredClone(initial);
    const report = exploreTurn(initial, request());
    expect(report.lines.length).toBeGreaterThan(1);
    expect(report.coverage.exhaustive).toBe(false);
    expect(report.coverage.completeWithinScope).toBe(true);
    expect(
      report.lines.some(
        (line) =>
          line.actions.length === 1 && line.actions[0]!.type === "endTurn",
      ),
    ).toBe(true);
    expect(
      report.lines.some((line) =>
        line.actions.some((action) => action.type === "play"),
      ),
    ).toBe(true);
    for (const line of report.lines) {
      const replay = line.actions.reduce(
        applySessionAction,
        structuredClone(initial),
      );
      expect(replay.zones.hand.map((instance) => instance.uid)).toEqual(
        line.final.hand.map((instance) => instance.uid),
      );
      expect(line.turn).toBeDefined();
    }
    expect(initial).toEqual(before);
    expect(exploreTurn(initial, request())).toEqual(report);
  });

  it("keeps explicit pitches separate instead of automatically paying for plays", () => {
    const report = exploreTurn(position(), request());
    const played = report.lines.filter((line) =>
      line.actions.some((action) => action.type === "play"),
    );
    expect(
      played.every(
        (line) =>
          line.actions.findIndex((action) => action.type === "pitch") <
          line.actions.findIndex((action) => action.type === "play"),
      ),
    ).toBe(true);
    expect(
      new Set(
        played.flatMap((line) =>
          line.actions
            .filter((action) => action.type === "pitch")
            .map((action) => action.uid),
        ),
      ).size,
    ).toBe(3);
  });

  it("enumerates life-payment answers without calling the most damaging one best", () => {
    const initial = position([
      fact("Battery", {
        effects: [{ op: "payLifeForToken", token: "runechant", maximum: 3 }],
      }),
    ]);
    const report = exploreTurn(
      initial,
      request({
        limits: {
          maxDepth: 2,
          maxStates: 100,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    const played = report.lines.filter(
      (line) => line.actions[0]?.type === "play",
    );
    expect(
      [...new Set(played.map((line) => line.turn.selfLoss))].sort(),
    ).toEqual([0, 1, 2, 3]);
    expect(report).not.toHaveProperty("winner");
  });

  it("protects Shard from chosen hand-banishes but still allows pitching it", () => {
    const initial = position([
      fact("Banish", { effects: [{ op: "banish", from: "hand", amount: 1 }] }),
      resource("Arknight Shard"),
      resource("Spare"),
      resource("Other"),
    ]);
    const report = exploreTurn(
      initial,
      request({
        limits: {
          maxDepth: 2,
          maxStates: 200,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    const played = report.lines.filter(
      (line) => line.actions[0]?.type === "play",
    );
    expect(played.length).toBeGreaterThan(0);
    expect(
      played.every((line) => !line.actions[0]!.answers?.flat().includes("d1")),
    ).toBe(true);
    expect(
      report.lines.some(
        (line) =>
          line.actions[0]?.type === "pitch" && line.actions[0].uid === "d1",
      ),
    ).toBe(true);
  });

  it("enumerates ordered multi-card choices rather than dropping banish orders", () => {
    const initial = position([
      fact("Banish", { effects: [{ op: "banish", from: "hand", amount: 2 }] }),
      resource("One"),
      resource("Two"),
      resource("Three"),
    ]);
    const report = exploreTurn(
      initial,
      request({
        limits: {
          maxDepth: 2,
          maxStates: 100,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    const played = report.lines.filter(
      (line) => line.actions[0]?.type === "play",
    );
    expect(
      new Set(played.map((line) => JSON.stringify(line.actions[0]!.answers)))
        .size,
    ).toBe(6);
  });

  it.each(["maxStates", "maxAttempts", "maxChoiceBranches"])(
    "discloses a reached %s limit",
    (limit) => {
      const initial = position([
        fact("Battery", {
          effects: [{ op: "payLifeForToken", token: "runechant", maximum: 3 }],
        }),
        resource("Blue"),
      ]);
      const report = exploreTurn(
        initial,
        request({
          limits: {
            maxDepth: 3,
            maxStates: 100,
            maxAttempts: 1000,
            maxChoiceBranches: 64,
            [limit]: 1,
          },
        }),
      );
      expect(report.coverage.completeWithinScope).toBe(false);
      expect(report.frontier.length).toBeGreaterThan(0);
      if (limit === "maxStates")
        expect(report.counts.states).toBeLessThanOrEqual(1);
      if (limit === "maxAttempts")
        expect(report.counts.attempts).toBeLessThanOrEqual(1);
    },
  );

  it("marks unfinished depth-limited prefixes rather than inventing end phases", () => {
    const report = exploreTurn(
      position(),
      request({
        limits: {
          maxDepth: 1,
          maxStates: 100,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    expect(report.frontier.some((node) => node.reason === "depth-limit")).toBe(
      true,
    );
    expect(
      report.lines.every((line) => line.actions.at(-1)?.type === "endTurn"),
    ).toBe(true);
  });

  it("respects a kept card for pitches, plays and hand choices", () => {
    const report = exploreTurn(
      position(),
      request({ keep: [{ name: "Blue" }] }),
    );
    expect(
      report.lines.every((line) =>
        line.actions.every(
          (action) => !("uid" in action && action.uid === "d1"),
        ),
      ),
    ).toBe(true);
  });

  it("separates budget failures from legal completed turns", () => {
    const initial = position([
      fact("Loop", {
        effects: [{ op: "createToken", token: "loop", amount: 1 }],
      }),
    ]);
    initial.budget = 1;
    initial.triggers = [
      {
        id: "loop",
        on: { event: "tokensCreated", token: "loop" },
        effects: [{ op: "createToken", token: "loop", amount: 1 }],
      },
    ];
    const report = exploreTurn(
      initial,
      request({
        limits: {
          maxDepth: 2,
          maxStates: 100,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    expect(
      report.failures.some((failure) => failure.kind === "trigger-budget"),
    ).toBe(true);
    expect(report.coverage.completeWithinScope).toBe(false);
    expect(report.lines.some((line) => line.actions.length === 1)).toBe(true);
  });

  it("finds both the equal-blue sword lines in the reviewed modelled position", () => {
    const initial = position([
      resource("Become the Shadow Lord"),
      resource("Murmuring Gloomblade"),
    ]);
    const target = initial.zones.deck.shift()!;
    target.card = cardWithRules(
      fact("Arknight Descendancy", {
        pitch: 3,
        cost: 5,
        type: "attack_action",
        power: 6,
        traits: ["blood_debt", "shadow", "runeblade"],
      }),
    );
    initial.zones.banished.push(target);
    initial.zones.weapons = [
      {
        uid: "w0",
        card: cardWithRules(
          fact("Seven Sin Nebula", {
            type: "weapon",
            pitch: null,
            cost: null,
            power: 3,
          }),
        ),
      },
    ];
    initial.side = "usurper";
    initial.tokens = { gate: 1, runechant: 5 };
    initial.triggers = [...VISERAI, RUNECHANT, BLOOD_DEBT];
    const report = exploreTurn(
      initial,
      request({
        limits: {
          maxDepth: 5,
          maxStates: 1000,
          maxAttempts: 10000,
          maxChoiceBranches: 64,
        },
      }),
    );
    const swords = report.lines.filter((line) =>
      line.actions.some((action) => action.type === "weaponAttack"),
    );
    expect(
      swords.some(
        (line) =>
          line.actions[0]?.type === "pitch" && line.actions[0].uid === "d0",
      ),
    ).toBe(true);
    expect(
      swords.some(
        (line) =>
          line.actions[0]?.type === "pitch" && line.actions[0].uid === "d1",
      ),
    ).toBe(true);
    expect(
      swords.some(
        (line) => line.turn.threatened === 9 && line.turn.arcane === 5,
      ),
    ).toBe(true);
  });

  it("only includes arsenal and activated abilities when explicitly enabled", () => {
    const initial = position([]);
    initial.zones.equipment = [
      {
        uid: "e0",
        card: fact("Equipment", {
          type: "equipment",
          activate: {
            speed: "action",
            cost: 0,
            pay: "destroy",
            effects: [{ op: "gainResources", amount: 1 }],
          },
        }),
      },
    ];
    const without = exploreTurn(initial, request());
    expect(
      without.lines
        .flatMap((line) => line.actions)
        .some((action) => action.type === "activate"),
    ).toBe(false);
    const included = exploreTurn(initial, request({ includeAbilities: true }));
    expect(
      included.lines
        .flatMap((line) => line.actions)
        .some((action) => action.type === "activate"),
    ).toBe(true);
    const arsenal = exploreTurn(
      position(),
      request({
        includeArsenal: true,
        limits: {
          maxDepth: 1,
          maxStates: 100,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    expect(
      arsenal.lines.some(
        (line) =>
          line.actions[0]?.type === "endTurn" && line.actions[0].arsenal,
      ),
    ).toBe(true);
  });

  it("does not probe abilities on hidden deck cards", () => {
    const initial = position(),
      changed = structuredClone(initial);
    changed.zones.deck.at(-1)!.card.activate = {
      speed: "action",
      cost: 0,
      pay: "none",
      effects: [],
    };
    const options = request({
      includeAbilities: true,
      limits: {
        maxDepth: 1,
        maxStates: 100,
        maxAttempts: 1000,
        maxChoiceBranches: 64,
      },
    });
    expect(exploreTurn(changed, options).counts.attempts).toBe(
      exploreTurn(initial, options).counts.attempts,
    );
  });

  it("accounts for activated-ability costs and resources in the turn summary", () => {
    const initial = position();
    initial.resources = 2;
    initial.zones.equipment = [
      {
        uid: "e0",
        card: fact("Paid equipment", {
          type: "equipment",
          activate: {
            speed: "action",
            cost: 2,
            pay: "destroy",
            effects: [{ op: "gainResources", amount: 1 }],
          },
        }),
      },
    ];
    const report = exploreTurn(
      initial,
      request({
        includeAbilities: true,
        limits: {
          maxDepth: 2,
          maxStates: 200,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    const line = report.lines.find(
      (line) => line.actions[0]?.type === "activate",
    )!;
    expect(line.turn.floatingBeforeEnd).toBe(1);
    expect(line.turn.actions.some((action) => action.type === "activate")).toBe(
      true,
    );
  });

  it("branches on an offered traverse, but does not invent a traverse when it is unavailable", () => {
    const initial = position();
    initial.side = "usurper";
    initial.createdThisTurn.gate = 1;
    initial.triggers = [...VISERAI, RUNECHANT, BLOOD_DEBT];
    const options = request({
      traverseBack: "both",
      limits: {
        maxDepth: 1,
        maxStates: 100,
        maxAttempts: 1000,
        maxChoiceBranches: 64,
      },
    });
    expect(
      new Set(
        exploreTurn(initial, options).lines.map((line) => line.final.side),
      ),
    ).toEqual(new Set(["usurper", "forsaken"]));
    initial.createdThisTurn = {};
    expect(
      exploreTurn(initial, options).lines.every(
        (line) => line.final.side === "usurper",
      ),
    ).toBe(true);
  });

  it("enumerates only the Opt choices the engine actually offers", () => {
    const initial = position([
      fact("Opt", { effects: [{ op: "opt", amount: 2 }] }),
      resource("One"),
      resource("Two"),
      resource("Three"),
    ]);
    const report = exploreTurn(
      initial,
      request({
        limits: {
          maxDepth: 2,
          maxStates: 100,
          maxAttempts: 1000,
          maxChoiceBranches: 64,
        },
      }),
    );
    const played = report.lines.filter(
      (line) => line.actions[0]?.type === "play",
    );
    expect(
      new Set(played.map((line) => JSON.stringify(line.actions[0]!.answers)))
        .size,
    ).toBe(5);
  });

  it.each([
    { startingLife: 0 },
    { conditions: undefined },
    { traverseBack: undefined },
    { limits: { maxDepth: 0 } },
    { limits: { maxStates: 2001 } },
  ])("rejects invalid configuration: %j", (change) => {
    expect(() => exploreTurn(position(), request(change))).toThrow();
  });
});
