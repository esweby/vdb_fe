import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { supabaseScoreRepository } from "./scoreRepository.ts";

function repository(data: unknown, error: unknown = null) {
  return supabaseScoreRepository({
    functions: { invoke: async () => ({ data, error }) },
  } as unknown as SupabaseClient);
}

describe("community job responses", () => {
  it("preserves a server refusal and its retry delay", async () => {
    const decision = { status: "deferred", reason: "running", retryAfter: 30 };
    expect(await repository(decision).runCommunityJob()).toEqual(decision);
  });

  it.each([
    { status: "completed", rows: 3 },
    { rows: 3, version: 123 },
  ])(
    "accepts successful responses during separate server and web deployments",
    async (data) => {
      expect(await repository(data).runCommunityJob()).toEqual({
        status: "completed",
      });
    },
  );

  it.each([
    null,
    {},
    { status: "deferred", reason: "running", retryAfter: -1 },
    { status: "deferred", reason: "other", retryAfter: 30 },
  ])(
    "rejects malformed responses without treating dirty state as updated",
    async (data) => {
      await expect(repository(data).runCommunityJob()).rejects.toThrow();
    },
  );

  it("does not swallow endpoint errors", async () => {
    await expect(
      repository(null, new Error("offline")).runCommunityJob(),
    ).rejects.toThrow("offline");
  });
});
