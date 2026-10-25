// Maintainer-approved exact selections; registered card rules establish legality.
import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  cardWithRules,
  checkInvariants,
  parseScript,
  playCard,
  RUNECHANT,
  runBatch,
  runScriptFromState,
  setUp,
  VISERAI,
  type RulesCard,
  type RulesState,
} from "@vdb/engine/rules";
import { GATE_WEAPON_EXAMPLES } from "./gateWeaponExamples.ts";
import * as examples from "./gateWeaponExamples.ts";
import * as selection from "./gateWeaponSelection.ts";
import * as policyBatch from "./gateWeaponBatch.ts";
import { baselineScript } from "../ranking/scenarioRuns.ts";

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
    [27, 3, true],
    [25, 0, true],
    [25, 1, true],
    [21, 3, true],
    [20, 3, false],
    [18, 0, true],
    [17, 0, false],
    [16, 0, false],
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

  it("marks all six reviewed lines as approved", () => {
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
      "spare-shard-descendancy",
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
    expect(select(descendancyPosition(), { currentLife: 17 })).toBeUndefined();
    expect(select(descendancyPosition(), { currentLife: 34 })).toBe(
      "descendancy-first",
    );
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
      select({ ...state, resources: 1 }, { currentLife: 35 }),
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

  it("allows Descendancy without go again when the sword cannot follow", () => {
    const state = descendancyPosition();
    const withoutHero = { ...state, triggers: [] };
    expect(select(withoutHero, { currentLife: 35 })).toBe("descendancy-first");
  });

  it.each([
    [4, 3, 25, true],
    [4, 4, 34, true],
    [5, 2, 25, true],
    [6, 2, 35, true],
    [4, 2, 35, true],
    [5, 1, 35, true],
    [3, 4, 35, false],
    [5, 2, 18, true],
    [5, 2, 24, true],
    [5, 2, 17, false],
    [5, 2, 16, false],
    [5, 2, Infinity, false],
  ] as const)(
    "checks bounded Descendancy with %s Runechants, %s resources and %s life",
    (runechants, resources, currentLife, allowed) => {
      const state = position({
        hand: [shard(), starter()],
        banished: [bloodfrenzy(), descendant()],
        resources,
        tokens: { gate: 2, runechant: runechants },
      });
      expect(select(state, { currentLife })).toBe(
        allowed ? "descendancy-first" : undefined,
      );
    },
  );

  it("plays Descendancy from banish while retaining an identical hand copy", () => {
    const state = position({
      hand: [descendant(), shard(), starter()],
      banished: [bloodfrenzy(), descendant()],
      resources: 3,
      tokens: { gate: 1, runechant: 4 },
    });
    expect(select(state, { currentLife: 25 })).toBe("descendancy-first");
    const example = selection.selectGateWeaponExample(state, {
      currentLife: 25,
    })!;
    const result = runScriptFromState(state, example.script);
    expect(result.state.zones.hand).toEqual(state.zones.hand);
    expect(result.trace).toContainEqual({
      type: "playedFromBanish",
      uid: state.zones.banished[1]!.uid,
    });
    expect(result.trace.some((event) => event.type === "pitched")).toBe(false);
    expect(result.state.lifeLost).toBe(state.lifeLost);
  });

  it("uses a face-up Descendancy without selecting a face-down copy", () => {
    const state = position({
      banished: [descendant(), descendant()],
      resources: 3,
      tokens: { gate: 1, runechant: 4 },
    });
    const first = state.zones.banished[0]!.uid;
    expect(select({ ...state, faceDown: [first] }, { currentLife: 25 })).toBe(
      "descendancy-first",
    );
    expect(
      select(
        {
          ...state,
          faceDown: state.zones.banished.map((instance) => instance.uid),
        },
        { currentLife: 25 },
      ),
    ).toBeUndefined();
  });
});

describe("opt-in worked-line batches", () => {
  const run = (state: RulesState, options = {}) => {
    expect(policyBatch.runGateWeaponPolicyFromState).toBeTypeOf("function");
    const before = structuredClone(state);
    const result = policyBatch.runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "both",
      ...options,
    });
    expect(state).toEqual(before);
    checkInvariants(result.state);
    return result;
  };

  it("counts a spare-resource match only with explicit decisions", () => {
    const state = readyForSword([starter()]);
    const result = run(state, {
      decisions: { otherPlaysFinished: true, reserveBsl: true },
    });
    expect(result.policyMatches["spare-sword"]).toBe(1);
    expect(
      result.trace.filter(
        (event) =>
          event.type === "attackPlayed" &&
          event.uid === state.zones.weapons[0]!.uid,
      ),
    ).toHaveLength(1);
    expect(run(state).policyMatches["spare-sword"]).toBe(0);
  });

  it.each(["baseline", "gates", "weapons", "both"] as const)(
    "handles the traverse-back fragment once in %s mode",
    (mode) => {
      const result = run(bloodfrenzyPosition(3), {
        mode,
        decisions: { traverseBack: true },
      });
      expect(result.state.turn).toBe(2);
      expect(
        result.trace.filter((event) => event.type === "turnEnded"),
      ).toHaveLength(1);
      expect(result.policyMatches["own-usurp-traverse-back"]).toBe(
        mode === "gates" || mode === "both" ? 1 : 0,
      );
      expect(
        result.trace.filter((event) => event.type === "gateActivated"),
      ).toHaveLength(mode === "gates" || mode === "both" ? 1 : 0);
      expect(
        result.trace.filter(
          (event) =>
            event.type === "attackPlayed" &&
            event.uid === result.state.zones.weapons[0]!.uid,
        ),
      ).toHaveLength(mode === "both" ? 1 : 0);
    },
  );

  it("derives explicit goldfish life from starting life and self-loss, not a default", () => {
    const state = { ...descendancyPosition(), lifeLost: 5 };
    expect(
      run(state, { startingLife: 40 }).policyMatches["descendancy-first"],
    ).toBe(1);
    expect(run(state).policyMatches["descendancy-first"]).toBe(0);
    expect(
      run(state, { startingLife: 39 }).policyMatches["descendancy-first"],
    ).toBe(1);
  });

  it("does not enable sword-only hands in Gates-only mode", () => {
    const state = readyForSword([shard(), starter()], 1);
    const decisions = {
      otherPlaysFinished: true,
      reserveBsl: true,
      spareShard: true,
    };
    expect(
      run(state, { mode: "gates", decisions }).policyMatches[
        "spare-shard-sword"
      ],
    ).toBe(0);
    expect(
      run(state, { mode: "weapons", decisions }).policyMatches[
        "spare-shard-sword"
      ],
    ).toBe(1);
  });

  it("preserves the default report and paired seeds when no position matches", () => {
    expect(policyBatch.runGateWeaponBatch).toBeTypeOf("function");
    const setup = { deck: [] };
    const options = { turns: 2, runs: 5, seed: 19 };
    const baseline = runBatch(setup, baselineScript(2), options);
    expect(
      policyBatch.runGateWeaponBatch(setup, { ...options, mode: "baseline" }),
    ).toEqual(baseline);
    const result = policyBatch.runGateWeaponBatch(setup, {
      ...options,
      mode: "both",
      startingLife: 40,
      decisions: { traverseBack: false },
    });
    expect(result.inputs.script).toEqual(baseline.inputs.script);
    expect(result.inputs.rulesDataVersion).toBe(
      baseline.inputs.rulesDataVersion,
    );
    expect(result.inputs.policy).toEqual({
      id: "draft-descendancy-setup-v6",
      assumptions: {
        strategy:
          "UNVERIFIED: BSL setup, bounded Descendancy life payment and highest-pitch funding from non-kept cards",
        label: "Assumed",
        mode: "both",
        startingLife: 40,
        traverseBack: false,
      },
    });
    expect(result.byTurn).toEqual(baseline.byTurn);
    expect(
      result.perRun.map(({ policyMatches, ...record }) => {
        expect(Object.values(policyMatches!)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
        return record;
      }),
    ).toEqual(baseline.perRun);
  });

  it("keeps missing Cull answers as errors rather than inventing conditions", () => {
    const state = position({ hand: [fact("Cull", { pitch: 1, cost: 0 })] });
    expect(() => run(state)).toThrow(/explicit/i);
  });

  it("rejects unsupported modes and invalid starting life", () => {
    expect(() => run(readyForSword(), { mode: "unknown" })).toThrow(/mode/i);
    expect(() => run(readyForSword(), { startingLife: NaN })).toThrow(/life/i);
  });
});

function fundingPosition(hand = [shard(), starter()]) {
  return position({
    hand,
    banished: [descendant()],
    resources: 0,
    tokens: { gate: 1, runechant: 4 },
  });
}

describe("the reviewed Shard-funded Descendancy line", () => {
  const decisions = { currentLife: 25, spareShard: true, reserveBsl: true };

  it("pitches Shard, plays gated Descendancy and swings without paying life or using BSL", () => {
    const state = fundingPosition();
    const result = execute("spare-shard-descendancy", state);
    expect(result.steps.map((step) => step.outcome)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(result.state.resources).toBe(1);
    expect(result.state.tokens.runechant ?? 0).toBe(0);
    expect(result.state.tokens.gate ?? 0).toBe(0);
    expect(result.state.lifeLost).toBe(state.lifeLost);
    expect(
      result.state.zones.hand.map((instance) => instance.card.name),
    ).toEqual(["Become the Shadow Lord"]);
    expect(
      result.state.zones.pitch.map((instance) => instance.card.name),
    ).toEqual(["Arknight Shard"]);
    expect(result.trace).toContainEqual({ type: "arcaneDamage", amount: 5 });
  });

  it("selects only the reviewed hand with explicit spare and keeper choices", () => {
    const state = fundingPosition();
    const before = structuredClone(state);
    expect(selection.selectGateWeaponExample(state, decisions)?.id).toBe(
      "spare-shard-descendancy",
    );
    expect(state).toEqual(before);
    expect(
      selection.selectGateWeaponExample(state, {
        ...decisions,
        spareShard: false,
      }),
    ).toBeUndefined();
    expect(
      selection.selectGateWeaponExample(state, {
        ...decisions,
        reserveBsl: false,
      }),
    ).toBeUndefined();
    expect(
      selection.selectGateWeaponExample(
        fundingPosition([fact("Other blue"), starter()]),
        decisions,
      ),
    ).toBeUndefined();
    expect(
      selection.selectGateWeaponExample(
        fundingPosition([shard(), starter(), fact("Another card")]),
        decisions,
      ),
    ).toBeUndefined();
  });

  it.each([
    ["unsafe life", { currentLife: 17 }, {}],
    ["lower life", { currentLife: 16 }, {}],
    ["different resources", {}, { resources: 1 }],
    ["different Runechants", {}, { tokens: { gate: 1, runechant: 5 } }],
    ["no Gate", {}, { tokens: { gate: 0, runechant: 4 } }],
    ["more Gates", {}, { tokens: { gate: 2, runechant: 4 } }],
  ] as const)(
    "does not silently broaden the exact funding line: %s",
    (_label, changeDecisions, changeState) => {
      expect(
        selection.selectGateWeaponExample(
          { ...fundingPosition(), ...changeState },
          { ...decisions, ...changeDecisions },
        ),
      ).toBeUndefined();
    },
  );

  it.each([18, 24, 25, 26, 35])(
    "permits the funded line at %s life",
    (currentLife) => {
      expect(
        selection.selectGateWeaponExample(fundingPosition(), {
          ...decisions,
          currentLife,
        })?.id,
      ).toBe("spare-shard-descendancy");
    },
  );

  it("requires a supplied integer life total for the funded line", () => {
    expect(
      selection.selectGateWeaponExample(fundingPosition(), {
        spareShard: true,
        reserveBsl: true,
      }),
    ).toBeUndefined();
    expect(
      selection.selectGateWeaponExample(fundingPosition(), {
        ...decisions,
        currentLife: Infinity,
      }),
    ).toBeUndefined();
  });

  it("rejects hidden or missing targets but permits a used weapon", () => {
    const state = fundingPosition();
    expect(
      selection.selectGateWeaponExample(
        { ...state, faceDown: [state.zones.banished[0]!.uid] },
        decisions,
      ),
    ).toBeUndefined();
    expect(
      selection.selectGateWeaponExample(
        position({
          hand: [shard(), starter()],
          tokens: { gate: 1, runechant: 4 },
        }),
        decisions,
      ),
    ).toBeUndefined();
    expect(
      selection.selectGateWeaponExample(
        { ...state, usedThisTurn: [state.zones.weapons[0]!.uid] },
        decisions,
      )?.id,
    ).toBe("spare-shard-descendancy");
  });

  it.each(["baseline", "gates", "weapons", "both"] as const)(
    "keeps BSL when applying the funding line in %s mode",
    (mode) => {
      const state = fundingPosition();
      const keeper = state.zones.hand.find(
        (instance) => instance.card.name === "Become the Shadow Lord",
      )!.uid;
      const result = policyBatch.runGateWeaponPolicyFromState(state, {
        turns: 1,
        mode,
        startingLife: 25,
        decisions: { spareShard: true, reserveBsl: true },
      });
      const applied = mode === "gates" || mode === "both";
      expect(result.policyMatches["spare-shard-descendancy"]).toBe(
        applied ? 1 : 0,
      );
      if (applied)
        expect(
          result.state.zones.hand.some((instance) => instance.uid === keeper),
        ).toBe(true);
      expect(
        result.trace.filter((event) => event.type === "turnEnded"),
      ).toHaveLength(1);
      expect(
        result.trace.filter(
          (event) =>
            event.type === "attackPlayed" &&
            event.uid === state.zones.weapons[0]!.uid,
        ),
      ).toHaveLength(mode === "both" ? 1 : 0);
      checkInvariants(result.state);
    },
  );

  it("does not let a disabled Gate line hide an allowed sword-only line", () => {
    const prior = fact("Fixture non-attack", {
      effects: [],
      goAgain: true,
      playableFromBanish: true,
    });
    const initial = position({
      hand: [shard(), starter()],
      banished: [descendant(), prior],
      tokens: { gate: 1, runechant: 4 },
    });
    const state = playCard(initial, uid(initial, prior.name));
    const choices = { ...decisions, otherPlaysFinished: true };
    expect(selection.selectGateWeaponExample(state, choices)?.id).toBe(
      "spare-shard-descendancy",
    );
    expect(
      selection.selectGateWeaponExample(state, choices, ["spare-shard-sword"])
        ?.id,
    ).toBe("spare-shard-sword");
    expect(
      selection.selectGateWeaponExample(state, choices, []),
    ).toBeUndefined();
    const result = policyBatch.runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "weapons",
      startingLife: 25,
      decisions: {
        otherPlaysFinished: true,
        spareShard: true,
        reserveBsl: true,
      },
    });
    expect(result.policyMatches["spare-shard-sword"]).toBe(1);
    expect(result.policyMatches["spare-shard-descendancy"]).toBe(0);
    expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
      false,
    );
  });
});

describe("Nebula is optional after Descendancy", () => {
  it.each(["absent", "used", "unaffordable"] as const)(
    "selects Gate and Descendancy when Nebula is %s",
    (reason) => {
      const initial = descendancyPosition();
      const state =
        reason === "absent"
          ? { ...initial, zones: { ...initial.zones, weapons: [] } }
          : reason === "used"
            ? { ...initial, usedThisTurn: [initial.zones.weapons[0]!.uid] }
            : { ...initial, resources: 2 };
      const example = selection.selectGateWeaponExample(state, {
        currentLife: 18,
      });
      expect(example?.id).toBe("descendancy-first");
      const run = runScriptFromState(state, example!.script);
      expect(run.steps.every((step) => step.outcome === "done")).toBe(true);
      expect(run.steps.map((step) => step.step)).toEqual([
        "activateGate",
        "play",
      ]);
      expect(
        run.trace.filter((event) => event.type === "attackPlayed"),
      ).toHaveLength(1);
    },
  );

  it("can explicitly decline an affordable Nebula swing", () => {
    const state = descendancyPosition();
    const example = selection.selectGateWeaponExample(state, {
      currentLife: 18,
      nebulaAfterDescendancy: false,
    });
    expect(example?.id).toBe("descendancy-first");
    expect(
      example!.script.steps.some((step) => step.do === "attackWithWeapon"),
    ).toBe(false);
  });

  it("keeps BSL in the funded line without requiring a weapon", () => {
    const initial = fundingPosition();
    const state = { ...initial, zones: { ...initial.zones, weapons: [] } };
    const example = selection.selectGateWeaponExample(state, {
      currentLife: 18,
      spareShard: true,
      reserveBsl: true,
    });
    expect(example?.id).toBe("spare-shard-descendancy");
    const run = runScriptFromState(state, example!.script);
    expect(run.steps.every((step) => step.outcome === "done")).toBe(true);
    expect(run.state.resources).toBe(2);
    expect(run.state.zones.hand.map((instance) => instance.card.name)).toEqual([
      "Become the Shadow Lord",
    ]);
  });
});
