import { describe, expect, it } from "vitest";
import {
  BLOOD_DEBT,
  cardWithRules,
  RUNECHANT,
  setUp,
  VISERAI,
  type RulesCard,
} from "@vdb/engine/rules";
import { runGateWeaponPolicyFromState } from "./gateWeaponBatch.ts";
const card = (name: string, overrides: Partial<RulesCard> = {}): RulesCard =>
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
    ...overrides,
  });
const shard = () =>
  card("Arknight Shard", {
    type: "resource",
    cost: null,
    traits: ["runeblade"],
  });
const bsl = () =>
  card("Become the Shadow Lord", {
    goAgain: true,
    traits: ["shadow", "runeblade"],
  });
const attack = (name: string) =>
  card(name, {
    type: "attack_action",
    traits: ["shadow", "runeblade", "blood_debt"],
  });
const position = (hand: RulesCard[]) =>
  setUp({
    deck: [
      ...hand,
      ...Array.from({ length: 16 }, () => card("Filler", { effects: [] })),
    ],
    order: "asGiven",
    seed: 17,
    side: "forsaken",
    triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
  });
const firstHandBanish = (
  result: ReturnType<typeof runGateWeaponPolicyFromState>,
) => {
  const event = result.trace.find(
    (event) =>
      event.type === "moved" &&
      event.from === "hand" &&
      event.to === "banished",
  );
  if (!event || event.type !== "moved") return;
  return Object.values(result.state.zones)
    .flat()
    .find((instance) => instance.uid === event.uid)?.card.name;
};
describe("approved Shard and Bloodfrenzy banish policy", () => {
  it.each(["gates", "weapons", "both"] as const)(
    "prioritises Bloodfrenzy without banishing Shard in %s mode",
    (mode) => {
      const result = runGateWeaponPolicyFromState(
        position([
          shard(),
          bsl(),
          attack("Demonbound Gloomblade"),
          attack("Bloodfrenzy Gloomblade"),
        ]),
        { turns: 1, mode },
      );
      expect(firstHandBanish(result)).toBe("Bloodfrenzy Gloomblade");
      expect(
        result.trace.some(
          (event) => event.type === "tokensCreated" && event.token === "gate",
        ),
      ).toBe(true);
    },
  );
  it("does not change baseline mode", () => {
    const result = runGateWeaponPolicyFromState(
      position([
        shard(),
        bsl(),
        attack("Demonbound Gloomblade"),
        attack("Bloodfrenzy Gloomblade"),
      ]),
      { turns: 1, mode: "baseline" },
    );
    expect(firstHandBanish(result)).toBe("Arknight Shard");
  });
  it("does not banish a kept Bloodfrenzy or sacrifice Shard instead", () => {
    const result = runGateWeaponPolicyFromState(
      position([
        shard(),
        bsl(),
        attack("Bloodfrenzy Gloomblade"),
        attack("Demonbound Gloomblade"),
      ]),
      {
        turns: 1,
        mode: "gates",
        choices: { keep: [{ name: "Bloodfrenzy Gloomblade" }] },
      },
    );
    expect(firstHandBanish(result)).toBe("Demonbound Gloomblade");
  });
  it("keeps Descendancy setup priority", () => {
    const descendancy = attack("Arknight Descendancy");
    descendancy.cost = 5;
    const result = runGateWeaponPolicyFromState(
      position([shard(), bsl(), attack("Bloodfrenzy Gloomblade"), descendancy]),
      { turns: 1, mode: "gates", startingLife: 40 },
    );
    expect(firstHandBanish(result)).toBe("Arknight Descendancy");
  });
  it("skips BSL if Shard is the only remaining hand-banish option", () => {
    const state = position([bsl(), shard()]);
    state.zones.deck = [...state.zones.hand.slice(2), ...state.zones.deck];
    state.zones.hand = state.zones.hand.slice(0, 2);
    const result = runGateWeaponPolicyFromState(state, {
      turns: 1,
      mode: "gates",
    });
    expect(firstHandBanish(result)).toBeUndefined();
    const bslUid = state.zones.hand.find(
      (instance) => instance.card.name === "Become the Shadow Lord",
    )!.uid;
    expect(
      result.trace.some(
        (event) => event.type === "played" && event.uid === bslUid,
      ),
    ).toBe(false);
  });
});
