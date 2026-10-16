// Deck legality (README "Weapons and equipment"). The numbers come from configuration
// (app_settings.format_classic_constructed), which is UNVERIFIED until a player checks it.
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";

export interface FormatRules {
  /** Copies allowed of each card and pitch */
  copyLimit: number;
  /** Minimum main deck cards, not counting weapons, equipment or sideboard */
  deckMin: number;
  /** Maximum card pool, including weapons, equipment and sideboard */
  poolMax: number;
  /** Hands for weapons and off-hand equipment in the loadout */
  weaponHands: number;
}

export interface DeckEntry {
  card: CardSummary;
  variant: VariantSummary;
  quantity: number;
  sideboard: boolean;
}

export type DeckSection = "weapon" | "equipment" | "deck";

export const SLOTS = ["Head", "Chest", "Arms", "Legs", "Off-Hand"] as const;
export type Slot = (typeof SLOTS)[number];

export const PITCH_NAMES: Record<number, string> = {
  1: "red",
  2: "yellow",
  3: "blue",
};

/**
 * Copies allowed of a card and pitch, across the deck and the sideboard together. Checked by the
 * maintainer: one of each piece of equipment (15 Oct 2026); one of a two-handed weapon and two
 * of a one-handed one (16 Oct 2026). Deck cards follow the format's copy limit.
 */
export function copyLimitFor(card: CardSummary, rules: FormatRules): number {
  // Legendary cards are one per deck (e.g. Arknight Shard).
  if (card.keywords.includes("Legendary")) return 1;
  if (card.type === "equipment") return 1;
  if (card.type === "weapon") return card.subtypes.includes("2H") ? 1 : 2;
  return rules.copyLimit;
}

export function sectionOf(card: CardSummary): DeckSection {
  if (card.type === "weapon") return "weapon";
  if (card.type === "equipment") return "equipment";
  return "deck";
}

export function slotOf(card: CardSummary): Slot | null {
  if (card.type !== "equipment") return null;
  return SLOTS.find((s) => card.subtypes.includes(s)) ?? null;
}

/** "Hocus Pocus (red)", or just the name for cards without pitch. */
export function variantName(card: CardSummary, variant: VariantSummary) {
  const pitch = variant.pitch === null ? undefined : PITCH_NAMES[variant.pitch];
  return pitch ? `${card.name} (${pitch})` : card.name;
}

function handsOf(card: CardSummary): number {
  if (card.type === "weapon") return card.subtypes.includes("2H") ? 2 : 1;
  return slotOf(card) === "Off-Hand" ? 1 : 0;
}

const sum = (entries: DeckEntry[]) =>
  entries.reduce((n, e) => n + e.quantity, 0);

export function deckCounts(entries: DeckEntry[]) {
  return {
    deck: sum(
      entries.filter((e) => !e.sideboard && sectionOf(e.card) === "deck"),
    ),
    sideboard: sum(entries.filter((e) => e.sideboard)),
    pool: sum(entries),
  };
}

const cards = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

/** Why the deck isn't legal, as sentences. Empty when it is. */
export function deckProblems(
  entries: DeckEntry[],
  rules: FormatRules,
): string[] {
  const problems: string[] = [];
  const counts = deckCounts(entries);
  if (counts.deck < rules.deckMin) {
    problems.push(
      `The deck has ${cards(counts.deck)}; it needs at least ${rules.deckMin}.`,
    );
  }
  if (counts.pool > rules.poolMax) {
    problems.push(
      `The card pool has ${cards(counts.pool)}; at most ${rules.poolMax} are allowed.`,
    );
  }
  // Copies of each card and pitch, in the deck and the sideboard together.
  const copies = new Map<string, { entry: DeckEntry; quantity: number }>();
  for (const e of entries) {
    const seen = copies.get(e.variant.id);
    copies.set(e.variant.id, {
      entry: seen?.entry ?? e,
      quantity: (seen?.quantity ?? 0) + e.quantity,
    });
  }
  for (const { entry: e, quantity } of copies.values()) {
    const limit = copyLimitFor(e.card, rules);
    if (quantity > limit) {
      problems.push(
        `${variantName(e.card, e.variant)} has ${quantity} copies; at most ${limit} ${limit === 1 ? "is" : "are"} allowed.`,
      );
    }
  }
  const loadout = entries.filter((e) => !e.sideboard);
  for (const slot of SLOTS) {
    const pieces = sum(loadout.filter((e) => slotOf(e.card) === slot));
    if (pieces > 1) {
      problems.push(
        `The loadout has ${pieces} ${slot} pieces; only one per slot.`,
      );
    }
  }
  const hands = loadout.reduce((n, e) => n + handsOf(e.card) * e.quantity, 0);
  if (hands > rules.weaponHands) {
    problems.push(
      `The loadout's weapons and off-hand need ${hands} hands; there are only ${rules.weaponHands}.`,
    );
  }
  return problems;
}
