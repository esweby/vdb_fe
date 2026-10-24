import { describe, expect, it, vi } from "vitest";
import { runGatedJob, type GateDecision } from "./runJob.ts";

function dependencies(
  decision: GateDecision = { status: "started", token: "lease-one" },
) {
  return {
    acquire: vi.fn(async (_scheduled: boolean) => decision),
    run: vi.fn(async (_token: string) => ({ rows: 2 })),
    release: vi.fn(async (_token: string) => {}),
    refused: vi.fn(),
  };
}

describe("community job gate", () => {
  it.each(["user", "server", "scheduled"] as const)(
    "only a verified scheduled caller bypasses cooldown: %s",
    async (caller) => {
      const deps = dependencies();
      expect(await runGatedJob(caller, deps)).toEqual({
        status: "completed",
        rows: 2,
      });
      expect(deps.acquire).toHaveBeenCalledWith(caller === "scheduled");
      expect(deps.run).toHaveBeenCalledWith("lease-one");
      expect(deps.release).toHaveBeenCalledWith("lease-one");
    },
  );

  it.each(["running", "cooldown"] as const)(
    "a %s refusal performs no aggregate reads or writes",
    async (reason) => {
      const decision = { status: "deferred", reason, retryAfter: 30 } as const;
      const deps = dependencies(decision);
      expect(await runGatedJob("user", deps)).toEqual(decision);
      expect(deps.run).not.toHaveBeenCalled();
      expect(deps.release).not.toHaveBeenCalled();
      expect(deps.refused).toHaveBeenCalledWith(decision);
    },
  );

  it("a gate storage error fails closed", async () => {
    const deps = dependencies();
    deps.acquire.mockRejectedValue(new Error("storage unavailable"));
    await expect(runGatedJob("user", deps)).rejects.toThrow(
      "storage unavailable",
    );
    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
  });

  it("releases the same lease when computation fails", async () => {
    const deps = dependencies();
    deps.run.mockRejectedValue(new Error("computation failed"));
    await expect(runGatedJob("user", deps)).rejects.toThrow(
      "computation failed",
    );
    expect(deps.release).toHaveBeenCalledWith("lease-one");
  });
});
