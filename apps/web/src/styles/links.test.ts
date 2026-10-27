// M8 keyboard and screen-reader pass: a link inside text or a list is underlined, not marked by
// colour alone (the maintainer, 27 Oct 2026). Links styled as something else (tabs, buttons,
// card images) bring their own class and keep their own look. Checked against the stylesheet's
// rules: jsdom's built-in link style outranks the app's, so it can't compute the result.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(import.meta.dirname, "global.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(
  ([, sel, body]) => ({
    selectors: (sel ?? "").split(",").map((s) => s.trim()),
    body: body ?? "",
  }),
);
const underlined = (selector: string) =>
  rules.some(
    (r) =>
      r.selectors.includes(selector) &&
      /text-decoration(-line)?:\s*underline/.test(r.body),
  );

describe("links in text", () => {
  it("underlines a plain link inside a paragraph, list item, definition or table cell", () => {
    for (const container of ["p", "li", "dd", "td"])
      expect(underlined(`${container} a:not([class])`), container).toBe(true);
  });

  it("leaves links styled as something else, and links elsewhere, to their own look", () => {
    const plain = rules.find((r) => r.selectors.includes("a"));
    expect(plain?.body).toMatch(/text-decoration:\s*none/);
    expect(underlined("p a")).toBe(false);
    expect(underlined("li a")).toBe(false);
  });
});
