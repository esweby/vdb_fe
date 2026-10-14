import { describe, expect, it } from "vitest";
import { classifyTypes, isViseraiLegal, type DatasetCard } from "../src/classify.ts";
import fixture from "./fixtures/cards.json" with { type: "json" };

const entries = fixture as DatasetCard[];
const byName = (name: string) => entries.filter((c) => c.name === name);

describe("classifyTypes", () => {
  it("splits a Shadow Runeblade action into class, talent and type", () => {
    expect(classifyTypes(["Shadow", "Runeblade", "Action"])).toEqual({
      mainType: "Action",
      classes: ["Runeblade"],
      talents: ["Shadow"],
      subtypes: [],
    });
  });

  it("keeps weapon subtypes and handedness", () => {
    expect(classifyTypes(["Runeblade", "Weapon", "Sword", "2H"])).toEqual({
      mainType: "Weapon",
      classes: ["Runeblade"],
      talents: [],
      subtypes: ["Sword", "2H"],
    });
  });

  it("keeps the equipment slot as a subtype", () => {
    expect(classifyTypes(["Shadow", "Runeblade", "Equipment", "Off-Hand"]).subtypes).toEqual(["Off-Hand"]);
  });

  it("recognises two-word card types", () => {
    expect(classifyTypes(["Generic", "Defense Reaction"]).mainType).toBe("Defense Reaction");
  });
});

describe("isViseraiLegal", () => {
  const legalNames = [...new Set(entries.filter(isViseraiLegal).map((c) => c.name))].sort();

  it("includes Runeblade, Shadow and Generic cards, weapons and equipment", () => {
    expect(legalNames).toEqual([
      "Abyssal Bite",
      "Arcane Cussing",
      "Arcanite Skullcap",
      "Become the Shadow Lord",
      "Deathly Delight",
      "Fate Foreseen",
      "Grimoire of the Haunt",
      "Nebula Blade",
    ]);
  });

  it.each([
    ["heroes", "Viserai, the Forsaken"],
    ["tokens", "Runechant"],
    ["other classes", "Forsaken Strike"],
    ["Shadow cards of another class", "Battlefield Breaker"],
    ["other talents", "Angelic Attendant"],
    ["banned cards", "Belittle"],
    ["cards not legal in Classic Constructed", "Viserai"],
  ])("excludes %s", (_label, name) => {
    expect(byName(name).length).toBeGreaterThan(0);
    expect(byName(name).some(isViseraiLegal)).toBe(false);
  });
});
