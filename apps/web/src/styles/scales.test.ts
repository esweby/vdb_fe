// M8 "consistent look": font sizes and spacing come from the shared scales in styles/global.css
// (--text-* and --space-*), so the app has a handful of sizes rather than fifty.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");

// Stylesheets not yet moved onto the scales. Each is moved in its own small PR; remove it here
// when it is. The test fails if a listed file is already clean, so the list only shrinks.
const NOT_YET_ON_SCALES = new Set([
  "decks/Decks.module.css",
  "decks/Goldfish.module.css",
  "scoring/CardScoringPage.module.css",
]);

const TEXT_TOKENS = [
  "--text-2xs",
  "--text-xs",
  "--text-sm",
  "--text-md",
  "--text-lg",
  "--text-xl",
  "--text-2xl",
  "--text-3xl",
  "--text-display",
];
const SPACE_TOKENS = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--space-7",
  "--space-8",
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

const DECLARATION =
  /(?:^|[;{\s])(font-size|margin(?:-[a-z]+)*|padding(?:-[a-z]+)*|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g;

// Text-relative sizes (em, %) and keywords are fine: they follow the scale of the text around
// them. So are hairline nudges up to 0.2rem or 3px, which are optical tweaks, not spacing.
function allowed(part: string, property: string): boolean {
  if (/^-?0$|^auto$|^inherit$|^-?[\d.]+(em|%)$/.test(part)) return true;
  if (property === "font-size") return false;
  const rem = part.match(/^-?([\d.]+)rem$/);
  if (rem) return Number(rem[1]) <= 0.2;
  const px = part.match(/^-?([\d.]+)px$/);
  return px !== null && Number(px[1]) <= 3;
}

function offScale(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(DECLARATION)].flatMap(
    ([, property = "", value = ""]) => {
      const rest = value
        .replace(/!important/, "")
        .replace(/calc\(-1 \* var\(--(space|text)-[\w-]+\)\)/g, "")
        .replace(/var\(--(space|text)-[\w-]+\)/g, "")
        .trim();
      return rest
        .split(/\s+/)
        .filter((part) => part && !allowed(part, property))
        .map((part) => `${property}: ${part}`);
    },
  );
}

describe("type and spacing scales", () => {
  const global = readFileSync(join(SRC, "styles/global.css"), "utf8");

  it("defines every step once, globally", () => {
    for (const token of [...TEXT_TOKENS, ...SPACE_TOKENS])
      expect(global).toContain(`${token}:`);
  });

  it("only uses steps that exist", () => {
    const unknown = stylesheets(SRC).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/var\((--(?:text|space)-[\w-]+)\)/g)]
        .map(([, token = ""]) => token)
        .filter((t) => !TEXT_TOKENS.includes(t) && !SPACE_TOKENS.includes(t))
        .map((t) => `${f.slice(SRC.length + 1)} ${t}`),
    );
    expect(unknown).toEqual([]);
  });

  it("sizes text and spaces things from the scales", () => {
    const offenders = stylesheets(SRC)
      .map((f) => f.slice(SRC.length + 1))
      .filter((name) => !NOT_YET_ON_SCALES.has(name))
      .flatMap((name) =>
        offScale(
          name === "styles/global.css"
            ? // Fields stay at 16px or more on touch screens, or iOS zooms in on focus.
              global.replace("max(16px, 1em)", "inherit")
            : readFileSync(join(SRC, name), "utf8"),
        ).map((o) => `${name} ${o}`),
      );
    expect(offenders).toEqual([]);
  });

  it("lists only stylesheets that still need moving", () => {
    const done = [...NOT_YET_ON_SCALES].filter(
      (name) => offScale(readFileSync(join(SRC, name), "utf8")).length === 0,
    );
    expect(done).toEqual([]);
  });

  it("catches off-scale values and lets scale and text-relative ones through", () => {
    expect(
      offScale(`.a { padding: 0.4rem var(--space-2); font-size: 0.85rem; }
        .b { margin: 0 auto calc(-1 * var(--space-1)); gap: 2px; font-size: 0.85em; }
        /* margin: 9rem */ .c { font-size: var(--text-sm); margin-top: 3rem !important; }`),
    ).toEqual(["padding: 0.4rem", "font-size: 0.85rem", "margin-top: 3rem"]);
  });
});
