import { describe, expect, it } from "vitest";
import { groupsOf } from "../src/groups.ts";

const card = (
  name: string,
  type: string,
  subtypes: string[] = [],
  classes: string[] = ["Runeblade"],
) => ({ name, type, subtypes, classes });

describe("groupsOf", () => {
  it("puts the sinchants in runechant_aura and runeblade_aura", () => {
    expect(groupsOf(card("Runechant of Lust", "instant", ["Aura"]))).toEqual([
      "runechant_aura",
      "runeblade_aura",
    ]);
  });

  it("doesn't treat a non-aura with Runechant in its name as a Runechant aura", () => {
    expect(groupsOf(card("Reduce to Runechant", "defense_reaction"))).toEqual(
      [],
    );
  });

  it("finds Runeblade auras, attack actions and non-attack actions", () => {
    expect(groupsOf(card("Arcane Cussing", "action", ["Aura"]))).toEqual([
      "runeblade_aura",
      "runeblade_non_attack_action",
    ]);
    expect(groupsOf(card("Hocus Pocus", "attack_action", ["Attack"]))).toEqual([
      "runeblade_attack_action",
    ]);
    expect(groupsOf(card("Read the Runes", "action"))).toEqual([
      "runeblade_non_attack_action",
    ]);
  });

  it("puts cards with the Rune Gate keyword in rune_gate", () => {
    expect(
      groupsOf({
        ...card("Vantom Banshee", "attack_action", ["Attack"], ["Runeblade"]),
        keywords: ["Blood Debt", "Rune Gate"],
      }),
    ).toEqual(["runeblade_attack_action", "rune_gate"]);
  });

  it("puts generic and Shadow-only cards in no Runeblade group", () => {
    expect(
      groupsOf(card("Fate Foreseen", "defense_reaction", [], ["Generic"])),
    ).toEqual([]);
    expect(groupsOf(card("Abyssal Bite", "action", [], []))).toEqual([]);
  });
});
