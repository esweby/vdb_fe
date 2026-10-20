// The effect drafts a player checks (docs/rules-engine.md, step 9b): one entry per card, with
// pitches whose drafts match shown once. Cards whose facts give nothing to draft or note are
// left out; cards with verified rules are marked, so nobody checks them twice.
import { verifiedRulesFor } from "@vdb/engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { draftEffects, type EffectDraft } from "./draftEffects.ts";

export type DraftStatus = "complete" | "partial" | "verified";

export interface DraftEntry {
  card: CardSummary;
  /** One draft per distinct reading, with the pitches it covers. */
  drafts: { pitches: (number | null)[]; draft: EffectDraft }[];
  verified: boolean;
  /** Complete: nothing left out. Partial: some facts not drafted. Both still unverified. */
  status: DraftStatus;
}

const ORDER: DraftStatus[] = ["complete", "partial", "verified"];

export function draftQueue(cards: readonly CardSummary[]): DraftEntry[] {
  const entries: DraftEntry[] = [];
  for (const card of cards) {
    const drafts: DraftEntry["drafts"] = [];
    const byKey = new Map<string, DraftEntry["drafts"][number]>();
    for (const variant of card.variants) {
      const draft = draftEffects(card, variant);
      if (draft.description.length === 0 && draft.notDrafted.length === 0)
        continue;
      const key = JSON.stringify([draft.rules, draft.notDrafted]);
      const same = byKey.get(key);
      if (same) same.pitches.push(variant.pitch);
      else {
        const entry = { pitches: [variant.pitch], draft };
        byKey.set(key, entry);
        drafts.push(entry);
      }
    }
    if (drafts.length === 0) continue;
    const verified = card.variants.some(
      (v) => verifiedRulesFor(card.name, v.pitch) !== undefined,
    );
    const status: DraftStatus = verified
      ? "verified"
      : drafts.every((d) => d.draft.complete)
        ? "complete"
        : "partial";
    entries.push({ card, drafts, verified, status });
  }
  return entries.sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.card.name.localeCompare(b.card.name),
  );
}
