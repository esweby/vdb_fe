import { describe, expect, it } from "vitest";
import { cellValue } from "./inherited.ts";

const D = 2;
const row = (
  score: number,
  variantId: string | null = null,
  side: "forsaken" | "usurper" | null = null,
) => ({
  variantId,
  side,
  dimensionId: D,
  score,
});

describe("cellValue", () => {
  it("reports a value set on the cell itself", () => {
    expect(
      cellValue([row(70)], { variantId: null, side: null, dimensionId: D }),
    ).toEqual({
      own: 70,
      inherited: null,
    });
  });

  it("reports what a blank cell inherits from the level above", () => {
    expect(
      cellValue([row(70)], {
        variantId: null,
        side: "usurper",
        dimensionId: D,
      }),
    ).toEqual({
      own: null,
      inherited: 70,
    });
    expect(
      cellValue([row(70), row(40, null, "usurper")], {
        variantId: "red",
        side: "usurper",
        dimensionId: D,
      }),
    ).toEqual({ own: null, inherited: 40 });
  });

  it("reports nothing to inherit when every level above is blank", () => {
    expect(
      cellValue([], { variantId: "red", side: null, dimensionId: D }),
    ).toEqual({
      own: null,
      inherited: null,
    });
  });

  it("follows the README order: variant beats card + side", () => {
    expect(
      cellValue([row(40, null, "forsaken"), row(30, "red")], {
        variantId: "red",
        side: "forsaken",
        dimensionId: D,
      }),
    ).toEqual({ own: null, inherited: 30 });
  });
});
