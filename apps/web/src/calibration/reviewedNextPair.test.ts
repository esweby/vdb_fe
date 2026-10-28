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
} from "@esweby/fab-engine/rules";
import { runGateWeaponPolicyFromState } from "./gateWeaponBatch.ts";

const fact = (
  name: string,
  pitch: number,
  overrides: Partial<RulesCard> = {},
) =>
  cardWithRules({
    id: name + pitch,
    name,
    pitch,
    cost: 0,
    type: "action",
    goAgain: false,
    roles: [],
    traits: [],
    amounts: {},
    ...overrides,
  });
const attack = (name: string, pitch: number, cost: number, power: number) =>
  fact(name, pitch, {
    type: "attack_action",
    cost,
    power,
    traits: ["shadow", "runeblade", "blood_debt"],
  });
const starter = () =>
  fact("Become the Shadow Lord", 3, {
    goAgain: true,
    traits: ["shadow", "runeblade"],
  });
const usurp = () => attack("Usurp the Shadow Throne", 3, 13, 13);
const murmuring = () => attack("Murmuring Gloomblade", 3, 2, 2);
const embrace = () =>
  fact("Embrace Sin", 2, {
    cost: 1,
    goAgain: true,
    traits: ["shadow", "runeblade"],
  });
const malefic = () =>
  fact("Malefic Incantation", 1, {
    goAgain: true,
    traits: ["runeblade", "aura"],
  });

function position(handA: boolean): RulesState {
  const hand = handA
    ? [starter(), murmuring()]
    : [
        fact("Arknight Shard", 3, {
          type: "resource",
          cost: null,
          traits: ["runeblade"],
        }),
        usurp(),
        embrace(),
        fact("Scar for a Scar", 1, {
          type: "attack_action",
          power: 4,
          traits: ["generic"],
        }),
      ];
  const descendancy = attack("Arknight Descendancy", 3, 5, 6);
  const banished = handA
    ? [
        usurp(),
        fact("Runechant of Sloth", 2, {
          goAgain: true,
          traits: ["runeblade", "aura"],
        }),
        descendancy,
        embrace(),
        attack("Bloodfrenzy Gloomblade", 1, 1, 3),
      ]
    : [
        attack("Bloodfrenzy Gloomblade", 3, 1, 1),
        starter(),
        murmuring(),
        attack("Bloodfrenzy Gloomblade", 2, 1, 2),
        descendancy,
      ];
  const arena = handA ? [] : [malefic()];
  const deck = [
    ...hand,
    ...banished,
    ...arena,
    ...Array.from({ length: 24 }, () => fact("Filler", 3, { effects: [] })),
  ];
  const initial = setUp({
    deck,
    weapons: [
      fact("Seven Sin Nebula", 3, {
        type: "weapon",
        pitch: null,
        cost: null,
        power: 3,
        traits: ["shadow", "runeblade"],
      }),
    ],
    seed: 17,
    order: "asGiven",
    side: handA ? "usurper" : "forsaken",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  });
  const cards = [...initial.zones.hand, ...initial.zones.deck];
  const arenaCards = cards.slice(
    hand.length + banished.length,
    hand.length + banished.length + arena.length,
  );
  const turn = handA ? 3 : 6;
  return {
    ...initial,
    turn,
    events: [{ type: "turnStarted", turn }],
    lifeLost: handA ? 6 : 12,
    tokens: { gate: 1, runechant: handA ? 5 : 1 },
    createdThisTurn: handA ? { gate: 1, runechant: 4 } : {},
    counters: Object.fromEntries(
      arenaCards.map((instance) => [instance.uid, 1]),
    ),
    zones: {
      ...initial.zones,
      hand: cards.slice(0, hand.length),
      banished: cards.slice(hand.length, hand.length + banished.length),
      arena: arenaCards,
      deck: cards.slice(hand.length + banished.length + arena.length),
    },
  };
}
const handAId = "keep-bsl-equal-blue";
const handBId = "keep-shard-usurp-murmuring";
const run = (state: RulesState, options = {}) =>
  runGateWeaponPolicyFromState(state, {
    turns: 1,
    mode: "both",
    startingLife: 40,
    traverseBackByTurn: { [state.turn]: !(state.turn % 2 === 1) },
    choices: {
      conditions: {
        hero_lost_life_this_turn: false,
        less_life_than_opposing_hero: false,
      },
    },
    ...options,
  });
const pitched = (state: RulesState, result: ReturnType<typeof run>) =>
  result.trace
    .filter((event) => event.type === "pitched")
    .map((event) =>
      event.type === "pitched"
        ? state.zones.hand.find((instance) => instance.uid === event.uid)?.card
            .name
        : undefined,
    );

describe("next reviewed pair", () => {
  it("pitches blue Murmuring while preserving BSL and the same sword line", () => {
    const state = position(true),
      before = structuredClone(state);
    const result = run(state);
    expect(result.policyMatches[handAId]).toBe(1);
    expect(pitched(state, result)).toEqual(["Murmuring Gloomblade"]);
    expect(
      result.state.zones.hand.some(
        (instance) => instance.card.name === "Become the Shadow Lord",
      ),
    ).toBe(true);
    expect(
      result.trace
        .filter((event) => event.type === "attackPlayed")
        .map((event) =>
          event.type === "attackPlayed" ? event.uid : undefined,
        ),
    ).toEqual([state.zones.banished[2]!.uid, state.zones.weapons[0]!.uid]);
    expect(
      result.trace
        .filter((event) => event.type === "arcaneDamage")
        .reduce(
          (total, event) =>
            total + (event.type === "arcaneDamage" ? event.amount : 0),
          0,
        ),
    ).toBe(5);
    expect(result.state.lifeLost - state.lifeLost).toBe(2);
    expect(result.state.side).toBe("usurper");
    expect(result.failure).toBeUndefined();
    checkInvariants(result.state);
    expect(state).toEqual(before);
  });

  it.each(["gates", "both"] as const)(
    "keeps Shard, Usurp and the Gate in %s mode",
    (mode) => {
      const state = position(false),
        before = structuredClone(state);
      const result = run(state, { mode });
      expect(result.policyMatches[handBId]).toBe(1);
      expect(pitched(state, result)).toEqual(["Embrace Sin"]);
      expect(
        result.state.zones.hand
          .filter(
            (instance) =>
              instance.card.pitch === 3 &&
              state.zones.hand.some(
                (original) => original.uid === instance.uid,
              ),
          )
          .map((instance) => instance.card.name),
      ).toEqual(["Arknight Shard", "Usurp the Shadow Throne"]);
      expect(result.state.tokens.gate).toBe(1);
      expect(result.state.tokens.runechant).toBe(2);
      expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
        false,
      );
      expect(result.trace.some((event) => event.type === "arcaneDamage")).toBe(
        false,
      );
      expect(result.failure).toBeUndefined();
      checkInvariants(result.state);
      expect(state).toEqual(before);
    },
  );

  it.each(["baseline", "weapons"] as const)(
    "does not select either exception in %s mode",
    (mode) => {
      for (const handA of [true, false])
        expect(
          run(position(handA), { mode, traverseBackByTurn: undefined })
            .policyMatches[handA ? handAId : handBId] ?? 0,
        ).toBe(0);
    },
  );

  it.each([true, false])(
    "releases the approved keep on the following turn for Hand A=%s",
    (handA) => {
      const state = position(handA);
      const schedule = {
        [state.turn]: state.turn % 2 === 0,
        [state.turn + 1]: (state.turn + 1) % 2 === 0,
      };
      const first = run(state);
      const resumed = run(first.state, { traverseBackByTurn: schedule });
      const together = run(state, { turns: 2, traverseBackByTurn: schedule });
      expect(together.state).toEqual(resumed.state);
      expect(together.trace).toEqual(resumed.trace);
    },
  );

  it("does not enable the sword hand in gates mode or against an explicit sword refusal", () => {
    for (const options of [
      { mode: "gates" },
      { decisions: { nebulaAfterDescendancy: false } },
    ])
      expect(run(position(true), options).policyMatches[handAId] ?? 0).toBe(0);
  });

  it.each([true, false])(
    "does not override a protected pitch card in Hand A=%s",
    (handA) => {
      expect(
        run(position(handA), {
          choices: {
            keep: [{ name: handA ? "Murmuring Gloomblade" : "Embrace Sin" }],
            conditions: {
              hero_lost_life_this_turn: false,
              less_life_than_opposing_hero: false,
            },
          },
        }).policyMatches[handA ? handAId : handBId] ?? 0,
      ).toBe(0);
    },
  );

  it.each([true, false])(
    "keeps life, resource, side, token, hand and banished-zone bounds for Hand A=%s",
    (handA) => {
      const original = position(handA);
      const variants = [
        { ...original, resources: 1 },
        { ...original, actionPoints: 0 },
        { ...original, lifeLost: original.lifeLost + 1 },
        {
          ...original,
          side: handA ? ("forsaken" as const) : ("usurper" as const),
        },
        { ...original, tokens: { gate: 2, runechant: handA ? 5 : 1 } },
        { ...original, tokens: { gate: 1, runechant: handA ? 4 : 2 } },
      ];
      const changedHand = position(handA);
      changedHand.zones.hand[0] = {
        ...changedHand.zones.hand[0]!,
        card: fact("Different card", 3, { effects: [] }),
      };
      variants.push(changedHand);
      const missingBanish = position(handA);
      missingBanish.zones.graveyard.push(missingBanish.zones.banished.shift()!);
      variants.push(missingBanish);
      for (const state of variants)
        expect(run(state).policyMatches[handA ? handAId : handBId] ?? 0).toBe(
          0,
        );
      expect(
        run(original, { startingLife: undefined }).policyMatches[
          handA ? handAId : handBId
        ] ?? 0,
      ).toBe(0);
    },
  );

  it.each([true, false])(
    "requires visible verified targets and the first blood debt attack for Hand A=%s",
    (handA) => {
      const state = position(handA),
        id = handA ? handAId : handBId;
      const target = state.zones.banished.find(
        (instance) =>
          instance.card.name ===
          (handA ? "Arknight Descendancy" : "Murmuring Gloomblade"),
      )!;
      expect(
        run({ ...state, faceDown: [target.uid] }).policyMatches[id] ?? 0,
      ).toBe(0);
      const unverified = structuredClone(state);
      delete unverified.zones.banished.find(
        (instance) => instance.uid === target.uid,
      )!.card.effects;
      expect(run(unverified).policyMatches[id] ?? 0).toBe(0);
      expect(
        run({
          ...state,
          events: [...state.events, { type: "attackPlayed", uid: target.uid }],
        }).policyMatches[id] ?? 0,
      ).toBe(0);
    },
  );

  it("requires the reviewed Gate creation, unused sword and hold answer for Hand A", () => {
    const state = position(true);
    for (const changed of [
      { ...state, createdThisTurn: {} },
      { ...state, activatedThisTurn: { gate: 1 } },
      { ...state, usedThisTurn: [state.zones.weapons[0]!.uid] },
    ])
      expect(run(changed).policyMatches[handAId] ?? 0).toBe(0);
    expect(
      run(state, { traverseBackByTurn: { 3: true } }).policyMatches[handAId] ??
        0,
    ).toBe(0);
  });

  it("requires the reviewed aura, explicit No answers and no extra payment for Hand B", () => {
    const state = position(false);
    const changed = structuredClone(state);
    changed.counters[changed.zones.arena[0]!.uid] = 2;
    expect(run(changed).policyMatches[handBId] ?? 0).toBe(0);
    expect(
      run({ ...state, createdThisTurn: { runechant: 1 } }).policyMatches[
        handBId
      ] ?? 0,
    ).toBe(0);
    for (const conditions of [
      { hero_lost_life_this_turn: true, less_life_than_opposing_hero: false },
      { hero_lost_life_this_turn: false, less_life_than_opposing_hero: true },
    ])
      expect(
        run(state, { choices: { conditions } }).policyMatches[handBId] ?? 0,
      ).toBe(0);
    expect(
      run(state, {
        choices: {
          conditions: {
            hero_lost_life_this_turn: false,
            less_life_than_opposing_hero: false,
          },
          lifePayment: 3,
        },
      }).policyMatches[handBId] ?? 0,
    ).toBe(0);
  });
});
