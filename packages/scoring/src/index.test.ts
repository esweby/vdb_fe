import { describe, expect, it } from "vitest";
import { normalise } from "./index.ts";

describe("normalise", () => {
  it("maps 0–100 to 0–1", () => {
    expect(normalise(80)).toBe(0.8);
  });
});
