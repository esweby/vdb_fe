// @vitest-environment node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const executable = fileURLToPath(
  new URL("../../scripts/compare-play-patterns.ts", import.meta.url),
);
const invoke = (args: string[], url = "http://127.0.0.1:54321") =>
  spawnSync(
    process.execPath,
    ["--experimental-transform-types", executable, ...args],
    { encoding: "utf8", env: { ...process.env, SUPABASE_URL: url } },
  );
const args = [
  "--deck",
  "missing.txt",
  "--config",
  "missing.json",
  "--out",
  "missing-report.json",
];

describe("play-pattern comparison CLI safeguards", () => {
  it("requires the deck, configuration and output paths", () => {
    const result = invoke([]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Usage:/);
  });

  it("refuses hosted endpoints before reading files or connecting", () => {
    const result = invoke(args, "https://example.supabase.co");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/local|loopback/i);
    expect(result.stdout).toBe("");
  });

  it("refuses an existing output rather than overwriting evidence", () => {
    const result = invoke([...args.slice(0, -1), executable]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/exists|overwrite/i);
  });

  it("requires an explicit seed for opening-turn exploration", () => {
    const result = invoke([...args, "--explore"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/exploration requires.*seed/i);
  });

  it("does not send exploration to a hosted endpoint", () => {
    const result = invoke(
      [...args, "--explore", "--seed", "17"],
      "https://example.supabase.co",
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/local|loopback/i);
  });
});
