export type GateDecision =
  | { status: "started"; token: string }
  | { status: "deferred"; reason: "running" | "cooldown"; retryAfter: number };

export async function runGatedJob<T extends object>(
  caller: "scheduled" | "server" | "user",
  deps: {
    acquire: (scheduled: boolean) => Promise<GateDecision>;
    run: (token: string) => Promise<T>;
    release: (token: string) => Promise<void>;
    refused: (decision: Extract<GateDecision, { status: "deferred" }>) => void;
  },
): Promise<
  ({ status: "completed" } & T) | Extract<GateDecision, { status: "deferred" }>
> {
  const decision = await deps.acquire(caller === "scheduled");
  if (decision.status === "deferred") {
    deps.refused(decision);
    return decision;
  }
  try {
    return { status: "completed", ...(await deps.run(decision.token)) };
  } finally {
    await deps.release(decision.token);
  }
}
