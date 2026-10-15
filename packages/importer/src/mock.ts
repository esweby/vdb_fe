// Mock scores for local development only, so the ranking and deck builder have something to
// show before the scoring group has started. A rough guide (Runeblade and Shadow cards above
// generics, token and blood debt cards a little higher), not a judgement of any card.
import {
  hasConditions,
  type AuthoredCardAttributes,
  type CardAttributes,
} from "@vdb/cards";

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

/** Share of cards reviewed, so Needs review still has work in it. */
const COVERAGE = { fit: 0.85, generic: 0.25 };

/** A small seeded generator (mulberry32), keyed by seed and a string. */
function random(seed: number, key: string) {
  let h = seed ^ 0x9e3779b9;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 0x5bd1e995);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const step = (n: number) => Math.min(100, Math.max(0, Math.round(n / 10) * 10));

const fits = (c: MockCard) =>
  c.classes.includes("Runeblade") || c.talents.includes("Shadow");

export function mockScores(
  cards: MockCard[],
  scorerIds: string[],
  seed: number,
): { reviews: { userId: string; cardId: string }[]; scores: MockScore[] } {
  const reviews: { userId: string; cardId: string }[] = [];
  const scores: MockScore[] = [];

  for (const card of cards) {
    const rng = random(seed, card.id);
    if (rng() >= (fits(card) ? COVERAGE.fit : COVERAGE.generic)) continue;

    const tokens = new Set((card.attributes.tokens ?? []).map((t) => t.token));
    const base = fits(card)
      ? 55 +
        (tokens.has("runechant") || tokens.has("gate") ? 10 : 0) +
        (card.attributes.hasBloodDebt ? 10 : 0)
      : 25 + rng() * 30;
    const ranged = hasConditions(
      card.attributes,
      card.variants.map((v) => v.attributes),
    );
    const pitched = card.variants.filter((v) => v.pitch !== null);
    const byPitch = pitched.length > 1 && rng() < 0.5;
    const reviewers = 2 + Math.floor(rng() * (scorerIds.length - 1));
    const start = Math.floor(rng() * scorerIds.length);

    for (let i = 0; i < reviewers; i++) {
      const userId = scorerIds[(start + i) % scorerIds.length]!;
      const add = (
        dimension: MockScore["dimension"],
        score: number,
        at: { variantId?: string; side?: MockScore["side"] } = {},
      ) =>
        scores.push({
          userId,
          cardId: card.id,
          variantId: at.variantId ?? null,
          side: at.side ?? null,
          dimension,
          score: step(score),
        });

      reviews.push({ userId, cardId: card.id });
      const overall = step(base + (rng() - 0.5) * 30);
      add("overall", overall);
      if (ranged) {
        add("floor", overall - 10 * (1 + Math.floor(rng() * 3)));
        add("ceiling", overall + 10 * (1 + Math.floor(rng() * 3)));
      }
      if (byPitch) {
        const lowest = Math.min(...pitched.map((v) => v.pitch!));
        const highest = Math.max(...pitched.map((v) => v.pitch!));
        for (const v of pitched) {
          if (v.pitch === lowest)
            add("overall", overall + 10, { variantId: v.id });
          if (v.pitch === highest)
            add("overall", overall - 10, { variantId: v.id });
        }
      }
      if (card.attributes.hasBloodDebt)
        add("overall", overall + 10, { side: "usurper" });
      if (tokens.has("runechant"))
        add("overall", overall + 10, { side: "forsaken" });
    }
  }

  return { reviews, scores };
}

/** Mock data never goes near a hosted database: there's deliberately no override. */
export function assertLocalDb(url: string): void {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(
      `Mock scores are for the local stack only; DB_URL points at ${host}.`,
    );
  }
}
