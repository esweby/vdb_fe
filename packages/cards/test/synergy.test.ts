// Derived synergy rules (docs/synergy-rules.md). Directions and rule sets from the maintainer,
// 19 Oct 2026; default weights UNVERIFIED (admins tune them).
// Real cards: the verified attributes of 24 cards, exported from a local import (19 Oct 2026).
import { describe, expect, it } from "vitest";
import {
  deriveSynergies,
  SYNERGY_RULES,
  type SynergyCard,
  type SynergyEdge,
} from "../src/synergy.ts";
import fixture from "./fixtures/synergy-cards.json" with { type: "json" };

const cards: SynergyCard[] = Object.entries(fixture).map(([name, c]) => ({
  ...(c as Omit<SynergyCard, "id" | "name">),
  id: name,
  name,
}));

const edges = deriveSynergies(cards);
const edge = (
  from: string,
  to: string,
  list: SynergyEdge[] = edges,
): SynergyEdge | undefined => list.find((e) => e.from === from && e.to === to);

describe("synergy rules", () => {
  it("each rule has a unique id, a description and a default weight from 0 to 1", () => {
    const ids = SYNERGY_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of SYNERGY_RULES) {
      expect(rule.description).not.toBe("");
      expect(rule.weight).toBeGreaterThan(0);
      expect(rule.weight).toBeLessThanOrEqual(1);
    }
  });
});

describe("deriveSynergies: role fits", () => {
  it("a Gate generator helps a Gate target, and it enables traverse", () => {
    expect(edge("Become the Shadow Lord", "Abyssal Bite")).toMatchObject({
      weight: 0.8,
      engine: "gate",
      traverse: true,
    });
  });

  it("is directed: the Gate target doesn't help the Gate generator", () => {
    expect(edge("Abyssal Bite", "Become the Shadow Lord")).toBeUndefined();
  });

  it("banishers help cards that play from banish, self-banishers less", () => {
    expect(edge("Blood Tribute", "Abyssal Bite")?.weight).toBe(0.7);
    expect(edge("Carrion Husk", "Abyssal Bite")?.weight).toBe(0.4);
  });

  it("a hand banisher lets you choose the banished card's type; a deck banisher doesn't", () => {
    expect(edge("Become the Shadow Lord", "Ebon Fold")?.weight).toBe(0.6);
    expect(edge("Blood Tribute", "Ebon Fold")?.weight).toBe(0.3);
  });

  it("banishers fire 'when banished' effects", () => {
    expect(edge("Blood Tribute", "Arknight Descendancy")).toMatchObject({
      weight: 0.7,
      reasons: expect.arrayContaining(["banish-fires-banish-trigger"]),
    });
  });

  it("banish-play payoffs get edges from both Gate makers and banishers (maintainer, 19 Oct 2026)", () => {
    expect(
      edge("Become the Shadow Lord", "Shadowrealm Reaper")?.reasons,
    ).toEqual(
      expect.arrayContaining([
        "gate-feeds-banish-play-payoff",
        "banish-feeds-banish-play-payoff",
      ]),
    );
    expect(edge("Blood Tribute", "Shadowrealm Reaper")?.reasons).toContain(
      "banish-feeds-banish-play-payoff",
    );
  });

  it("auras feed aura payoffs, and go again and Eloquence feed tempo payoffs", () => {
    expect(edge("Become the Shadow Lord", "Condemn to Slaughter")?.weight).toBe(
      0.5,
    );
    expect(edge("Mauvrion Skies", "Bounding Demigon")?.weight).toBe(0.5);
    expect(edge("Eloquent Eulogy", "Revel in Runeblood")?.weight).toBe(0.5);
  });

  it("Usurp cards feed what rewards usurping", () => {
    expect(edge("Murmuring Gloomblade", "Runechant of Lust")).toMatchObject({
      weight: 0.8,
      engine: "usurp",
    });
  });

  it("Runechants don't link to attacks: attacks spend them anyway (maintainer, 15 Oct 2026)", () => {
    expect(edge("Arcane Cussing", "Abyssal Bite")).toBeUndefined();
  });

  it("a card has no edge to itself", () => {
    expect(edges.filter((e) => e.from === e.to)).toEqual([]);
  });
});

describe("deriveSynergies: enabling links (maintainer, 19 Oct 2026)", () => {
  it("a Runechant maker enables a Rune Gate card", () => {
    expect(edge("Revel in Runeblood", "Widespread Ruin")).toMatchObject({
      weight: 0.4,
      engine: "runechant",
    });
  });

  it("Runechant makers and sinchants enable usurp cards", () => {
    expect(edge("Arcane Cussing", "Murmuring Gloomblade")?.weight).toBe(0.6);
    expect(edge("Runechant of Envy", "Murmuring Gloomblade")?.weight).toBe(0.6);
  });

  it("a hand banisher puts a blood debt card where a Gate can play it, enabling traverse (Cull)", () => {
    const cull = edge("Cull", "Abyssal Bite");
    expect(cull?.reasons).toEqual(
      expect.arrayContaining([
        "hand-banish-feeds-gate-target",
        "banish-feeds-plays-from-banish",
      ]),
    );
    expect(cull?.traverse).toBe(true);
  });

  it("takes the highest matching weight, not the sum", () => {
    // Cull: plays from banish (0.7) and Gate target (0.6).
    expect(edge("Cull", "Abyssal Bite")?.weight).toBe(0.7);
  });
});

describe("deriveSynergies: direct references", () => {
  it("a tutor helps each card it can find", () => {
    expect(edge("Sinspeaker Gloomblade", "Runechant of Envy")).toMatchObject({
      weight: 0.6,
      reasons: ["tutor-finds"],
    });
  });

  it("a card that lets another be played from banish helps it", () => {
    expect(edge("Embrace Sin", "Runechant of Lust")?.weight).toBe(0.8);
  });

  it("an authored 'supports' link helps each card in its group", () => {
    expect(edge("Envelop in Darkness", "Widespread Ruin")).toMatchObject({
      weight: 0.7,
      reasons: expect.arrayContaining([
        "supports",
        "runechant-enables-rune-gate",
      ]),
    });
  });
});

describe("deriveSynergies: weights set by admins", () => {
  it("an admin weight replaces the rule's default", () => {
    const tuned = deriveSynergies(cards, { "usurp-feeds-usurp-payoff": 0.3 });
    expect(
      edge("Murmuring Gloomblade", "Runechant of Lust", tuned)?.weight,
    ).toBe(0.3);
  });

  it("a weight of 0 turns the rule off", () => {
    const off = deriveSynergies(cards, { "usurp-feeds-usurp-payoff": 0 });
    expect(
      edge("Murmuring Gloomblade", "Runechant of Lust", off),
    ).toBeUndefined();
  });
});
