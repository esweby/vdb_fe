// Mock scores for local development only, so the ranking and deck builder have something to
// show before the scoring group has started. Not a judgement of any card.
import type { AuthoredCardAttributes, CardAttributes } from "@vdb/cards";

export interface MockCard {
  id: string;
  type: string;
  classes: string[];
  talents: string[];
  attributes: CardAttributes;
  variants: {
    id: string;
    pitch: number | null;
    attributes: Partial<AuthoredCardAttributes>;
  }[];
}

export interface MockScore {
  userId: string;
  cardId: string;
  variantId: string | null;
  side: "forsaken" | "usurper" | null;
  dimension: "floor" | "ceiling" | "overall";
  score: number;
}

export function mockScores(
  _cards: MockCard[],
  _scorerIds: string[],
  _seed: number,
): { reviews: { userId: string; cardId: string }[]; scores: MockScore[] } {
  throw new Error("not implemented");
}

export function assertLocalDb(_url: string): void {}
