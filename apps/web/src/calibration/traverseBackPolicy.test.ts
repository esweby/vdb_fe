import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  cardWithRules,
  checkInvariants,
  RUNECHANT,
  setUp,
  VISERAI,
  type RulesCard,
  type RulesState,
} from "@vdb/engine/rules";
import {
  runGateWeaponBatch,
  runGateWeaponPolicyFromState,
} from "./gateWeaponBatch.ts";
import { selectTraverseBackPlan } from "./traverseBackPolicy.ts";

const fact = (name: string, over: Partial<RulesCard> = {}): RulesCard =>
  cardWithRules({
    id: name,
    name,
    pitch: 3,
    cost: 0,
    type: "action",
    goAgain: false,
    roles: [],
    traits: [],
    amounts: {},
    ...over,
  });
const bloodfrenzy = () =>
  fact("Bloodfrenzy Gloomblade", {
    pitch: 1,
    cost: 1,
    power: 3,
    type: "attack_action",
    traits: ["blood_debt", "shadow", "runeblade"],
  });

function position(gateAlreadyMade = false, withSword = false): RulesState {
  const initial = setUp({
    deck: [
      fact("Spare blue"),
      fact("Kept card"),
      bloodfrenzy(),
      ...Array.from({ length: 24 }, () => fact("Filler", { effects: [] })),
    ],
    order: "asGiven",
    weapons: withSword
      ? [
          fact("Seven Sin Nebula", {
            type: "weapon",
            pitch: null,
            cost: null,
            power: 3,
          }),
        ]
      : [],
    seed: 17,
    side: "usurper",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  });
  const [spare, kept, target, ...rest] = initial.zones.hand;
  return {
    ...initial,
    tokens: { gate: 1, runechant: 1 },
    createdThisTurn: gateAlreadyMade ? { gate: 1 } : {},
    events: [
      ...initial.events,
      ...(gateAlreadyMade
        ? [{ type: "tokensCreated" as const, token: "gate", amount: 1 }]
        : []),
    ],
    zones: {
      ...initial.zones,
      hand: [spare!, kept!],
      banished: [target!],
      deck: [...rest, ...initial.zones.deck],
    },
  };
}
const choices = { keep: [{ name: "Kept card" }] };

describe("explicit traverse-back/hold policy", () => {
  it("holds Usurper when the caller says hold, even if a Gate was created", () => {
    const result = runGateWeaponPolicyFromState(position(true), {
      turns: 1,
      mode: "gates",
      choices,
      decisions: { traverseBack: false },
    });
    expect(
      result.trace.some(
        (event) => event.type === "traversed" && event.to === "forsaken",
      ),
    ).toBe(false);
    expect(result.state.side).toBe("usurper");
  });

  it("funds an already-playable Usurp card only for an explicit return, without requiring a sword", () => {
    const initial = position();
    const before = structuredClone(initial);
    const result = runGateWeaponPolicyFromState(initial, {
      turns: 1,
      mode: "gates",
      choices,
      traverseBackByTurn: { 1: true },
    });
    expect(result.policyMatches["explicit-usurp-traverse"]).toBe(1);
    expect(
      result.trace.filter((event) => event.type === "gateActivated"),
    ).toHaveLength(1);
    expect(
      result.trace.filter((event) => event.type === "attackPlayed"),
    ).toHaveLength(1);
    expect(result.state.side).toBe("forsaken");
    expect(
      result.state.zones.hand.some(
        (instance) => instance.card.name === "Kept card",
      ),
    ).toBe(true);
    checkInvariants(result.state);
    expect(initial).toEqual(before);
  });

  it.each([false, undefined])(
    "does not spend a Gate without an explicit return (%s)",
    (traverseBack) => {
      const result = runGateWeaponPolicyFromState(position(), {
        turns: 1,
        mode: "gates",
        choices,
        decisions: { traverseBack },
      });
      expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
        false,
      );
    },
  );

  it("does not spend an extra Gate when returning is already enabled", () => {
    const result = runGateWeaponPolicyFromState(position(true), {
      turns: 1,
      mode: "gates",
      choices,
      traverseBackByTurn: { 1: true },
    });
    expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
      false,
    );
    expect(result.state.side).toBe("forsaken");
  });

  it("also avoids the older exact Gate fragment when return is already enabled", () => {
    const state = position(true, true);
    state.resources = 3;
    state.zones = {
      ...state.zones,
      hand: [],
      deck: [...state.zones.hand, ...state.zones.deck],
    };
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "both",
      traverseBackByTurn: { 1: true },
    });
    expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
      false,
    );
    expect(result.state.side).toBe("forsaken");
  });

  it("does not require a Runechant just to make the explicitly requested return eligible", () => {
    const state = position();
    state.tokens.runechant = 0;
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "gates",
      choices,
      traverseBackByTurn: { 1: true },
    });
    expect(result.policyMatches["explicit-usurp-traverse"]).toBe(1);
    expect(result.state.side).toBe("forsaken");
    expect(result.trace.some((event) => event.type === "usurped")).toBe(false);
  });

  it("changes answers by engine turn and gives the schedule precedence over fixed answers", () => {
    const state = position(true);
    state.triggers = [
      ...state.triggers,
      {
        id: "fixture-turn-gate",
        on: { event: "turnStarted" },
        effects: [{ op: "createToken", token: "gate", amount: 1 }],
      },
    ];
    const result = runGateWeaponPolicyFromState(state, {
      turns: 2,
      mode: "gates",
      decisions: { traverseBack: true },
      choices: { ...choices, optional: { "viserai-usurper-traverse": true } },
      traverseBackByTurn: { 1: false, 2: true },
    });
    let turn = 1;
    const returned: number[] = [];
    for (const event of result.trace) {
      if (event.type === "turnStarted") turn = event.turn;
      if (event.type === "traversed" && event.to === "forsaken")
        returned.push(turn);
    }
    expect(returned).toEqual([2]);
  });

  it("requires explicit schedule coverage rather than falling back to an inferred decision", () => {
    expect(() =>
      runGateWeaponPolicyFromState(position(), {
        turns: 2,
        mode: "gates",
        traverseBackByTurn: { 1: true },
      }),
    ).toThrow(/turn 2/i);
  });

  it("does not accept inherited schedule values that disappear from recorded JSON", () => {
    const schedule = Object.create({ 1: true }) as Record<number, boolean>;
    expect(() =>
      runGateWeaponPolicyFromState(position(), {
        turns: 1,
        mode: "gates",
        traverseBackByTurn: schedule,
      }),
    ).toThrow(/turn 1/i);
  });

  it("uses absolute engine-turn numbers when resuming a state", () => {
    expect(() =>
      runGateWeaponPolicyFromState(
        { ...position(), turn: 5 },
        {
          turns: 1,
          mode: "gates",
          traverseBackByTurn: { 1: false },
        },
      ),
    ).toThrow(/turn 5/i);
  });

  it("records the explicit schedule and policy version in batch provenance", () => {
    const result = runGateWeaponBatch(
      { deck: [] },
      {
        runs: 1,
        seed: 17,
        turns: 2,
        mode: "gates",
        traverseBackByTurn: { 1: false, 2: true },
      },
    );
    expect(result.inputs.policy?.assumptions.traverseBackByTurn).toBe(
      '{"1":false,"2":true}',
    );
    expect(result.inputs.policy?.id).toBe("reviewed-delayed-hands-v2");
  });

  it("preserves the normal baseline report and rejects a per-turn policy in baseline mode", () => {
    expect(() =>
      runGateWeaponBatch(
        { deck: [] },
        {
          runs: 1,
          seed: 17,
          turns: 1,
          mode: "baseline",
          traverseBackByTurn: { 1: false },
        },
      ),
    ).toThrow(/non-baseline/);
  });

  it.each([
    null,
    [],
    { 0: true },
    { "01": true },
    { 1: "yes" },
    { "1.5": false },
  ])("rejects invalid schedules (%j)", (schedule) => {
    expect(() =>
      runGateWeaponPolicyFromState(position(), {
        turns: 1,
        mode: "gates",
        traverseBackByTurn: schedule as unknown as Record<number, boolean>,
      }),
    ).toThrow(/positive engine-turn numbers/);
  });

  it("allows explicit fixed fallback answers for turns missing from the schedule", () => {
    expect(() =>
      runGateWeaponPolicyFromState(position(), {
        turns: 2,
        mode: "gates",
        choices,
        traverseBackByTurn: { 1: true },
        decisions: { traverseBack: false },
      }),
    ).not.toThrow();
  });

  it("does not fund with kept cards, use a face-down target or invent an action point", () => {
    const state = position();
    expect(
      selectTraverseBackPlan(state, true, {
        keep: [{ name: "Spare blue" }, { name: "Kept card" }],
      }),
    ).toBeUndefined();
    expect(
      selectTraverseBackPlan(
        { ...state, faceDown: [state.zones.banished[0]!.uid] },
        true,
        choices,
      ),
    ).toBeUndefined();
    expect(
      selectTraverseBackPlan({ ...state, actionPoints: 0 }, true, choices),
    ).toBeUndefined();
    expect(
      selectTraverseBackPlan({ ...state, side: "forsaken" }, true, choices),
    ).toBeUndefined();
    expect(
      selectTraverseBackPlan(
        { ...state, activatedThisTurn: { gate: 1 } },
        true,
        choices,
      ),
    ).toBeUndefined();
  });

  it("plays the banished copy without consuming the identical held keeper", () => {
    const state = position();
    const held = { ...state.zones.deck[0]!, card: bloodfrenzy() };
    state.zones = {
      ...state.zones,
      deck: state.zones.deck.slice(1),
      hand: [...state.zones.hand, held],
    };
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "gates",
      choices: {
        keep: [...choices.keep, { name: "Bloodfrenzy Gloomblade", pitch: 1 }],
      },
      traverseBackByTurn: { 1: true },
    });
    expect(result.policyMatches["explicit-usurp-traverse"]).toBe(1);
    expect(
      result.trace.some(
        (event) =>
          event.type === "playedFromBanish" &&
          event.uid === state.zones.banished[0]!.uid,
      ),
    ).toBe(true);
    expect(
      result.state.zones.hand.some((instance) => instance.uid === held.uid),
    ).toBe(true);
    checkInvariants(result.state);
  });

  it("keeps Descendancy ahead of a Usurp return line", () => {
    const state = position();
    const target = {
      ...state.zones.deck[0]!,
      card: fact("Arknight Descendancy", {
        cost: 5,
        power: 6,
        type: "attack_action",
        traits: ["blood_debt", "shadow", "runeblade"],
      }),
    };
    state.zones = {
      ...state.zones,
      deck: state.zones.deck.slice(1),
      banished: [...state.zones.banished, target],
    };
    state.tokens.runechant = 4;
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "gates",
      startingLife: 39,
      choices,
      traverseBackByTurn: { 1: true },
    });
    expect(result.policyMatches["funded-descendancy"]).toBe(1);
    expect(result.policyMatches["explicit-usurp-traverse"]).toBe(0);
    expect(
      result.trace.find((event) => event.type === "gateActivated"),
    ).toMatchObject({ target: target.uid });
  });

  it("never adds a Gate activation in weapon-only mode", () => {
    const result = runGateWeaponPolicyFromState(position(), {
      turns: 1,
      mode: "weapons",
      choices,
      traverseBackByTurn: { 1: true },
    });
    expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
      false,
    );
  });
});
