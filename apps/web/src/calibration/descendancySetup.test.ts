import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  cardWithRules,
  checkInvariants,
  RUNECHANT,
  runScriptFromState,
  setUp,
  VISERAI,
  type RulesCard,
  type RulesState,
} from "@vdb/engine/rules";
import { runGateWeaponPolicyFromState } from "./gateWeaponBatch.ts";
import { selectDescendancyPlan } from "./descendancySetup.ts";

const card = (name: string, over: Partial<RulesCard> = {}): RulesCard =>
  cardWithRules({
    id: name,
    name,
    pitch: 3,
    cost: 0,
    goAgain: false,
    type: "action",
    traits: [],
    roles: [],
    amounts: {},
    ...over,
  });
const descendancy = () =>
  card("Arknight Descendancy", {
    type: "attack_action",
    cost: 5,
    power: 6,
    traits: ["blood_debt", "shadow", "runeblade"],
  });
const bsl = () =>
  card("Become the Shadow Lord", {
    goAgain: true,
    traits: ["shadow", "runeblade"],
  });
const shard = () =>
  card("Arknight Shard", {
    type: "resource",
    cost: null,
    traits: ["runeblade"],
  });
const keeper = () => card("Keep me");
const setup = (hand: RulesCard[], side: "forsaken" | "usurper" = "forsaken") =>
  setUp({
    deck: [
      ...hand,
      ...Array.from({ length: 24 }, () => card("Filler", { effects: [] })),
    ],
    order: "asGiven",
    seed: 17,
    side,
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  });
const run = (state: RulesState, startingLife = 40) =>
  runGateWeaponPolicyFromState(state, {
    turns: 1,
    mode: "gates",
    startingLife,
    choices: { keep: [{ name: "Keep me" }] },
  });

function fundedForsaken(): RulesState {
  const initial = setup([card("Spare blue"), keeper(), descendancy()]);
  const [spare, kept, target, ...rest] = initial.zones.hand;
  return {
    ...initial,
    tokens: { gate: 1, runechant: 4 },
    zones: {
      ...initial.zones,
      hand: [spare!, kept!],
      banished: [target!],
      deck: [...rest, ...initial.zones.deck],
    },
  };
}

describe("funded Descendancy on Forsaken", () => {
  it("can pitch protected Shard to fund the line without banishing it", () => {
    const state = fundedForsaken();
    state.zones.hand[0] = { ...state.zones.hand[0]!, card: shard() };
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "both",
      startingLife: 39,
      choices: { keep: [{ name: "Keep me" }] },
    });
    expect(result.policyMatches["funded-descendancy"]).toBe(1);
    expect(
      result.trace.some(
        (event) =>
          event.type === "pitched" && event.uid === state.zones.hand[0]!.uid,
      ),
    ).toBe(true);
    expect(
      result.trace.some(
        (event) =>
          event.type === "moved" &&
          event.uid === state.zones.hand[0]!.uid &&
          event.to === "banished",
      ),
    ).toBe(false);
    expect(result.trace.some((event) => event.type === "traversed")).toBe(
      false,
    );
    expect(result.failure).toBeUndefined();
    expect(result.state.lifeLost).toBe(0);
    checkInvariants(result.state);
  });

  it("funds the first blood debt attack without requiring Usurper or a sword", () => {
    const state = fundedForsaken();
    const before = structuredClone(state);
    checkInvariants(state);
    const plan = selectDescendancyPlan(
      state,
      39,
      { keep: [{ name: "Keep me" }] },
      false,
    );
    expect(plan).toMatchObject({ id: "funded-descendancy" });
    const result = runScriptFromState(state, plan!.script);
    expect(result.steps.map((step) => step.outcome)).toEqual([
      "done",
      "done",
      "done",
    ]);
    expect(result.state.side).toBe("forsaken");
    expect(result.state.actionPoints).toBe(0);
    expect(result.state.resources).toBe(1);
    expect(result.state.lifeLost).toBe(0);
    expect(
      result.state.zones.hand.map((instance) => instance.card.name),
    ).toEqual(["Keep me"]);
    expect(
      result.trace.filter((event) => event.type === "attackPlayed"),
    ).toHaveLength(1);
    checkInvariants(result.state);
    expect(state).toEqual(before);
  });

  it.each([
    [20, false],
    [21, true],
  ])(
    "keeps the over-17 guard after earlier self-loss at starting life %i",
    (startingLife, allowed) => {
      const state = { ...fundedForsaken(), lifeLost: 3 };
      expect(
        selectDescendancyPlan(state, startingLife, undefined, false)?.id ===
          "funded-descendancy",
      ).toBe(allowed);
    },
  );

  it("does not pitch a kept card, target a face-down copy or drop the first-attack guard", () => {
    const state = fundedForsaken();
    const target = state.zones.banished[0]!;
    expect(
      selectDescendancyPlan(
        state,
        39,
        { keep: [{ name: "Spare blue" }, { name: "Keep me" }] },
        false,
      ),
    ).toBeUndefined();
    expect(
      selectDescendancyPlan(
        { ...state, faceDown: [target.uid] },
        39,
        undefined,
        false,
      ),
    ).toBeUndefined();
    expect(
      selectDescendancyPlan(
        { ...state, actionPoints: 0 },
        39,
        undefined,
        false,
      ),
    ).toBeUndefined();
    expect(
      selectDescendancyPlan(
        {
          ...state,
          events: [...state.events, { type: "attackPlayed", uid: target.uid }],
        },
        39,
        undefined,
        false,
      ),
    ).toBeUndefined();
  });

  it("counts the Gate line even when the optional sword cannot follow", () => {
    const result = runGateWeaponPolicyFromState(fundedForsaken(), {
      turns: 1,
      mode: "both",
      startingLife: 39,
      choices: { keep: [{ name: "Keep me" }] },
    });
    expect(result.policyMatches["funded-descendancy"]).toBe(1);
    expect(
      result.trace.filter((event) => event.type === "attackPlayed"),
    ).toHaveLength(1);
    expect(
      result.trace.filter((event) => event.type === "traversed"),
    ).toHaveLength(0);
    expect(result.failure).toBeUndefined();
  });

  it.each(["baseline", "weapons"] as const)(
    "leaves %s mode unchanged",
    (mode) => {
      const result = runGateWeaponPolicyFromState(fundedForsaken(), {
        turns: 1,
        mode,
        startingLife: 39,
      });
      expect(result.policyMatches["funded-descendancy"]).toBe(0);
      expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
        false,
      );
    },
  );
});

describe("draft Descendancy setup policy", () => {
  it.each([0, 1, 2])(
    "honours an explicit life payment of %i",
    (lifePayment) => {
      const result = runGateWeaponPolicyFromState(
        setup([bsl(), descendancy(), shard(), keeper()]),
        {
          turns: 1,
          mode: "gates",
          startingLife: 21,
          choices: { lifePayment, keep: [{ name: "Keep me" }] },
        },
      );
      expect(result.policyMatches["descendancy-setup"]).toBe(1);
      expect(
        result.trace.filter(
          (event) => event.type === "lifeLost" && event.amount === 3,
        ),
      ).toHaveLength(0);
      expect(
        result.trace
          .slice(
            0,
            result.trace.findIndex((event) => event.type === "endPhaseStarted"),
          )
          .reduce(
            (total, event) =>
              total + (event.type === "lifeLost" ? event.amount : 0),
            0,
          ),
      ).toBe(lifePayment);
    },
  );

  it("preserves a caller's stricter bounded payment", () => {
    const result = runGateWeaponPolicyFromState(
      setup([bsl(), descendancy(), shard(), keeper()]),
      {
        turns: 1,
        mode: "gates",
        startingLife: 21,
        choices: {
          keep: [{ name: "Keep me" }],
          lifePayment: {
            card: { name: "Arknight Descendancy", pitch: 3 },
            startingLife: 21,
            minimumRemainingLife: 20,
          },
        },
      },
    );
    expect(result.policyMatches["descendancy-setup"]).toBe(1);
    expect(
      result.trace.filter(
        (event) => event.type === "lifeLost" && event.amount === 3,
      ),
    ).toHaveLength(0);
    expect(
      result.trace
        .slice(
          0,
          result.trace.findIndex((event) => event.type === "endPhaseStarted"),
        )
        .reduce(
          (total, event) =>
            total + (event.type === "lifeLost" ? event.amount : 0),
          0,
        ),
    ).toBe(1);
  });

  it("sets up BSL on Forsaken, pays three, funds Gate and attacks without a sword", () => {
    const state = setup([bsl(), descendancy(), shard(), keeper()]);
    const before = structuredClone(state);
    const result = run(state, 21);
    expect(result.policyMatches["descendancy-setup"]).toBe(1);
    expect(result.policyMatches["funded-descendancy"]).toBe(1);
    expect(result.trace.filter((event) => event.type === "lifeLost")).toEqual([
      { type: "lifeLost", amount: 3 },
    ]);
    expect(
      result.trace.filter((event) => event.type === "attackPlayed"),
    ).toHaveLength(1);
    expect(
      result.state.zones.hand.some(
        (instance) => instance.card.name === "Keep me",
      ),
    ).toBe(true);
    expect(result.failure).toBeUndefined();
    checkInvariants(result.state);
    expect(state).toEqual(before);
  });

  it("funds from a larger hand without requiring Shard or BSL", () => {
    const initial = setup(
      [card("Spare blue"), keeper(), card("Other card"), descendancy()],
      "usurper",
    );
    const target = initial.zones.hand[3]!;
    const state: RulesState = {
      ...initial,
      tokens: { gate: 2, runechant: 4 },
      zones: {
        ...initial.zones,
        hand: initial.zones.hand.slice(0, 3),
        banished: [target],
      },
    };
    const result = run(state, 18);
    expect(result.policyMatches["funded-descendancy"]).toBe(1);
    expect(
      result.trace.some(
        (event) =>
          event.type === "pitched" && event.uid === initial.zones.hand[0]!.uid,
      ),
    ).toBe(true);
    expect(
      result.state.zones.hand.some(
        (instance) => instance.card.name === "Keep me",
      ),
    ).toBe(true);
  });

  it("does not set up at 17 life or when Descendancy is explicitly kept", () => {
    const state = setup([bsl(), descendancy(), shard(), keeper()]);
    expect(run(state, 17).policyMatches["descendancy-setup"]).toBe(0);
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "gates",
      startingLife: 40,
      choices: { keep: [{ name: "Arknight Descendancy" }] },
    });
    expect(result.policyMatches["descendancy-setup"]).toBe(0);
  });

  it("does not enable setup in baseline or weapon-only modes", () => {
    for (const mode of ["baseline", "weapons"] as const) {
      const result = runGateWeaponPolicyFromState(
        setup([bsl(), descendancy(), shard(), keeper()]),
        {
          turns: 1,
          mode,
          startingLife: 40,
        },
      );
      expect(result.policyMatches["descendancy-setup"] ?? 0).toBe(0);
    }
  });

  it("finishes setup before the baseline spends the remaining action point", () => {
    const result = run(
      setup([bsl(), descendancy(), card("Spare blue"), keeper()]),
    );
    expect(result.policyMatches["descendancy-setup"]).toBe(1);
    expect(result.policyMatches["funded-descendancy"]).toBe(1);
    expect(
      result.trace.filter((event) => event.type === "attackPlayed"),
    ).toHaveLength(1);
  });

  it("uses only public cards when choosing setup, not the next hidden draw", () => {
    const initial = setup([bsl(), descendancy(), shard(), keeper()]);
    const alternate = {
      ...initial,
      zones: {
        ...initial.zones,
        deck: initial.zones.deck.map((instance) => ({
          ...instance,
          card: descendancy(),
        })),
      },
    };
    for (const state of [initial, alternate]) {
      const result = run(state, 21);
      expect(result.policyMatches["descendancy-setup"]).toBe(1);
      expect(result.trace.find((event) => event.type === "lifeLost")).toEqual({
        type: "lifeLost",
        amount: 3,
      });
      expect(
        result.trace.filter(
          (event) => event.type === "lifeLost" && event.amount === 3,
        ),
      ).toHaveLength(1);
    }
  });

  it("declines funding when only explicitly kept cards could pay", () => {
    const initial = setup([keeper(), descendancy()], "usurper");
    const target = initial.zones.hand[1]!;
    const state = {
      ...initial,
      tokens: { gate: 1, runechant: 4 },
      zones: {
        ...initial.zones,
        hand: [initial.zones.hand[0]!],
        banished: [target],
        deck: initial.zones.deck,
      },
    };
    expect(run(state).policyMatches["funded-descendancy"]).toBe(0);
  });

  it("honours the existing explicit BSL reservation during setup and baseline plays", () => {
    const state = setup([bsl(), descendancy(), shard(), keeper()]);
    const target = state.zones.hand[0]!.uid;
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "gates",
      startingLife: 40,
      decisions: { reserveBsl: true },
    });
    expect(
      result.trace.some(
        (event) => event.type === "played" && event.uid === target,
      ),
    ).toBe(false);
    expect(
      result.state.zones.hand.some((instance) => instance.uid === target),
    ).toBe(true);
  });

  it("stops on a setup trigger-budget failure without replacing its trace", () => {
    const state = {
      ...setup([bsl(), descendancy(), shard(), keeper()]),
      budget: 1,
    };
    const result = run(state);
    expect(result.failure).toBeDefined();
    expect(result.steps.some((step) => step.step === "endTurn")).toBe(false);
    expect(result.trace.some((event) => event.type === "played")).toBe(true);
  });

  it.each([true, false])(
    "makes Nebula an optional funded follow-up (%s)",
    (swing) => {
      const weapon = card("Seven Sin Nebula", {
        type: "weapon",
        cost: null,
        pitch: null,
        power: 3,
      });
      const initial = setUp({
        deck: [
          card("Spare blue"),
          keeper(),
          card("Other card"),
          descendancy(),
          ...Array.from({ length: 24 }, () => card("Filler", { effects: [] })),
        ],
        weapons: [weapon],
        order: "asGiven",
        seed: 17,
        side: "usurper",
        triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
      });
      const state = {
        ...initial,
        tokens: { gate: 1, runechant: 4 },
        zones: {
          ...initial.zones,
          hand: initial.zones.hand.slice(0, 3),
          banished: [initial.zones.hand[3]!],
        },
      };
      const result = runGateWeaponPolicyFromState(state, {
        turns: 1,
        mode: "both",
        startingLife: 18,
        decisions: { nebulaAfterDescendancy: swing },
        choices: { keep: [{ name: "Keep me" }] },
      });
      expect(result.policyMatches["funded-descendancy"]).toBe(1);
      expect(
        result.trace.filter((event) => event.type === "attackPlayed"),
      ).toHaveLength(swing ? 2 : 1);
      expect(result.state.tokens.runechant ?? 0).toBe(0);
    },
  );
});
