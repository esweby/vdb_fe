// UNVERIFIED final-pair drafts, pending the maintainer's game-logic review.
import { describe, expect, it } from "vitest";
import { parseTriggers, verifiedRulesFor } from "@vdb/engine/rules";
import { allAuthored } from "../../../../packages/importer/src/authored/index.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";
import { draftEffects } from "./draftEffects.ts";

const card = (name: string) => ({
  ...sampleCards[0]!,
  name,
  type: name === "Cull" ? "action" : "attack_action",
  attributes: {
    ...sampleCards[0]!.attributes,
    tokens: [],
    banishesOwn: [],
    hasUsurp: false,
    hasGoAgain: false,
    ...allAuthored()[name]?.card,
  },
  variants: [
    { ...sampleCards[0]!.variants[0]!, pitch: 1, cost: 0, attributes: {} },
  ],
});

describe("the final draft pair", () => {
  it.each(["Cull", "Scar for a Scar"])(
    "makes %s complete but not verified",
    (name) => {
      const entry = draftQueue([card(name)])[0];
      expect(entry).toBeDefined();
      expect(entry!.status).toBe("complete");
      expect(entry!.verified).toBe(false);
      expect(entry!.drafts[0]!.draft.notDrafted).toEqual([]);
      expect(verifiedRulesFor(name, 1)).toBeUndefined();
    },
  );

  it("models Cull's own banish and instant permission, not the opponent's hand", () => {
    const source = card("Cull");
    const draft = draftEffects(source, source.variants[0]!);
    expect(draft.rules).toMatchObject({
      playableFromBanish: true,
      instantWhen: "hero_lost_life_this_turn",
      effects: [{ op: "banish", from: "hand", amount: 1 }],
    });
    expect(draft.outOfScope.join(" ")).toContain("opposing heroes");
    expect(draft.description.join(" ")).toContain("instant");
  });

  it("keeps Scar's go again conditional even with stale imported keyword data", () => {
    const source = card("Scar for a Scar");
    source.attributes.hasGoAgain = true;
    const draft = draftEffects(source, source.variants[0]!);
    expect(draft.rules.goAgain).toBe(false);
    expect(draft.rules.triggers?.[0]?.effects).toMatchObject([
      { op: "ifAnswered", condition: "less_life_than_opposing_hero" },
    ]);
    expect(() => parseTriggers(draft.rules.triggers)).not.toThrow();
    expect(draft.description.join(" ")).toContain("player answers");
  });
});
