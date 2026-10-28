// UNVERIFIED effect drafts. The maintainer must approve these seven cards before they gain rules.
import { verifiedRulesFor } from "@esweby/fab-engine/rules";
import { describe, expect, it } from "vitest";
import { runechantCreators } from "../../../../packages/importer/src/authored/01-runechant-creators.ts";
import { gateCreators } from "../../../../packages/importer/src/authored/02-gate-creators.ts";
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
  variants: Partial<
    Record<number, CardSummary["variants"][number]["attributes"]>
  > = {},
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
    attributes: variants[pitch] ?? {},
  })),
});

const dam = card(
  "Dam the Shadowake",
  [1],
  gateCreators["Dam the Shadowake"]?.card ?? {},
);
const recesses = card(
  "Deep Recesses of Existence",
  [3],
  bloodDebtAndBanish["Deep Recesses of Existence"]?.card ?? {},
);
const rally = card(
  "Rally the Shadow Horde",
  [3],
  bloodDebtAndBanish["Rally the Shadow Horde"]?.card ?? {},
);
const fiddler = card(
  "Fiddler's Green",
  [1, 2, 3],
  remaining["Fiddler's Green"]?.card ?? {},
);
const interment = card(
  "Permanent Interment",
  [1],
  bloodDebtAndBanish["Permanent Interment"]?.card ?? {},
);
const mauvrion = card(
  "Mauvrion Skies",
  [1, 2, 3],
  runechantCreators["Mauvrion Skies"]?.card ?? {},
  runechantCreators["Mauvrion Skies"]?.variants ?? {},
);
const unbound = card(
  "Unbound by Shadow",
  [1],
  gateCreators["Unbound by Shadow"]?.card ?? {},
);

describe("the ninth priority rules batch", () => {
  it("keeps Dam the Shadowake's defend trigger unsupported", () => {
    const entry = draftQueue([dam])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "1 Gate when it defends: not drafted yet",
    ]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("Shadow hero's attack");
  });

  it("keeps Deep Recesses' combat-chain effects out of scope", () => {
    const entry = draftQueue([recesses])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Each hero banishes when the combat chain closes: combat is out of scope",
      "Banishing itself when the combat chain closes: combat is out of scope",
    ]);
  });

  it("keeps Rally the Shadow Horde's defence ability unsupported", () => {
    const entry = draftQueue([rally])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Banishing when it's activated: not drafted yet",
    ]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("while defending");
  });

  it("groups Fiddler's Green and keeps its life gain visible", () => {
    const entry = draftQueue([fiddler])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("gain 3/2/1 life");
  });

  it("keeps Permanent Interment's variable banished-zone effect visible", () => {
    const entry = draftQueue([interment])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.factsNote).toContain("face-down");
  });

  it("keeps Mauvrion Skies' pitch amounts separate", () => {
    const entry = draftQueue([mauvrion])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts.map((draft) => draft.pitches)).toEqual([[1], [2], [3]]);
    expect(entry.drafts.map((draft) => draft.draft.notDrafted[0])).toEqual([
      "3 Runechants given to a later card: not drafted yet",
      "2 Runechants given to a later card: not drafted yet",
      "1 Runechant given to a later card: not drafted yet",
    ]);
  });

  it("keeps Unbound by Shadow's conditional attack Gate unsupported", () => {
    const entry = draftQueue([unbound])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "1 Gate if it was played from your banished zone: the engine can't check that yet",
    ]);
  });

  it.each([
    ["Dam the Shadowake", 1],
    ["Deep Recesses of Existence", 3],
    ["Rally the Shadow Horde", 3],
    ["Fiddler's Green", 1],
    ["Permanent Interment", 1],
    ["Mauvrion Skies", 3],
    ["Unbound by Shadow", 1],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});
