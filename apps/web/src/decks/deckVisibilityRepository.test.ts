import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { supabaseDeckRepository } from "./deckRepository.ts";

const linked = {
  id: "deck-1",
  name: "Linked",
  updatedAt: "2026-10-27T12:00:00Z",
  visibility: "link",
  ownerId: "u2",
  pitchTargets: { 3: 22 },
  cards: [{ variantId: "v1", quantity: 2, sideboard: false }],
};

/** A Supabase client whose table read finds nothing and whose RPCs answer from `rpc`. */
function repositoryWith(rpc: Record<string, unknown>) {
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = new URL(String(input));
      const name = url.pathname.split("/rpc/")[1];
      const body = name ? (rpc[name] ?? null) : null;
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  const repository = supabaseDeckRepository(
    createClient("http://supabase.test", "test-key", {
      global: { fetch: fetcher },
    }),
  );
  return { repository, fetcher };
}

describe("opening a deck someone shared by its link", () => {
  it("reads a deck the tables don't return through linked_deck, sending only its id", async () => {
    const { repository, fetcher } = repositoryWith({
      linked_deck: linked,
      usernames: [{ id: "u2", username: "tobi" }],
    });
    expect(await repository.getDeck("deck-1")).toEqual({
      ...linked,
      ownerName: "tobi",
    });
    const call = fetcher.mock.calls.find(([url]) =>
      String(url).includes("/rpc/linked_deck"),
    );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      target_deck_id: "deck-1",
    });
  });

  it("finds nothing when the deck is private or doesn't exist", async () => {
    const { repository } = repositoryWith({ linked_deck: null });
    expect(await repository.getDeck("deck-1")).toBeNull();
  });
});
