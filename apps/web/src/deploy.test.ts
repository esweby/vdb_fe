// The Netlify set-up lives in the repo (netlify.toml at the root), not only in Netlify's UI.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");
const config = () => readFileSync(join(ROOT, "netlify.toml"), "utf8");

describe("Netlify config", () => {
  it("builds the web app from the repo root and publishes its dist folder", () => {
    expect(existsSync(join(ROOT, "netlify.toml"))).toBe(true);
    expect(config()).toMatch(/command\s*=\s*"npm run build -w @vdb\/web"/);
    expect(config()).toMatch(/publish\s*=\s*"apps\/web\/dist"/);
    expect(config()).toMatch(/NODE_VERSION\s*=\s*"24"/);
  });

  it("sends every path to the app, so deep links and refreshes don't 404", () => {
    expect(config()).toMatch(
      /\[\[redirects\]\]\s*from\s*=\s*"\/\*"\s*to\s*=\s*"\/index\.html"\s*status\s*=\s*200/,
    );
  });
});
