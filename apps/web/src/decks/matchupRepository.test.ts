import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { supabaseDeckRepository } from "./deckRepository.ts";

it("saves a named plan and its cards in one RPC, retaining its id when renamed", async () => {
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify("saved-id"), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  const repository = supabaseDeckRepository(
    createClient("http://supabase.test", "key", { global: { fetch: fetcher } }),
  );
  const result = await repository.saveMatchup("deck-1", {
    id: "saved-id",
    name: " More defence ",
    heroId: null,
    cards: [
      { variantId: "v1", quantity: 2 },
      { variantId: "v2", quantity: 0 },
    ],
  });
  expect(result).toEqual({
    id: "saved-id",
    deckId: "deck-1",
    name: "More defence",
    heroId: null,
    cards: [{ variantId: "v1", quantity: 2 }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0]!;
  expect(String(url)).toContain("/rpc/save_matchup");
  expect(JSON.parse(String(options?.body))).toEqual({
    target_deck_id: "deck-1",
    target_loadout_id: "saved-id",
    plan_name: "More defence",
    opponent_id: null,
    plan_cards: [{ variantId: "v1", quantity: 2 }],
  });
});

it("lists named plans without requiring a hero, excluding the default loadout", async () => {
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("[]", { headers: { "Content-Type": "application/json" } }),
  );
  const repository = supabaseDeckRepository(
    createClient("http://supabase.test", "key", { global: { fetch: fetcher } }),
  );
  await repository.listMatchups("deck-1");
  const url = new URL(String(fetcher.mock.calls[0]![0]));
  expect(url.searchParams.get("is_default")).toBe("eq.false");
  expect(url.searchParams.has("opponent_hero_id")).toBe(false);
  expect(url.searchParams.get("select")).toContain("name");
});
