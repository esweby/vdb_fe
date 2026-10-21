// Engine calibration (docs/engine-calibration.md): a plain deck list, as a player would paste
// it, read into names, pitches and copies for the simulated side.
import { describe, expect, it } from "vitest";
import { parseDeckList } from "./deckList.ts";

describe("parseDeckList", () => {
  it("reads copies, names and pitch colours", () => {
    expect(
      parseDeckList(`
        3 Cullingsong Gloomblade (red)
        2x Become the Shadow Lord (Blue)
        1 Nebula Blade
      `),
    ).toEqual([
      { copies: 3, name: "Cullingsong Gloomblade", pitch: 1 },
      { copies: 2, name: "Become the Shadow Lord", pitch: 3 },
      { copies: 1, name: "Nebula Blade", pitch: null },
    ]);
  });

  it("skips blank lines, headings and comments", () => {
    expect(
      parseDeckList(
        "Deck: Mine\n# a note\n\nMain deck\n2 Sigil of Suffering (yellow)",
      ),
    ).toEqual([{ copies: 2, name: "Sigil of Suffering", pitch: 2 }]);
  });

  it("fails loudly on a line it can't read", () => {
    expect(() => parseDeckList("Cullingsong Gloomblade x3 red")).toThrow(
      /line 1/,
    );
  });
});
