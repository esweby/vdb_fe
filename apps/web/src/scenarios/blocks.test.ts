// How a condition block reads (README "Why runs failed": failures are grouped by block, so
// each block needs a plain label).
import { describe, expect, it } from "vitest";
import { blockLabel } from "./blocks.ts";

describe("blockLabel", () => {
  it("reads a count of matching cards", () => {
    expect(blockLabel({ filter: { pitch: 3 }, min: 1 })).toBe(
      "at least 1 blue card",
    );
    expect(
      blockLabel({
        filter: { trait: "shadow", type: "attack_action" },
        min: 2,
        distinct: true,
      }),
    ).toBe("at least 2 different Shadow attack action cards");
  });

  it("names a specific card, and reads exactly, at most and none", () => {
    expect(
      blockLabel({
        filter: { name: "Become the Shadow Lord" },
        min: 1,
        max: 1,
      }),
    ).toBe("exactly 1 Become the Shadow Lord");
    expect(blockLabel({ filter: { pitch: 1 }, min: 0, max: 2 })).toBe(
      "at most 2 red cards",
    );
    expect(
      blockLabel({ filter: { role: "gate_generator" }, min: 0, max: 0 }),
    ).toBe("no Gate generator cards");
  });

  it("reads a total of something made", () => {
    expect(blockLabel({ filter: {}, total: "runechants", min: 3 })).toBe(
      "at least 3 Runechants made",
    );
    expect(
      blockLabel({ filter: { trait: "shadow" }, total: "gates", min: 1 }),
    ).toBe("at least 1 Gate made by Shadow cards");
  });
});

describe("stepLabel", () => {
  it("reads each step in plain words", async () => {
    const { stepLabel } = await import("./blocks.ts");
    expect(
      stepLabel({
        turn: "each",
        do: "arsenal",
        filter: { trait: "blood_debt" },
      }),
    ).toBe("Each turn, put the lowest-pitch Blood debt card in arsenal");
    expect(stepLabel({ turn: 2, do: "draw", count: 2 })).toBe("Turn 2, draw 2");
    expect(stepLabel({ turn: 1, do: "block", count: 1 })).toBe(
      "Turn 1, block with 1 card",
    );
    expect(stepLabel({ turn: 1, do: "pitch", filter: { pitch: 3 } })).toBe(
      "Turn 1, pitch the lowest-pitch blue card",
    );
  });
});
