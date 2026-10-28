import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { analyseGoals } from "./goalGaps.ts";
const card = sampleCards[0]!;
const entry = {
  card,
  variant: card.variants[0]!,
  quantity: 3,
  sideboard: false,
};
describe("goal analysis", () => {
  it("requires an explicit goal", () => {
    expect(analyseGoals([entry], [])).toEqual([]);
  });
  it("separates main deck support from sideboard options", () => {
    const [result] = analyseGoals(
      [{ ...entry, sideboard: true }],
      ["runechant"],
    );
    expect(result).toMatchObject({
      mainCopies: 0,
      sideboardCopies: 3,
      status: "sideboard",
    });
  });
  it("reports an absent selected goal even when the deck never relied on it", () => {
    expect(analyseGoals([], ["gate"])[0]).toMatchObject({ status: "missing" });
  });
  it("does not treat support as proof that a goal is satisfied", () => {
    expect(analyseGoals([entry], ["runechant"])[0]).toMatchObject({
      status: "present",
      mainCopies: 3,
    });
  });
  it("excludes equipment and does not require support in each pitch", () => {
    const weapon = sampleCards[3]!;
    const results = analyseGoals(
      [
        entry,
        {
          card: weapon,
          variant: weapon.variants[0]!,
          quantity: 1,
          sideboard: false,
        },
      ],
      ["runechant", "damage", "defence"],
    );
    expect(results.map((result) => result.mainCopies)).toEqual([3, 3, 3]);
  });
  it("uses each variant's recorded power, defence and authored roles", () => {
    const changed = {
      ...entry,
      variant: {
        ...entry.variant,
        power: 0,
        defense: null,
        attributes: {
          ...entry.variant.attributes,
          roles: {
            add: ["disruption" as const],
            remove: ["runechant_generator" as const],
          },
        },
      },
    };
    const results = analyseGoals(
      [changed],
      ["runechant", "damage", "disruption", "defence"],
    );
    expect(results.map((result) => result.mainCopies)).toEqual([0, 0, 3, 0]);
  });
});
