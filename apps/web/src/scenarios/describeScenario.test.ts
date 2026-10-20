// The scenarios form reads back as one sentence (the maintainer, 19 Oct 2026: the old form was
// hard to read back), built from the definition the run will use.
import type { ScenarioDefinition } from "@vdb/engine";
import { describe, expect, it } from "vitest";
import { describeScenario } from "./describeScenario.ts";

const base: ScenarioDefinition = {
  version: 1,
  name: "Test",
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition: {
    all: [{ label: "at least 1 blue card", filter: { pitch: 3 }, min: 1 }],
  },
};

describe("describeScenario", () => {
  it("reads the opening hand plainly", () => {
    expect(describeScenario(base)).toBe(
      "In your opening hand: at least 1 blue card.",
    );
  });

  it("reads a later turn, its zones, fixed cards and steps, then the conditions", () => {
    expect(
      describeScenario({
        ...base,
        horizon: 3,
        access: ["hand", "arsenal"],
        fixed: [{ name: "Become the Shadow Lord", zone: "hand" }],
        steps: [{ turn: "each", do: "arsenal", filter: { pitch: 3 } }],
        condition: {
          all: [
            { label: "at least 1 blue card", filter: { pitch: 3 }, min: 1 },
            {
              label: "at least 3 Runechants made",
              filter: {},
              total: "runechants",
              min: 3,
            },
          ],
        },
      }),
    ).toBe(
      "By turn 3 (a fresh hand each turn), looking at your hand and arsenal, starting with Become the Shadow Lord in hand, and each turn putting the lowest-pitch blue card in arsenal: at least 1 blue card and at least 3 Runechants made.",
    );
  });

  it("reads 'any' as either … or, and nests groups in brackets", () => {
    expect(
      describeScenario({
        ...base,
        horizon: 2,
        turnModel: "drawUp",
        condition: {
          any: [
            { label: "at least 1 blue card", filter: { pitch: 3 }, min: 1 },
            {
              all: [
                { label: "a Gate maker", filter: {}, min: 1 },
                { label: "a Gate target", filter: {}, min: 1 },
              ],
            },
          ],
        },
      }),
    ).toBe(
      "By turn 2 (keeping the hand and drawing up to 4), looking at your hand: either at least 1 blue card or (a Gate maker and a Gate target).",
    );
  });
});
