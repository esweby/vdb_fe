export type CommunityJobResult =
  | { status: "completed" }
  | { status: "deferred"; reason: "running" | "cooldown"; retryAfter: number };

export function createCommunityRecalculation(
  run: () => Promise<CommunityJobResult>,
  failed: (value: boolean) => void,
) {
  let generation = 0;
  let completed = 0;
  let retried = -1;
  let inFlight = false;
  let disposed = false;
  let dueAt: number | null = null;
  let retryAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function arm() {
    clearTimeout(timer);
    timer = undefined;
    if (disposed || inFlight || generation === completed || dueAt === null)
      return;
    if (dueAt <= Date.now()) void send();
    else
      timer = setTimeout(() => {
        timer = undefined;
        void send();
      }, dueAt - Date.now());
  }

  async function send() {
    if (disposed || inFlight || generation === completed) return;
    const sending = generation;
    const isRetry = retried === sending;
    dueAt = null;
    inFlight = true;
    try {
      const result = await run();
      if (disposed) return;
      if (result.status === "deferred") {
        retryAt = Date.now() + Math.ceil(result.retryAfter * 1000) + 1000;
        if (generation > sending) {
          dueAt = Math.max(dueAt ?? Date.now(), retryAt);
        } else if (!isRetry) {
          retried = sending;
          dueAt = retryAt;
        } else failed(true);
      } else {
        completed = sending;
        retryAt = 0;
        failed(false);
      }
    } catch {
      if (!disposed) failed(true);
    } finally {
      inFlight = false;
      arm();
    }
  }

  return {
    changed() {
      if (disposed) return;
      generation += 1;
      failed(false);
      dueAt = Math.max(Date.now() + 30_000, retryAt);
      arm();
    },
    flush() {
      if (disposed || generation === completed) return;
      dueAt = Math.max(Date.now(), retryAt);
      arm();
    },
    retry() {
      if (disposed || generation === completed) return;
      retried = -1;
      failed(false);
      dueAt = Math.max(Date.now(), retryAt);
      arm();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
