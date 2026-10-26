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
import { runGateWeaponPolicyFromState } from "./gateWeaponBatch.ts";

const fact = (
  name: string,
  pitch: number,
  overrides: Partial<RulesCard> = {},
): RulesCard =>
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
const attack = (name: string, pitch: number, cost = 0, power = 3) =>
  fact(name, pitch, {
    type: "attack_action",
    cost,
    power,
    traits: ["shadow", "runeblade", "blood_debt"],
  });
const aura = (name: string, pitch: number) =>
  fact(name, pitch, { goAgain: true, traits: ["runeblade", "aura"] });
const descendancy = () => attack("Arknight Descendancy", 3, 5, 6);
const demonbound = (pitch: number) =>
  attack("Demonbound Gloomblade", pitch, 0, pitch === 3 ? 1 : 3);
const murmuring = (pitch: number) =>
  attack("Murmuring Gloomblade", pitch, 2, pitch === 3 ? 2 : 3);
const bloodfrenzy = (pitch: number) =>
  attack("Bloodfrenzy Gloomblade", pitch, 1, pitch === 3 ? 1 : 3);

function position(handA: boolean): RulesState {
  const hand = handA
    ? [
        attack("Sinspeaker Gloomblade", 1),
        bloodfrenzy(1),
        fact("Become the Shadow Lord", 3, {
          goAgain: true,
          traits: ["shadow", "runeblade"],
        }),
        demonbound(1),
      ]
    : [
        attack("Usurp the Shadow Throne", 3, 6),
        demonbound(1),
        murmuring(2),
        bloodfrenzy(3),
      ];
  const banished = handA
    ? [
        aura("Runechant of Greed", 2),
        bloodfrenzy(1),
        demonbound(3),
        aura("Runechant of Lust", 2),
        descendancy(),
        murmuring(3),
      ]
    : [
        aura("Runechant of Sloth", 2),
        aura("Runechant of Sloth", 2),
        aura("Runechant of Greed", 2),
        murmuring(3),
        descendancy(),
        aura("Malefic Incantation", 1),
        bloodfrenzy(3),
      ];
  const arena = handA
    ? [aura("Malefic Incantation", 1), aura("Malefic Incantation", 1)]
    : [];
  const initial = setUp({
    deck: [
      ...hand,
      ...banished,
      ...arena,
      ...Array.from({ length: 24 }, () => fact("Filler", 3, { effects: [] })),
    ],
    weapons: [
      fact("Seven Sin Nebula", 3, {
        type: "weapon",
        pitch: null,
        cost: null,
        power: 3,
        traits: ["shadow", "runeblade"],
      }),
    ],
    order: "asGiven",
    seed: 17,
    side: handA ? "usurper" : "forsaken",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  });
  const cards = [...initial.zones.hand, ...initial.zones.deck];
  const arenaCards = cards.slice(
    hand.length + banished.length,
    hand.length + banished.length + arena.length,
  );
  return {
    ...initial,
    lifeLost: handA ? 2 : 10,
    tokens: { gate: 1, runechant: handA ? 5 : 1 },
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
const handAId = "keep-bsl-delayed-descendancy";
const handBId = "keep-gate-delayed-murmuring";
const run = (state: RulesState, options = {}) =>
  runGateWeaponPolicyFromState(state, {
    turns: 1,
    mode: "both",
    startingLife: 40,
    ...options,
  });
const pitched = (state: RulesState, result: ReturnType<typeof run>) =>
  result.trace
    .filter((event) => event.type === "pitched")
    .map((event) => {
      if (event.type !== "pitched") return;
      return state.zones.hand.find((instance) => instance.uid === event.uid)
        ?.card.name;
    });

describe("reviewed delayed hands", () => {
  it.each(["gates", "both"] as const)(
    "keeps BSL and uses banished Demonbound instead of Nebula in %s mode",
    (mode) => {
      const state = position(true),
        before = structuredClone(state);
      const starter = state.zones.hand.find(
        (instance) => instance.card.name === "Become the Shadow Lord",
      )!;
      const followUp = state.zones.banished.find(
        (instance) => instance.card.name === "Demonbound Gloomblade",
      )!;
      const result = run(state, { mode });
      expect(result.policyMatches[handAId]).toBe(1);
      expect(pitched(state, result)).toEqual(["Sinspeaker Gloomblade"]);
      expect(
        result.trace.some(
          (event) =>
            event.type === "playedFromBanish" && event.uid === followUp.uid,
        ),
      ).toBe(true);
      expect(
        result.trace.some(
          (event) =>
            event.type === "attackPlayed" &&
            event.uid === state.zones.weapons[0]!.uid,
        ),
      ).toBe(false);
      expect(
        result.state.zones.hand.some(
          (instance) => instance.uid === starter.uid,
        ),
      ).toBe(true);
      expect(result.failure).toBeUndefined();
      checkInvariants(result.state);
      expect(state).toEqual(before);
    },
  );

  it.each(["gates", "both"] as const)(
    "keeps the Gate and both blues with Murmuring in %s mode",
    (mode) => {
      const state = position(false),
        before = structuredClone(state);
      const blues = state.zones.hand
        .filter((instance) => instance.card.pitch === 3)
        .map((instance) => instance.uid);
      const result = run(state, { mode });
      expect(result.policyMatches[handBId]).toBe(1);
      expect(pitched(state, result)).toEqual(["Murmuring Gloomblade"]);
      expect(result.trace.some((event) => event.type === "gateActivated")).toBe(
        false,
      );
      expect(result.state.tokens.gate).toBe(1);
      expect(result.state.tokens.runechant).toBe(1);
      expect(
        blues.every((uid) =>
          result.state.zones.hand.some((instance) => instance.uid === uid),
        ),
      ).toBe(true);
      expect(result.state.side).toBe("forsaken");
      expect(result.failure).toBeUndefined();
      const end = result.trace.findIndex(
        (event) => event.type === "endPhaseStarted",
      );
      expect(
        result.trace.slice(0, end).some((event) => event.type === "lifeLost"),
      ).toBe(false);
      checkInvariants(result.state);
      expect(state).toEqual(before);
    },
  );

  it.each([false, true])(
    "still respects Hand A's explicit return answer %s",
    (traverseBack) => {
      const result = run(position(true), {
        traverseBackByTurn: { 1: traverseBack },
      });
      expect(result.policyMatches[handAId]).toBe(1);
      expect(result.state.side).toBe(traverseBack ? "forsaken" : "usurper");
    },
  );

  it.each([true, false])(
    "does not override a kept pitch card in Hand A=%s",
    (handA) => {
      const state = position(handA),
        id = handA ? handAId : handBId;
      const result = run(state, {
        choices: {
          keep: [
            { name: handA ? "Sinspeaker Gloomblade" : "Murmuring Gloomblade" },
          ],
        },
      });
      expect(result.policyMatches[id] ?? 0).toBe(0);
    },
  );

  it.each(["baseline", "weapons"] as const)(
    "does not enable either hand in %s mode",
    (mode) => {
      for (const handA of [true, false]) {
        const result = run(position(handA), { mode });
        expect(result.policyMatches[handAId] ?? 0).toBe(0);
        expect(result.policyMatches[handBId] ?? 0).toBe(0);
      }
    },
  );

  it.each([true, false])(
    "does not generalise Hand A=%s to another life total or unknown life",
    (handA) => {
      for (const startingLife of [undefined, 39, 41]) {
        expect(
          run(position(handA), { startingLife }).policyMatches[
            handA ? handAId : handBId
          ] ?? 0,
        ).toBe(0);
      }
    },
  );

  it.each([true, false])(
    "keeps the exact resource, Runechant, Gate, side and hand bounds for Hand A=%s",
    (handA) => {
      const states = [
        { ...position(handA), resources: 1 },
        { ...position(handA), actionPoints: 0 },
        {
          ...position(handA),
          side: handA ? ("forsaken" as const) : ("usurper" as const),
        },
        { ...position(handA), tokens: { gate: 0, runechant: handA ? 5 : 1 } },
        { ...position(handA), tokens: { gate: 2, runechant: handA ? 5 : 1 } },
        { ...position(handA), tokens: { gate: 1, runechant: handA ? 4 : 2 } },
      ];
      const changed = position(handA);
      changed.zones.hand[0] = {
        ...changed.zones.hand[0]!,
        card: fact("Different card", 3, { effects: [] }),
      };
      states.push(changed);
      for (const state of states)
        expect(run(state).policyMatches[handA ? handAId : handBId] ?? 0).toBe(
          0,
        );
    },
  );

  it.each([true, false])(
    "requires the face-up follow-up and the reviewed aura state for Hand A=%s",
    (handA) => {
      const state = position(handA);
      const target = state.zones.banished.find(
        (instance) =>
          instance.card.name ===
          (handA ? "Demonbound Gloomblade" : "Murmuring Gloomblade"),
      )!;
      expect(
        run({ ...state, faceDown: [target.uid] }).policyMatches[
          handA ? handAId : handBId
        ] ?? 0,
      ).toBe(0);
      if (handA) {
        const changed = position(true);
        changed.counters[changed.zones.arena[0]!.uid] = 2;
        expect(run(changed).policyMatches[handAId] ?? 0).toBe(0);
      } else {
        const changed = position(false);
        const extra = changed.zones.deck.shift()!;
        changed.zones.arena.push(extra);
        expect(run(changed).policyMatches[handBId] ?? 0).toBe(0);
        expect(
          run({ ...position(false), createdThisTurn: { runechant: 2 } })
            .policyMatches[handBId] ?? 0,
        ).toBe(0);
      }
    },
  );

  it("requires Descendancy face up and the first blood debt attack for Hand A", () => {
    const state = position(true),
      target = state.zones.banished.find(
        (instance) => instance.card.name === "Arknight Descendancy",
      )!;
    expect(
      run({ ...state, faceDown: [target.uid] }).policyMatches[handAId] ?? 0,
    ).toBe(0);
    expect(
      run({
        ...state,
        events: [...state.events, { type: "attackPlayed", uid: target.uid }],
      }).policyMatches[handAId] ?? 0,
    ).toBe(0);
  });

  it("does not force zero over an explicit positive life-payment choice for Hand B", () => {
    expect(
      run(position(false), { choices: { lifePayment: 3 } }).policyMatches[
        handBId
      ] ?? 0,
    ).toBe(0);
  });
});
