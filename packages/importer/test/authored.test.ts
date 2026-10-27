import { authoredAttributesSchema } from "@vdb/cards";
import { describe, expect, it } from "vitest";
import { allAuthored, batches } from "../src/authored/index.ts";

describe("authored batches", () => {
  it("records Scar's approved life comparison instead of natural go again", () => {
    expect(allAuthored()["Scar for a Scar"]).toMatchObject({
      verified: true,
      card: { goAgain: { conditions: ["less_life_than_opposing_hero"] } },
    });
  });
  it("records Descendancy's three-life limit as a fact, not just a note", () => {
    expect(allAuthored()["Arknight Descendancy"]?.card?.tokens).toContainEqual({
      token: "runechant",
      amount: "X",
      trigger: "on_banished",
      lifePaidUpTo: 3,
    });
  });
  it("has no card in more than one batch", () => {
    expect(() => allAuthored()).not.toThrow();
  });

  for (const [batch, entries] of Object.entries(batches)) {
    describe(batch, () => {
      for (const [name, entry] of Object.entries(entries)) {
        it(`${name} matches the vocabulary`, () => {
          if (entry.card)
            expect(authoredAttributesSchema.parse(entry.card)).toBeTruthy();
          for (const v of Object.values(entry.variants ?? {})) {
            expect(authoredAttributesSchema.parse(v)).toBeTruthy();
          }
        });
      }
    });
  }

  it("includes batch 1, Runechant creators", () => {
    expect(Object.keys(batches)).toContain("01-runechant-creators");
  });

  it("includes batch 2, Gate creators", () => {
    expect(Object.keys(batches)).toContain("02-gate-creators");
  });

  it("includes batch 3, blood debt and banish", () => {
    expect(Object.keys(batches)).toContain("03-blood-debt-and-banish");
  });

  it("includes batch 5, the remaining cards", () => {
    expect(Object.keys(batches)).toContain("05-remaining");
  });

  it("records Call for Backup's defend text as unverified", () => {
    expect(allAuthored()["Call for Backup"]).toEqual({
      verified: false,
      card: {
        notes:
          "When this defends, choose 2 differently named attack action cards in your graveyard. An opponent chooses 1 to banish; put the other on top of your deck.",
      },
    });
  });

  it("records Sink Below's hand-cycle text as unverified", () => {
    expect(allAuthored()["Sink Below"]).toEqual({
      verified: false,
      card: {
        notes:
          "You may put a card from your hand on the bottom of your deck. If you do, draw a card.",
      },
    });
  });

  it("records Looking for a Scrap's optional graveyard cost as unverified", () => {
    expect(allAuthored()["Looking for a Scrap"]).toEqual({
      verified: false,
      card: {
        notes:
          "As an additional cost, you may banish a 1-power card from your graveyard. If you do, this gets +1 power and go again.",
      },
    });
  });

  it("includes batch 4, weapons and equipment", () => {
    expect(Object.keys(batches)).toContain("04-weapons-and-equipment");
  });

  it("links Base of the Mountain to cards that trigger when banished", () => {
    expect(
      batches["04-weapons-and-equipment"]!["Base of the Mountain"]?.card
        ?.supports,
    ).toEqual(
      expect.arrayContaining([{ target: { group: "triggers_when_banished" } }]),
    );
  });

  // The maintainer, 21 Oct 2026: its banished cards defend and go to the graveyard, except with
  // the equipment that banishes defending cards when the chain link closes.
  it("links Base of the Mountain to Reach of the Abyss, which keeps its defenders banished", () => {
    expect(
      batches["04-weapons-and-equipment"]!["Base of the Mountain"]?.card
        ?.supports,
    ).toContainEqual(
      expect.objectContaining({ target: { card: "Reach of the Abyss" } }),
    );
  });
});

// Reported by the scoring group, 16 Oct 2026: the pre-release data gave Shadowrealm Walker
// Shadowrealm Ripper's text. The corrected text: banish a card from hand when it attacks; if
// it's Shadow, create a Gate to i'Arathael token. Checked by the maintainer, 16 Oct 2026.
describe("corrected cards", () => {
  it("Shadowrealm Walker creates a Gate, rather than gaining power (maintainer checked)", () => {
    const walker = allAuthored()["Shadowrealm Walker"]!;
    expect(walker.verified).toBe(true);
    expect(walker.card?.tokens).toEqual([
      {
        token: "gate",
        amount: 1,
        trigger: "on_attack",
        conditions: ["banished_card_is_shadow"],
      },
    ]);
    expect(walker.card?.conditionalBonuses).toBeUndefined();
  });

  it("Darkest Hour's note matches the corrected blue (+2)", () => {
    expect(allAuthored()["Darkest Hour"]!.card?.notes).toContain("+4/+3/+2");
  });
});

// "Can you defeat him please" (the maintainer, 20 Oct 2026, of a player stress testing with
// Dimenxxional Crossroads). It pays off cards played from the banished zone, and it's destroyed
// when you lose life on your turn, which blood debt does in your end phase.
describe("Dimenxxional Crossroads", () => {
  const crossroads = () => allAuthored()["Dimenxxional Crossroads"]!.card!;

  it("pays off cards played from the banished zone", () => {
    expect(crossroads().roles?.add).toContain("banish_play_payoff");
  });

  it("is destroyed when you lose life", () => {
    expect(crossroads().destroyedOnLifeLoss).toBe(true);
  });

  // The maintainer, 20 Oct 2026: "your assumptions are right". A card of that type played earlier
  // in the turn, from anywhere, means no damage.
  it("is verified, with a note that any earlier card of that type counts", () => {
    expect(allAuthored()["Dimenxxional Crossroads"]!.verified).toBe(true);
    expect(crossroads().notes).toContain("from anywhere");
  });
});
