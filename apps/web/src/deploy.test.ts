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

  // Security audit, 16 Oct 2026: if a script were ever injected, the browser wouldn't run it
  // or let it send data anywhere the app doesn't already talk to.
  it("sets a Content-Security-Policy that allows only what the app uses", () => {
    const csp =
      config().match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? "";
    const directive = (name: string) =>
      csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `)) ?? "";
    expect(directive("default-src")).toBe("default-src 'self'");
    // No inline or third-party scripts.
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(directive("connect-src")).toContain(
      "https://gmqdtqgkqygepsbrgomk.supabase.co",
    );
    expect(directive("img-src")).toContain(
      "https://legendstory-production-s3-public.s3.amazonaws.com",
    );
    expect(directive("style-src")).toContain("https://fonts.googleapis.com");
    expect(directive("font-src")).toContain("https://fonts.gstatic.com");
    expect(directive("worker-src")).toBe("worker-src 'self'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
  });
});
