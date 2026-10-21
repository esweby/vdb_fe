import { describe, expect, it } from "vitest";
import { pitchName, pitchesShown, redFirst } from "./pitch.ts";

describe("pitch", () => {
  it("names pitch 4 Purple, as the dataset and FaBlazing do (Soul of Existence)", () => {
    expect([1, 2, 3, 4].map(pitchName)).toEqual([
      "Red",
      "Yellow",
      "Blue",
      "Purple",
    ]);
  });

  it("sorts purple after blue, before no pitch", () => {
    const sorted = redFirst([{ pitch: null }, { pitch: 4 }, { pitch: 3 }]);
    expect(sorted.map((v) => v.pitch)).toEqual([3, 4, null]);
  });

  it("shows red, yellow and blue in a pitch mix, and purple only when there is some", () => {
    expect(pitchesShown({ 1: 3, 3: 2 })).toEqual([1, 2, 3]);
    expect(pitchesShown({ 1: 3, 4: 0 })).toEqual([1, 2, 3]);
    expect(pitchesShown({ 1: 3, 4: 1 })).toEqual([1, 2, 3, 4]);
  });
});
