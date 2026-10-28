// Runic Reaving and Vantom Banshee approved by the maintainer on 27 Oct 2026.
// The other eight effect drafts remain UNVERIFIED.
import { verifiedRulesFor } from "@esweby/fab-engine/rules";
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
  pitches: number[],
  attributes: Partial<CardSummary["attributes"]>,
  variantAttributes: CardSummary["variants"][number]["attributes"] = {},
): CardSummary => ({
  ...base,
  name,
  attributes: {
    ...base.attributes,
    hasBloodDebt: false,
    hasUsurp: false,
    hasRuneGate: false,
    isGateTarget: false,
    ...attributes,
  },
  variants: pitches.map((pitch) => ({
    ...base.variants[0]!,
    id: `${name.toLowerCase().replaceAll(" ", "-")}-${pitch}`,
    pitch,
    attributes: variantAttributes,
  })),
});

const harrower = card(
  "Shadowrealm Harrower",
  [3],
  bloodDebtAndBanish["Shadowrealm Harrower"]?.card ?? {},
);
const reaving = card(
  "Runic Reaving",
  [1, 2, 3],
  {
    ...(runechantCreators["Runic Reaving"]?.card ?? {}),
    hasUsurp: true,
  },
  { activation: { speed: "instant", cost: 0, pay: "discard" } },
);
const overcrowded = card("Overcrowded", [3], remaining.Overcrowded?.card ?? {});
const solace = card(
  "Sigil of Solace",
  [1, 2, 3],
  remaining["Sigil of Solace"]?.card ?? {},
);
const command = card(
  "Command and Conquer",
  [1],
  remaining["Command and Conquer"]?.card ?? {},
);
const delight = card(
  "Deathly Delight",
  [1],
  bloodDebtAndBanish["Deathly Delight"]?.card ?? {},
);
const suffering = card(
  "Sigil of Suffering",
  [1],
  remaining["Sigil of Suffering"]?.card ?? {},
);
const heart = card(
  "Heart of Fyendal",
  [3],
  remaining["Heart of Fyendal"]?.card ?? {},
);
const banshee = card("Vantom Banshee", [1, 2, 3], {
  ...(bloodDebtAndBanish["Vantom Banshee"]?.card ?? {}),
  hasBloodDebt: true,
  hasRuneGate: true,
});
const bounding = card(
  "Bounding Demigon",
  [1],
  bloodDebtAndBanish["Bounding Demigon"]?.card ?? {},
);

describe("the eighth priority rules batch", () => {
  it("keeps Shadowrealm Harrower's hit payoff in its note", () => {
    const entry = draftQueue([harrower])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.rules).toEqual({ effects: [] });
    expect(entry.drafts[0]!.draft.factsNote).toContain("gain life");
  });

  it("groups and fully drafts Runic Reaving's pitches", () => {
    const entry = draftQueue([reaving])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      activate: {
        speed: "instant",
        cost: 0,
        pay: "discard",
        effects: [{ op: "createToken", token: "runechant", amount: 1 }],
      },
      usurp: true,
    });
    for (const pitch of [1, 2, 3])
      expect(verifiedRulesFor(reaving.name, pitch)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
  });

  it("keeps Overcrowded's combat bonus unsupported", () => {
    const entry = draftQueue([overcrowded])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.factsNote).toContain("aura token");
  });

  it("groups Sigil of Solace's pitches and keeps their life gain visible", () => {
    const entry = draftQueue([solace])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.factsNote).toBe(
      "Gain 3/2/1 life (red/yellow/blue).",
    );
  });

  it("keeps Command and Conquer's hit effect unsupported", () => {
    const entry = draftQueue([command])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.factsNote).toContain("their arsenal");
  });

  it("keeps Deathly Delight's variable life gain unsupported", () => {
    const entry = draftQueue([delight])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.factsNote).toContain("heroes who lost life");
  });

  it("keeps Sigil of Suffering's combat effects out of scope", () => {
    const entry = draftQueue([suffering])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Arcane damage: damage to an opponent is out of scope",
      "Bonuses to power or defence: combat is out of scope",
    ]);
  });

  it("keeps Heart of Fyendal's conditional pitch effect visible", () => {
    const entry = draftQueue([heart])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.factsNote).toContain("When pitched");
  });

  it("groups Vantom Banshee's Rune Gate and blood debt pitches", () => {
    const entry = draftQueue([banshee])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.description).toEqual([
      "Rune Gate.",
      "Blood debt.",
    ]);
    for (const pitch of [1, 2, 3])
      expect(verifiedRulesFor(banshee.name, pitch)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
  });

  it("keeps Bounding Demigon's conditional banished-zone play unsupported", () => {
    const entry = draftQueue([bounding])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Playing it from the banished zone under a condition: not drafted yet",
    ]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("From banish");
  });

  it.each([
    ["Shadowrealm Harrower", 3],
    ["Overcrowded", 3],
    ["Sigil of Solace", 1],
    ["Command and Conquer", 1],
    ["Deathly Delight", 1],
    ["Sigil of Suffering", 1],
    ["Heart of Fyendal", 3],
    ["Bounding Demigon", 1],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});
