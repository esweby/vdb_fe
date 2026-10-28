// Checking an uploaded Talishar game against the version it goes on (docs/test-loop.md, step 2).
import { describe, expect, it } from "vitest";
import type { CardPlayStats } from "@vdb/talishar";
import type { DeckVersion } from "./deckRepository.ts";
import { checkGame } from "./gameUpload.ts";

const played = (name: string, pitch: 1 | 2 | 3): CardPlayStats => ({
  name,
  pitch,
  played: 0,
  blocked: 0,
  pitched: 0,
  discarded: 0,
  timesHit: 0,
});

const card = (name: string, pitch: number | null, sideboard = false) => ({
  variantId: `${name}-${pitch}`,
  quantity: 1,
  sideboard,
  externalId: `${name}-${pitch}`,
  name,
  pitch,
  type: "action",
  subtypes: [],
});

const version = (
  number: number,
  cards: DeckVersion["snapshot"]["cards"],
): DeckVersion => ({
  id: `version-${number}`,
  deckId: "deck-1",
  number,
  createdAt: "2026-10-28T12:00:00Z",
  fabraryUrl: null,
  snapshot: {
    schemaVersion: 1,
    name: "Gate tempo",
    hero: "Viserai, the Forsaken",
    format: "Classic Constructed",
    pitchTargets: {},
    cards,
    loadouts: [],
  },
});

describe("checkGame", () => {
  it("passes a game whose cards are all in the version, main deck or sideboard", () => {
    const v1 = version(1, [card("Cull", 1), card("Sink Below", 1, true)]);
    expect(
      checkGame([played("Cull", 1), played("Sink Below", 1)], v1, [v1]),
    ).toEqual({ missing: [], fits: null });
  });

  it("names the cards the version doesn't have, by name and pitch", () => {
    const v1 = version(1, [card("Cull", 1)]);
    expect(
      checkGame([played("Cull", 3), played("Murmuring Gloomblade", 2)], v1, [
        v1,
      ]).missing,
    ).toEqual(["Cull (blue)", "Murmuring Gloomblade (yellow)"]);
  });

  it("suggests the newest other version that has every card", () => {
    const v1 = version(1, [card("Cull", 1), card("Sink Below", 1)]);
    const v2 = version(2, [card("Cull", 1)]);
    const v3 = version(3, [card("Cull", 1), card("Sink Below", 1)]);
    const game = [played("Cull", 1), played("Sink Below", 1)];
    expect(checkGame(game, v2, [v3, v2, v1]).fits).toBe(v3);
  });

  it("suggests nothing when no version fits", () => {
    const v1 = version(1, [card("Cull", 1)]);
    const v2 = version(2, [card("Cull", 1)]);
    expect(
      checkGame([played("Revel in Runeblood", 1)], v1, [v2, v1]).fits,
    ).toBe(null);
  });
});
