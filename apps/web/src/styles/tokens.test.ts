// M8 "consistent look": pitch colours come from the global tokens (styles/global.css), so red,
// yellow and blue are the same everywhere and a theme can change them in one place.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const PITCH_HEXES = [
  "#d63c35", // red
  "#e6b422", // yellow
  "#d9a514", // a second yellow that had crept in
  "#3b7dd8", // blue
  "#8a5cc7", // pitch 4
];

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? stylesheets(join(dir, e.name))
      : e.name.endsWith(".css")
        ? [join(dir, e.name)]
        : [],
  );
}

describe("colour tokens", () => {
  it("defines the pitch colours once, globally", () => {
    const global = readFileSync(join(SRC, "styles/global.css"), "utf8");
    for (const token of [
      "--pitch-1",
      "--pitch-2",
      "--pitch-3",
      "--pitch-4",
      "--pitch-none",
    ])
      expect(global).toContain(`${token}:`);
  });

  it("doesn't hard-code a pitch colour anywhere else", () => {
    const offenders = stylesheets(SRC)
      .filter((f) => !f.endsWith("styles/global.css"))
      .flatMap((f) => {
        const css = readFileSync(f, "utf8").toLowerCase();
        return PITCH_HEXES.filter((hex) => css.includes(hex)).map(
          (hex) => `${f.slice(SRC.length + 1)} ${hex}`,
        );
      });
    expect(offenders).toEqual([]);
  });
});
