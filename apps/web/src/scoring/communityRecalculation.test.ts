import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCommunityRecalculation,
  type CommunityJobResult,
} from "./communityRecalculation.ts";

const completed = { status: "completed" } as const;
const refused = {
  status: "deferred",
  reason: "running",
  retryAfter: 30,
} as const;
function setup() {
  const run = vi
    .fn<() => Promise<CommunityJobResult>>()
    .mockResolvedValue(completed);
  const failed = vi.fn();
  return { run, failed, queue: createCommunityRecalculation(run, failed) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("community recalculation countdown", () => {
  it("waits for thirty quiet seconds, restarting after another saved change", async () => {
    const { run, queue } = setup();
    queue.changed();
    await vi.advanceTimersByTimeAsync(20_000);
    queue.changed();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("flushes dirty state immediately and never resends clean state", async () => {
    const { run, queue } = setup();
    queue.changed();
    queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    queue.flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps Undo during an in-flight flush dirty for the next request", async () => {
    const { run, queue } = setup();
    let finish!: (result: CommunityJobResult) => void;
    run.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    queue.changed();
    queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    queue.changed();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(run).toHaveBeenCalledTimes(1);
    finish(completed);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("retries a refused final flush once without another edit, then stops", async () => {
    const { run, failed, queue } = setup();
    run.mockResolvedValue(refused);
    queue.changed();
    queue.flush();
    await vi.advanceTimersByTimeAsync(30_999);
    expect(run).toHaveBeenCalledTimes(1);
    queue.flush();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(failed).toHaveBeenLastCalledWith(true);
  });

  it("honours a cooldown retry delay and merges another flush into its timer", async () => {
    const { run, queue } = setup();
    run.mockResolvedValueOnce({
      status: "deferred",
      reason: "cooldown",
      retryAfter: 7,
    });
    queue.changed();
    queue.flush();
    await vi.advanceTimersByTimeAsync(1_000);
    queue.flush();
    await vi.advanceTimersByTimeAsync(6_999);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("retains state after a network failure for manual retry without an automatic loop", async () => {
    const { run, failed, queue } = setup();
    run.mockRejectedValueOnce(new Error("offline"));
    queue.changed();
    queue.flush();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenLastCalledWith(true);
    queue.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(failed).toHaveBeenLastCalledWith(false);
  });

  it("discards both timers and late responses when the account is disposed", async () => {
    const { run, failed, queue } = setup();
    let finish!: (result: CommunityJobResult) => void;
    run.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    queue.changed();
    queue.flush();
    await vi.advanceTimersByTimeAsync(0);
    queue.dispose();
    failed.mockClear();
    finish(refused);
    queue.changed();
    queue.flush();
    queue.retry();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
  });
});
