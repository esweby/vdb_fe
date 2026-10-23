import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { supabaseDeckRepository } from "./deckRepository.ts";

const version = {
  id: "version-1",
  deckId: "deck-1",
  number: 1,
  createdAt: "2026-10-23T12:00:00Z",
  fabraryUrl: null,
  snapshot: {
    schemaVersion: 1,
    name: "Saved deck",
    hero: "Viserai, the Forsaken",
    format: "Classic Constructed",
    cards: [],
    loadouts: [],
    pitchTargets: {},
  },
};

describe("deck version persistence", () => {
  it("reads one aliased version from the table-valued RPC and sends only the deck id", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const singular =
          new Headers(init?.headers).get("Accept") ===
          "application/vnd.pgrst.object+json";
        return new Response(JSON.stringify(singular ? version : [version]), {
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    const repository = supabaseDeckRepository(
      createClient("http://supabase.test", "test-key", {
        global: { fetch: fetcher },
      }),
    );
    expect(await repository.saveVersion("deck-1")).toEqual(version);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("/rpc/save_deck_version");
    expect(new URL(String(url)).searchParams.get("select")).toContain(
      "deckId:deck_id",
    );
    expect(JSON.parse(String(options?.body))).toEqual({
      target_deck_id: "deck-1",
    });
  });

  it("propagates save failures", async () => {
    const repository = supabaseDeckRepository(
      createClient("http://supabase.test", "test-key", {
        global: {
          fetch: async () =>
            new Response(
              JSON.stringify({
                code: "42501",
                message: "Only the deck owner can save a version",
              }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            ),
        },
      }),
    );
    await expect(repository.saveVersion("deck-1")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
