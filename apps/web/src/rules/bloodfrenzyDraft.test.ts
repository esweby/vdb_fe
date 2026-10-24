// Bloodfrenzy's draft and verified rules, approved by the maintainer on 24 Oct 2026.
import { describe, expect, it } from "vitest";
import {
  playCard,
  RUNECHANT,
  setUp,
  VISERAI,
  applySessionAction,
  parseTriggers,
  verifiedRulesFor,
  type RulesCard,
  type RulesState,
} from "@vdb/engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const bloodfrenzy: CardSummary = {
  ...sampleCards[0]!,
  id: "bloodfrenzy",
  name: "Bloodfrenzy Gloomblade",
  attributes: {
    ...sampleCards[0]!.attributes,
    tokens: [],
    banishesOwn: [],
    hasUsurp: true,
    hasGoAgain: false,
    playableFromBanish: {},
    goAgain: { conditions: ["dealt_damage_to_defending_hero_this_turn"] },
  },
  variants: [1, 2, 3].map((pitch) => ({
    id: `bloodfrenzy-${pitch}`,
    pitch,
    cost: 1,
    power: 4 - pitch,
    defense: 3,
    attributes: {},
  })),
};

const draft = () => draftQueue([bloodfrenzy])[0]!;
const card = (name: string, over: Partial<RulesCard> = {}): RulesCard => ({
  id: name,
  name,
  pitch: 3,
  cost: 0,
  goAgain: false,
  type: "attack_action",
  roles: [],
  traits: ["blood_debt"],
  amounts: {},
  effects: [],
  ...over,
});

function game(runechants = 0, side: RulesState["side"] = "forsaken") {
  const proposed = card("Bloodfrenzy Gloomblade", {
    ...draft().drafts[0]!.draft.rules,
    cost: 1,
  });
  const state = setUp({
    deck: [proposed, ...Array.from({ length: 20 }, () => card("Filler"))],
    order: "asGiven",
    seed: 1,
    side,
    triggers: [...VISERAI, RUNECHANT],
  });
  return { ...state, resources: 1, tokens: { runechant: runechants } };
}

const uid = (state: RulesState) => state.zones.hand[0]!.uid;
const noteDamage = (state: RulesState, amount: number) =>
  applySessionAction(state, { type: "damage", delta: amount });

describe("Bloodfrenzy's proposed draft", () => {
  it("marks the approved draft as verified for all three pitches", () => {
    const entry = draft();
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([]);
    expect(entry.drafts[0]!.draft.rules).toMatchObject({
      usurp: true,
      playableFromBanish: true,
    });
    expect(() =>
      parseTriggers(entry.drafts[0]!.draft.rules.triggers),
    ).not.toThrow();
    expect(entry.drafts[0]!.draft.description.join(" ")).toContain(
      "damage to the defending hero this turn",
    );
    for (const pitch of [1, 2, 3])
      expect(verifiedRulesFor(bloodfrenzy.name, pitch)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
  });

  it("usurps one of two Runechants; the other deals damage and gives go again", () => {
    const state = game(2);
    const played = playCard(state, uid(state));
    expect(played.events).toContainEqual({ type: "usurped", uid: uid(state) });
    expect(played.events).toContainEqual({ type: "arcaneDamage", amount: 1 });
    expect(played.tokens.runechant).toBe(0);
    expect(played.actionPoints).toBe(1);
  });

  it("does not get go again when its only Runechant is usurped", () => {
    const state = game(1);
    expect(playCard(state, uid(state)).actionPoints).toBe(0);
  });

  it("gets go again when its own hit is noted, only once", () => {
    const state = game();
    const played = playCard(state, uid(state));
    expect(played.actionPoints).toBe(0);
    const hit = noteDamage(played, 3);
    expect(hit.actionPoints).toBe(1);
    expect(noteDamage(hit, 1).actionPoints).toBe(1);
  });

  it("gets go again from damage already dealt this turn", () => {
    const state = noteDamage(game(), 1);
    expect(playCard(state, uid(state)).actionPoints).toBe(1);
  });

  it("ignores damage from an earlier turn and zero damage", () => {
    const state = game();
    const previous: RulesState = {
      ...state,
      events: [
        { type: "damageNoted", amount: 3 },
        { type: "arcaneDamage", amount: 2 },
        ...state.events,
      ],
    };
    expect(playCard(previous, uid(previous)).actionPoints).toBe(0);
    const noDamage = noteDamage(state, 0);
    expect(playCard(noDamage, uid(noDamage)).actionPoints).toBe(0);
  });

  it("does not add a second action point to Viserai's go again", () => {
    const state = game(2, "usurper");
    const played = playCard(state, uid(state));
    expect(played.actionPoints).toBe(1);
    expect(noteDamage(played, 3).actionPoints).toBe(1);
  });

  it("does not grant go again twice when Viserai traverses after its damage", () => {
    const state = game(2);
    const played = playCard(state, uid(state));
    const traversed = applySessionAction(played, { type: "traverse" });
    expect(traversed.actionPoints).toBe(1);
  });

  it("does not add an action point when the attack already has natural go again", () => {
    const state = game(2);
    const natural = {
      ...state,
      zones: {
        ...state.zones,
        hand: state.zones.hand.map((instance, index) =>
          index === 0
            ? { ...instance, card: { ...instance.card, goAgain: true } }
            : instance,
        ),
      },
    };
    expect(playCard(natural, uid(natural)).actionPoints).toBe(1);
  });

  it("does not give an earlier Bloodfrenzy go again when a later attack hits", () => {
    const state = game();
    const played = playCard(state, uid(state));
    const next = playCard({ ...played, actionPoints: 1 }, uid(played));
    expect(noteDamage(next, 3).actionPoints).toBe(0);
  });
});
