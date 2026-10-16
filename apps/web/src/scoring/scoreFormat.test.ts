import { describe, expect, it } from "vitest";
import { formatScore } from "./scoreFormat.ts";

// Scores are stored 0-100 and shown 0-10 (scoring group feedback, 16 Oct 2026: "50 looks like a
// card amount; 5 is more a rating").
describe("formatScore", () => {
  it("shows a stored score out of 10", () => {
    expect(formatScore(70)).toBe("7");
    expect(formatScore(100)).toBe("10");
    expect(formatScore(0)).toBe("0");
  });

  it("keeps one decimal for averages", () => {
    expect(formatScore(85)).toBe("8.5");
    expect(formatScore(83.33)).toBe("8.3");
    expect(formatScore(-50)).toBe("-5");
  });
});
