// The effect drafts a player checks (docs/rules-engine.md, step 9b): one entry per card, with
// pitches whose drafts match shown once. Cards whose facts give nothing to draft or note are
// left out; cards with verified rules are marked, so nobody checks them twice. Each draft has a
// hash, and an admin's verdict applies only to the draft it was given on.
import { verifiedRulesFor } from "@vdb/engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { draftEffects, type EffectDraft } from "./draftEffects.ts";
import type { DraftReview } from "./draftReviewRepository.ts";

export type DraftStatus = "complete" | "partial" | "reviewed" | "verified";

export interface QueuedDraft {
  pitches: (number | null)[];
  draft: EffectDraft;
  /** Changes whenever the draft does, so an old verdict doesn't carry over. */
  hash: string;
  /** The verdict on this draft, if there is one. */
  review?: DraftReview;
}

export interface DraftEntry {
  card: CardSummary;
  /** One draft per distinct reading, with the pitches it covers. */
  drafts: QueuedDraft[];
  verified: boolean;
  /** A verdict was given on an earlier draft; the card's facts have changed since. */
  staleReview: boolean;
  /**
   * Complete: nothing left out. Partial: some facts not drafted. Reviewed: every draft has a
   * verdict. Verified: rules signed off in code. All but verified are still unverified.
   */
  status: DraftStatus;
}

const ORDER: DraftStatus[] = ["complete", "partial", "reviewed", "verified"];

/** FNV-1a over the draft's rules and what it leaves out, as 8 hex digits. */
function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function draftQueue(
  cards: readonly CardSummary[],
  reviews: readonly DraftReview[] = [],
): DraftEntry[] {
  const reviewsByCard = new Map<string, DraftReview[]>();
  for (const r of reviews)
    reviewsByCard.set(r.cardId, [...(reviewsByCard.get(r.cardId) ?? []), r]);

  const entries: DraftEntry[] = [];
  for (const card of cards) {
    const drafts: QueuedDraft[] = [];
    const byKey = new Map<string, QueuedDraft>();
    for (const variant of card.variants) {
      const draft = draftEffects(card, variant);
      if (draft.description.length === 0 && draft.notDrafted.length === 0)
        continue;
      const key = JSON.stringify([draft.rules, draft.notDrafted]);
      const same = byKey.get(key);
      if (same) same.pitches.push(variant.pitch);
      else {
        const entry = { pitches: [variant.pitch], draft, hash: hashOf(key) };
        byKey.set(key, entry);
        drafts.push(entry);
      }
    }
    if (drafts.length === 0) continue;

    const cardReviews = reviewsByCard.get(card.id) ?? [];
    for (const d of drafts) {
      const review = cardReviews.find((r) => r.draftHash === d.hash);
      if (review) d.review = review;
    }
    const staleReview = cardReviews.some(
      (r) => !drafts.some((d) => d.hash === r.draftHash),
    );
    const verified = card.variants.some(
      (v) => verifiedRulesFor(card.name, v.pitch) !== undefined,
    );
    const status: DraftStatus = verified
      ? "verified"
      : drafts.every((d) => d.review)
        ? "reviewed"
        : drafts.every((d) => d.draft.complete)
          ? "complete"
          : "partial";
    entries.push({ card, drafts, verified, staleReview, status });
  }
  return entries.sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.card.name.localeCompare(b.card.name),
  );
}
