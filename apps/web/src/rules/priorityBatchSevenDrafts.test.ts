// Seeds of Agony, Shadowrealm Ripper and Sonata Galaxia approved by the maintainer on 27 Oct 2026.
// The other seven effect drafts remain UNVERIFIED.
import { verifiedRulesFor } from "@vdb/engine/rules";
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
  variants: pitches.map((pitch) => ({
    ...base.variants[0]!,
    id: `${name.toLowerCase().replaceAll(" ", "-")}-${pitch}`,
    pitch,
    attributes: {},
  })),
});

const ferryman = card(
  "Dimenxxional Ferryman",
  [3],
  bloodDebtAndBanish["Dimenxxional Ferryman"]?.card ?? {},
);
const seeds = card(
  "Seeds of Agony",
  [3],
  bloodDebtAndBanish["Seeds of Agony"]?.card ?? {},
);
const dystopia = card(
  "Sonata Dystopia",
  [3],
  runechantCreators["Sonata Dystopia"]?.card ?? {},
);
const scrap = card(
  "Looking for a Scrap",
  [1, 2, 3],
  remaining["Looking for a Scrap"]?.card ?? {},
);
const wail = card(
  "Deathly Wail",
  [1, 2, 3],
  runechantCreators["Deathly Wail"]?.card ?? {},
);
const corrupt = card(
  "Corrupt and Conquer",
  [1],
  bloodDebtAndBanish["Corrupt and Conquer"]?.card ?? {},
);
const ripper = card(
  "Shadowrealm Ripper",
  [1],
  bloodDebtAndBanish["Shadowrealm Ripper"]?.card ?? {},
);
const galaxia = card(
  "Sonata Galaxia",
  [1],
  remaining["Sonata Galaxia"]?.card ?? {},
);
const harvest = card(
  "Forbidden Harvest",
  [2],
  runechantCreators["Forbidden Harvest"]?.card ?? {},
);
const fantasmia = card(
  "Sonata Fantasmia",
  [3],
  runechantCreators["Sonata Fantasmia"]?.card ?? {},
);

describe("the seventh priority rules batch", () => {
  it("keeps Dimenxxional Ferryman's two-card return as an unsupported note", () => {
    const entry = draftQueue([ferryman])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.rules).toEqual({ effects: [] });
    expect(entry.drafts[0]!.draft.factsNote).toContain(
      "a blood debt action card",
    );
  });

  it("drafts Seeds of Agony's banished-zone permission", () => {
    const entry = draftQueue([seeds])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      playableFromBanish: true,
    });
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Arcane damage: damage to an opponent is out of scope",
    ]);
    expect(verifiedRulesFor(seeds.name, 3)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("keeps Sonata Dystopia's effects on the next attack unsupported", () => {
    const entry = draftQueue([dystopia])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "X Runechants given to a later card: not drafted yet",
      "Cost reductions given to a later card: not drafted yet",
    ]);
  });

  it("groups Looking for a Scrap's pitches and keeps its optional cost visible", () => {
    const entry = draftQueue([scrap])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("banish a 1-power card");
  });

  it("groups Deathly Wail's pitches and records its variable Runechants", () => {
    const entry = draftQueue([wail])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "X Runechants: the engine needs a number",
    ]);
  });

  it("keeps Corrupt and Conquer's combat disruption out of scope", () => {
    const entry = draftQueue([corrupt])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Disrupting an opponent: out of scope",
    ]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("From banish");
  });

  it("drafts Shadowrealm Ripper's optional attack banish", () => {
    const entry = draftQueue([ripper])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      triggers: [
        {
          id: "shadowrealm-ripper-attacks",
          on: { event: "attacking", self: true },
          effects: [
            {
              op: "banish",
              from: "hand",
              amount: 1,
              optional: true,
              storeAs: "banished",
            },
          ],
        },
      ],
    });
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Bonuses to power or defence: combat is out of scope",
    ]);
    expect(verifiedRulesFor(ripper.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("drafts Sonata Galaxia's Runechant discount only", () => {
    const entry = draftQueue([galaxia])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      costReductions: [{ amount: "perRunechant" }],
    });
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again if X is 2 or more: the engine can't check that yet",
      "Searching the deck: not drafted yet",
    ]);
    expect(verifiedRulesFor(galaxia.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it.each([
    ["Forbidden Harvest", harvest],
    ["Sonata Fantasmia", fantasmia],
  ])("keeps %s's variable Runechants unsupported", (_name, candidate) => {
    const entry = draftQueue([candidate])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "X Runechants: the engine needs a number",
    ]);
  });

  it.each([
    ["Dimenxxional Ferryman", 3],
    ["Sonata Dystopia", 3],
    ["Looking for a Scrap", 1],
    ["Deathly Wail", 1],
    ["Corrupt and Conquer", 1],
    ["Forbidden Harvest", 2],
    ["Sonata Fantasmia", 3],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});
