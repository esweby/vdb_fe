// Funeral Moon and Rattle Bones approved by the maintainer on 27 Oct 2026.
// The other three effect drafts remain UNVERIFIED.
import { parseEffects, verifiedRulesFor } from "@esweby/fab-engine/rules";
import { describe, expect, it } from "vitest";
import { runechantCreators } from "../../../../packages/importer/src/authored/01-runechant-creators.ts";
import { bloodDebtAndBanish } from "../../../../packages/importer/src/authored/03-blood-debt-and-banish.ts";
import { remaining } from "../../../../packages/importer/src/authored/05-remaining.ts";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const base = sampleCards[0]!;
const card = (
  name: string,
  pitch: number,
  attributes: Partial<CardSummary["attributes"]>,
): CardSummary => ({
  ...base,
  name,
  attributes: {
    ...base.attributes,
    hasBloodDebt: false,
    hasRuneGate: false,
    isGateTarget: false,
    ...attributes,
  },
  variants: [
    {
      ...base.variants[0]!,
      id: `${name.toLowerCase().replaceAll(" ", "-")}-${pitch}`,
      pitch,
      attributes: {},
    },
  ],
});

const eloquent = card(
  "Eloquent Eulogy",
  1,
  bloodDebtAndBanish["Eloquent Eulogy"]?.card ?? {},
);
const funeral = card(
  "Funeral Moon",
  1,
  runechantCreators["Funeral Moon"]?.card ?? {},
);
const soul = card(
  "Soul of Existence",
  4,
  remaining["Soul of Existence"]?.card ?? {},
);
const puppetry = card(
  "Shadow Puppetry",
  1,
  bloodDebtAndBanish["Shadow Puppetry"]?.card ?? {},
);
const rattle = card(
  "Rattle Bones",
  1,
  bloodDebtAndBanish["Rattle Bones"]?.card ?? {},
);

describe("the sixth priority rules batch", () => {
  it("keeps Eloquent Eulogy's conditional combat-chain token unsupported", () => {
    const entry = draftQueue([eloquent])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "1 Eloquence if a hero has lost life this turn: the engine can't check that yet",
    ]);
  });

  it("drafts all of Funeral Moon's setup effects", () => {
    const entry = draftQueue([funeral])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [{ op: "createToken", token: "runechant", amount: 1 }],
      instantWhen: "hero_lost_life_this_turn",
      playableFromBanish: true,
    });
    expect(() =>
      parseEffects(entry.drafts[0]!.draft.rules.effects),
    ).not.toThrow();
    expect(verifiedRulesFor(funeral.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("keeps Soul of Existence's purple pitch and life loss visible", () => {
    const entry = draftQueue([soul])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.pitches).toEqual([4]);
    expect(entry.drafts[0]!.draft.rules).toEqual({ effects: [] });
    expect(entry.drafts[0]!.draft.factsNote).toBe(
      "Pitch 4 resource. When pitched, lose 1 life.",
    );
  });

  it("keeps Shadow Puppetry's later attack effect unsupported", () => {
    const entry = draftQueue([puppetry])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again given to a later card: not drafted yet",
    ]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("+1 power");
  });

  it("drafts Rattle Bones' graveyard banish and lists both unsupported permissions", () => {
    const entry = draftQueue([rattle])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [{ op: "banish", from: "graveyard", amount: 1 }],
    });
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Letting other cards be played from the banished zone: not drafted yet",
      "Playing it as an instant: not drafted yet",
    ]);
    expect(verifiedRulesFor(rattle.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it.each([
    ["Eloquent Eulogy", 1],
    ["Soul of Existence", 4],
    ["Shadow Puppetry", 1],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});
