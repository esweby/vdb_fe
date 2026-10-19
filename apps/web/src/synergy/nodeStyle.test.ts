// How a card is drawn in the explorer (maintainer, 19 Oct 2026: nodes a little more interesting,
// without card art, as the image host doesn't allow WebGL to use its images).
import { describe, expect, it } from "vitest";
import { ENGINE_COLOURS } from "./colours.ts";
import { nodeStyle } from "./nodeStyle.ts";

const theme = { surface: "#ffffff", fg: "#111111" };
const node = (over = {}) => ({
  engine: "gate" as const,
  inCore: false,
  selected: false,
  ...over,
});

describe("nodeStyle", () => {
  it("is a ring in the card's engine colour around a plain centre", () => {
    expect(nodeStyle(node(), theme)).toEqual({
      color: theme.surface,
      ringColor: ENGINE_COLOURS.gate,
      ringSize: 0.3,
    });
  });

  it("fills the selected card in its engine colour", () => {
    expect(nodeStyle(node({ selected: true }), theme).color).toBe(
      ENGINE_COLOURS.gate,
    );
  });

  it("gives your core's cards a thicker ring in the text colour", () => {
    expect(nodeStyle(node({ inCore: true }), theme)).toMatchObject({
      ringColor: theme.fg,
      ringSize: 0.45,
    });
  });

  it("uses grey for a card in no engine", () => {
    expect(nodeStyle(node({ engine: null }), theme).ringColor).toBe(
      ENGINE_COLOURS.none,
    );
  });
});
