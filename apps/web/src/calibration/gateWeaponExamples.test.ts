// Maintainer-approved exact selections; registered card rules establish legality.
import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  cardWithRules,
  checkInvariants,
  parseScript,
  playCard,
  RUNECHANT,
  runScriptFromState,
  setUp,
  VISERAI,
  type RulesCard,
  type RulesState,
} from "@vdb/engine/rules";
import { GATE_WEAPON_EXAMPLES } from "./gateWeaponExamples.ts";
import * as examples from "./gateWeaponExamples.ts";
import * as selection from "./gateWeaponSelection.ts";

const fact = (name: string, over: Partial<RulesCard> = {}): RulesCard =>
  cardWithRules({
    id: name,
    name,
    pitch: 3,
    type: "action",
    cost: 0,
    goAgain: false,
    roles: [],
    traits: [],
    amounts: {},
    ...over,
  });
const descendant = () =>
  fact("Arknight Descendancy", {
    cost: 5,
    power: 6,
    type: "attack_action",
    traits: ["blood_debt", "shadow", "runeblade"],
  });
const bloodfrenzy = () =>
  fact("Bloodfrenzy Gloomblade", {
    pitch: 1,
    cost: 1,
    power: 3,
    type: "attack_action",
    traits: ["blood_debt", "shadow", "runeblade"],
  });
const starter = () =>
  fact("Become the Shadow Lord", {
    goAgain: true,
    traits: ["shadow", "runeblade"],
  });
const shard = () =>
  fact("Arknight Shard", {
    type: "resource",
    cost: null,
    traits: ["runeblade"],
  });
const weapon = () =>
  fact("Seven Sin Nebula", {
    type: "weapon",
    pitch: null,
    cost: null,
    power: 3,
    traits: ["runeblade", "shadow"],
  });

function position(
  options: {
    hand?: RulesCard[];
    banished?: RulesCard[];
    resources?: number;
    tokens?: Record<string, number>;
  } = {},
): RulesState {
  const hand = options.hand ?? [];
  const banished = options.banished ?? [];
  const initial = setUp({
    deck: [
      ...hand,
      ...banished,
      ...Array.from({ length: 20 }, () =>
        fact("Fixture filler", { effects: [] }),
      ),
    ],
    weapons: [weapon()],
    order: "asGiven",
    seed: 17,
    side: "usurper",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  });
  const cards = [...initial.zones.hand, ...initial.zones.deck];
  return {
    ...initial,
    resources: options.resources ?? 0,
    tokens: options.tokens ?? {},
    zones: {
      ...initial.zones,
      hand: cards.slice(0, hand.length),
      banished: cards.slice(hand.length, hand.length + banished.length),
      deck: cards.slice(hand.length + banished.length),
    },
  };
}
const uid = (state: RulesState, name: string) =>
  Object.values(state.zones)
    .flat()
    .find((instance) => instance.card.name === name)!.uid;
function execute(id: string, initial: RulesState) {
  const example = GATE_WEAPON_EXAMPLES.find((entry) => entry.id === id);
  expect(example).toBeDefined();
  expect(() => parseScript(example!.script)).not.toThrow();
  const before = structuredClone(initial);
  const result = runScriptFromState(initial, example!.script);
  expect(initial).toEqual(before);
  checkInvariants(result.state);
  return result;
}
function readyForSword(hand: RulesCard[] = [], resources = 2) {
  const initial = position({ hand, banished: [bloodfrenzy()], resources });
  return playCard(initial, uid(initial, "Bloodfrenzy Gloomblade"));
}

describe("Gate and sword worked examples", () => {
  it.each([
    [28, 3, true],
    [27, 3, false],
    [25, 0, true],
    [25, 1, false],
    [26, 1, true],
    [27, 2, true],
  ] as const)(
    "checks comfort at %s life after paying %s",
    (life, payment, comfortable) => {
      expect(examples.descendancyComfortableAfterPayment).toBeTypeOf(
        "function",
      );
      expect(examples.descendancyComfortableAfterPayment(life, payment)).toBe(
        comfortable,
      );
    },
  );

  it("marks all five reviewed exact lines as approved", () => {
    expect(
      GATE_WEAPON_EXAMPLES.find((entry) => entry.id === "spare-shard-sword")!
        .review,
    ).toBe("approved");
    expect(
      GATE_WEAPON_EXAMPLES.filter((entry) => entry.review === "approved").map(
        (entry) => entry.id,
      ),
    ).toEqual([
      "descendancy-first",
      "own-usurp-no-gate",
      "own-usurp-traverse-back",
      "spare-sword",
      "spare-shard-sword",
    ]);
  });
  it("plays gated Descendancy before the held Open the Gate and retains a sword resource", () => {
    const open = fact("Open the Gate to i'Arathael", {
      pitch: 1,
      cost: 0,
      power: 4,
      type: "attack_action",
      traits: ["blood_debt", "shadow"],
    });
    const initial = {
      ...position({
        hand: [open],
        banished: [descendant()],
        resources: 3,
        tokens: { gate: 1, runechant: 4 },
      }),
      lifeLost: 5,
    };
    const result = execute("descendancy-first", initial);
    expect(result.steps.map((step) => step.outcome)).toEqual([
      "done",
      "done",
      "done",
    ]);
    expect(result.state.resources).toBe(0);
    expect(result.state.actionPoints).toBe(0);
    expect(result.state.zones.hand[0]!.card.name).toBe(open.name);
    expect(
      result.trace
        .filter((event) => event.type === "attackPlayed")
        .map((event) => event.uid),
    ).toEqual([
      uid(initial, "Arknight Descendancy"),
      initial.zones.weapons[0]!.uid,
    ]);
    expect(result.trace).toContainEqual({ type: "arcaneDamage", amount: 4 });
    expect(result.state.tokens.runechant ?? 0).toBe(0);
    expect(result.state.lifeLost).toBe(5);
  });

  it("does not spend a Gate to play a card with its own banish permission", () => {
    const initial = position({
      banished: [bloodfrenzy()],
      resources: 2,
      tokens: { gate: 1, runechant: 1 },
    });
    const result = execute("own-usurp-no-gate", initial);
    expect(result.steps.every((step) => step.outcome === "done")).toBe(true);
    expect(result.state.tokens.gate).toBe(1);
    expect(
      result.trace.filter((event) => event.type === "gateActivated"),
    ).toEqual([]);
    expect(result.state.resources).toBe(0);
  });

  it("can spend the Gate for an explicitly chosen traverse back", () => {
    const initial = position({
      banished: [bloodfrenzy()],
      resources: 3,
      tokens: { gate: 1, runechant: 1 },
    });
    const result = execute("own-usurp-traverse-back", initial);
    expect(result.steps.every((step) => step.outcome === "done")).toBe(true);
    expect(
      result.trace.filter((event) => event.type === "gateActivated"),
    ).toHaveLength(1);
    expect(result.trace.filter((event) => event.type === "traversed")).toEqual([
      { type: "traversed", to: "forsaken" },
    ]);
    expect(result.state.side).toBe("forsaken");
    expect(result.state.turn).toBe(2);
  });

  it("uses a spare resource while preserving an explicitly reserved starter", () => {
    const initial = readyForSword([starter()]);
    const result = execute("spare-sword", initial);
    expect(result.steps[0]!.outcome).toBe("done");
    expect(
      result.state.zones.hand.map((instance) => instance.card.name),
    ).toEqual(["Become the Shadow Lord"]);
    expect(result.state.resources).toBe(0);
    expect(result.state.zones.pitch).toEqual([]);
    expect(result.state.tokens.runechant ?? 0).toBe(0);
  });

  it("uses a spare resource when the hand is empty", () => {
    const initial = readyForSword();
    const result = execute("spare-sword", initial);
    expect(initial.zones.hand).toEqual([]);
    expect(result.steps[0]!.outcome).toBe("done");
    expect(result.state.resources).toBe(0);
    expect(result.state.tokens.runechant ?? 0).toBe(0);
  });

  it("does not pitch that reserved starter when there is no spare resource", () => {
    const initial = readyForSword([starter()], 1);
    const result = execute("spare-sword", initial);
    expect(result.steps[0]!.outcome).toBe("skipped");
    expect(result.state).toEqual(initial);
  });

  it("uses an explicitly designated spare Shard, not the reserved starter", () => {
    const initial = readyForSword([shard(), starter()], 1);
    const result = execute("spare-shard-sword", initial);
    expect(result.steps.every((step) => step.outcome === "done")).toBe(true);
    expect(
      result.state.zones.pitch.map((instance) => instance.card.name),
    ).toEqual(["Arknight Shard"]);
    expect(
      result.state.zones.hand.map((instance) => instance.card.name),
    ).toEqual(["Become the Shadow Lord"]);
    expect(result.state.resources).toBe(2);
    expect(result.trace).toContainEqual({ type: "arcaneDamage", amount: 1 });
    expect(result.state.tokens.runechant ?? 0).toBe(0);
  });

  it("refuses a sword swing without a card played from banish this turn", () => {
    const initial = position({ resources: 1 });
    const result = execute("spare-sword", initial);
    expect(result.steps[0]!.outcome).toBe("skipped");
    expect(result.steps[0]!.reason).toContain(
      "needs a card played from a banished zone",
    );
    expect(result.state).toEqual(initial);
  });
});

function descendancyPosition() {
  return position({
    hand: [
      fact("Open the Gate to i'Arathael", { pitch: 1, type: "attack_action" }),
    ],
    banished: [descendant()],
    resources: 3,
    tokens: { gate: 1, runechant: 4 },
  });
}

function bloodfrenzyPosition(resources = 2) {
  return position({
    banished: [bloodfrenzy()],
    resources,
    tokens: { gate: 1, runechant: 1 },
  });
}

describe("guarded selection of reviewed worked lines", () => {
  const select = (state: RulesState, decisions = {}) => {
    expect(selection.selectGateWeaponExample).toBeTypeOf("function");
    const before = structuredClone(state);
    const result = selection.selectGateWeaponExample(state, decisions);
    expect(state).toEqual(before);
    if (result) {
      expect(result.review).toBe("approved");
      const run = runScriptFromState(state, result.script);
      expect(run.failure).toBeUndefined();
      expect(run.steps.every((step) => step.outcome === "done")).toBe(true);
      checkInvariants(run.state);
    }
    return result?.id;
  };

  it("selects Descendancy only with the explicit reviewed life input", () => {
    expect(select(descendancyPosition(), { currentLife: 35 })).toBe(
      "descendancy-first",
    );
    expect(select(descendancyPosition())).toBeUndefined();
    expect(select(descendancyPosition(), { currentLife: 24 })).toBeUndefined();
    expect(select(descendancyPosition(), { currentLife: 34 })).toBeUndefined();
  });

  it("requires an explicit traverse decision for either Bloodfrenzy line", () => {
    expect(select(bloodfrenzyPosition(), { traverseBack: false })).toBe(
      "own-usurp-no-gate",
    );
    expect(select(bloodfrenzyPosition())).toBeUndefined();
    expect(select(bloodfrenzyPosition(3), { traverseBack: true })).toBe(
      "own-usurp-traverse-back",
    );
    expect(
      select(bloodfrenzyPosition(3), { traverseBack: false }),
    ).toBeUndefined();
  });

  it("requires other plays to be finished and BSL to be explicitly reserved", () => {
    expect(select(readyForSword(), { otherPlaysFinished: true })).toBe(
      "spare-sword",
    );
    expect(select(readyForSword())).toBeUndefined();
    expect(
      select(readyForSword([starter()]), { otherPlaysFinished: true }),
    ).toBeUndefined();
    expect(
      select(readyForSword([starter()]), {
        otherPlaysFinished: true,
        reserveBsl: true,
      }),
    ).toBe("spare-sword");
  });

  it("pitches Shard only for the reviewed hand and explicit spare/keeper choices", () => {
    const state = readyForSword([shard(), starter()], 1);
    const decisions = {
      otherPlaysFinished: true,
      reserveBsl: true,
      spareShard: true,
    };
    expect(select(state, decisions)).toBe("spare-shard-sword");
    expect(select(state, { ...decisions, spareShard: false })).toBeUndefined();
    expect(select(state, { ...decisions, reserveBsl: false })).toBeUndefined();
    expect(
      select(state, { ...decisions, otherPlaysFinished: false }),
    ).toBeUndefined();
    expect(
      select(
        readyForSword([shard(), starter(), fact("Another card")], 1),
        decisions,
      ),
    ).toBeUndefined();
    expect(
      select(
        readyForSword([shard(), { ...starter(), pitch: 1 }], 1),
        decisions,
      ),
    ).toBeUndefined();
  });

  it.each([
    [
      "wrong hero side",
      (state: RulesState) => ({ ...state, side: "forsaken" as const }),
    ],
    ["no action point", (state: RulesState) => ({ ...state, actionPoints: 0 })],
    [
      "wrong phase",
      (state: RulesState) => ({ ...state, phase: "end" as const }),
    ],
    [
      "used Nebula",
      (state: RulesState) => ({
        ...state,
        usedThisTurn: [state.zones.weapons[0]!.uid],
      }),
    ],
    [
      "unmodelled Nebula",
      (state: RulesState) => ({
        ...state,
        zones: {
          ...state.zones,
          weapons: state.zones.weapons.map((instance) => ({
            ...instance,
            card: { ...instance.card, weaponAttack: undefined },
          })),
        },
      }),
    ],
    ["no resources", (state: RulesState) => ({ ...state, resources: 0 })],
  ] as const)("does not select a sword line with %s", (_label, change) => {
    expect(
      select(change(readyForSword()), { otherPlaysFinished: true }),
    ).toBeUndefined();
  });

  it("checks banish play in the current turn, not an earlier turn", () => {
    const state = readyForSword();
    expect(
      select(position({ resources: 1 }), { otherPlaysFinished: true }),
    ).toBeUndefined();
    expect(
      select(
        {
          ...state,
          events: [...state.events, { type: "turnStarted", turn: 2 }],
        },
        { otherPlaysFinished: true },
      ),
    ).toBeUndefined();
  });

  it("rejects a face-down target and a different pitch", () => {
    const state = bloodfrenzyPosition();
    expect(
      select(
        { ...state, faceDown: [state.zones.banished[0]!.uid] },
        { traverseBack: false },
      ),
    ).toBeUndefined();
    expect(
      select(
        position({
          banished: [{ ...bloodfrenzy(), pitch: 2 }],
          resources: 2,
          tokens: { gate: 1, runechant: 1 },
        }),
        { traverseBack: false },
      ),
    ).toBeUndefined();
  });

  it("requires the declared Gate, Runechants and resources", () => {
    const state = descendancyPosition();
    expect(
      select(
        { ...state, tokens: { gate: 0, runechant: 4 } },
        { currentLife: 35 },
      ),
    ).toBeUndefined();
    expect(
      select(
        { ...state, tokens: { gate: 1, runechant: 3 } },
        { currentLife: 35 },
      ),
    ).toBeUndefined();
    expect(
      select({ ...state, resources: 2 }, { currentLife: 35 }),
    ).toBeUndefined();
  });

  it("does not treat a later blood debt attack as the first", () => {
    const played = readyForSword();
    const state = bloodfrenzyPosition();
    const previous = played.zones.arena[0]!;
    const withHistory = {
      ...state,
      zones: {
        ...state.zones,
        arena: [{ ...previous, uid: "earlier-attack" }],
      },
      events: [
        ...state.events,
        { type: "attackPlayed" as const, uid: "earlier-attack" },
      ],
    };
    expect(select(withHistory, { traverseBack: false })).toBeUndefined();
  });

  it("rejects a partially runnable line before spending its Gate", () => {
    const state = descendancyPosition();
    const withoutHero = { ...state, triggers: [] };
    expect(select(withoutHero, { currentLife: 35 })).toBeUndefined();
  });
});
