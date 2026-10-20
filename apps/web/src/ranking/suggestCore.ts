import type { CardSummary } from "../cards/cardRepository.ts";
import type { PitchTargets } from "../decks/deckRepository.ts";

export interface CoreCandidate {
  variantId: string;
  cardId: string;
  pitch: number | null;
  value: number;
  /** This card's own copy limit (e.g. 1 for a Legendary card); the general limit otherwise. */
  limit?: number;
  /** Never suggested, though it can be added by hand (e.g. offPitchReactions). */
  notSuggested?: boolean;
}

/**
 * Defence reactions at a pitch below the card's best defence (the maintainer, 20 Oct 2026: you'd
 * play the red ones, which cover the 4 breakpoint, over yellow and blue). Their variant ids.
 */
export function offPitchReactions(cards: readonly CardSummary[]): Set<string> {
  const off = new Set<string>();
  for (const card of cards) {
    if (card.type !== "defense_reaction") continue;
    const best = Math.max(...card.variants.map((v) => v.defense ?? 0));
    for (const v of card.variants) if ((v.defense ?? 0) < best) off.add(v.id);
  }
  return off;
}

export interface CoreConstraints {
  targets: PitchTargets;
  copiesEach: number;
  copyLimit: number;
  locked: Map<string, number>;
  removed: Set<string>;
}

export interface CorePick extends CoreCandidate {
  quantity: number;
  locked: boolean;
}

export interface CoreSuggestion {
  picks: CorePick[];
  byPitch: { pitch: 1 | 2 | 3; target: number; filled: number }[];
}

const PITCHES = [1, 2, 3] as const;

/**
 * A core built to pitch targets: locked cards first (whatever their rank, up to the copy
 * limit), then each pitch filled from the best card down until it reaches its target.
 * Targets count copies, as a deck's pitch targets do.
 */
export function suggestCore(
  ranked: CoreCandidate[],
  c: CoreConstraints,
): CoreSuggestion {
  const each = Math.max(1, Math.min(c.copiesEach, c.copyLimit));
  const quantity = new Map<string, number>();
  for (const r of ranked) {
    const q = c.locked.get(r.variantId);
    if (q !== undefined)
      quantity.set(r.variantId, Math.min(q, r.limit ?? c.copyLimit));
  }
  const filledFor = (pitch: number) =>
    ranked
      .filter((r) => r.pitch === pitch)
      .reduce((n, r) => n + (quantity.get(r.variantId) ?? 0), 0);

  for (const pitch of PITCHES) {
    const target = c.targets[pitch];
    if (target === undefined) continue;
    let left = target - filledFor(pitch);
    for (const r of ranked) {
      if (left <= 0) break;
      if (r.pitch !== pitch || quantity.has(r.variantId)) continue;
      if (c.removed.has(r.variantId) || r.notSuggested) continue;
      const q = Math.min(each, r.limit ?? c.copyLimit, left);
      quantity.set(r.variantId, q);
      left -= q;
    }
  }

  return {
    picks: ranked
      .filter((r) => quantity.has(r.variantId))
      .map((r) => ({
        ...r,
        quantity: quantity.get(r.variantId)!,
        locked: c.locked.has(r.variantId),
      })),
    byPitch: PITCHES.filter((p) => c.targets[p] !== undefined).map((pitch) => ({
      pitch,
      target: c.targets[pitch]!,
      filled: filledFor(pitch),
    })),
  };
}

/** The next best cards of the same pitch that aren't already picked or removed. */
export function alternatives<T extends CoreCandidate>(
  ranked: T[],
  s: CoreSuggestion,
  c: CoreConstraints,
  variantId: string,
  n = 3,
): T[] {
  const pitch = ranked.find((r) => r.variantId === variantId)?.pitch;
  const picked = new Set(s.picks.map((p) => p.variantId));
  return ranked
    .filter(
      (r) =>
        r.pitch === pitch &&
        !picked.has(r.variantId) &&
        !c.removed.has(r.variantId) &&
        !r.notSuggested,
    )
    .slice(0, n);
}

/**
 * Equipment for the core (the maintainer, 20 Oct 2026): the best card of each gear slot (a
 * weapon, then each equipment slot), added to the core, one copy each. A slot the core already
 * has a piece for is left alone. Slots' cards come best first.
 *
 * A two-handed weapon takes both hands (the maintainer, 20 Oct 2026: Grimoire of Fellingsong can't
 * be played alongside Seven Sin Nebula), so there's no off-hand beside one, and a core that
 * already has an off-hand gets a one-handed weapon.
 */
export function suggestGear(
  slots: { title: string; cards: { variantId: string }[] }[],
  core: Record<string, number>,
  twoHanded: ReadonlySet<string> = new Set(),
): Record<string, number> {
  const next = { ...core };
  const has = (slot: { cards: { variantId: string }[] }) =>
    slot.cards.some((c) => next[c.variantId]);
  const weapons = slots.find((s) => s.title === "Weapons");
  const offHand = slots.find((s) => s.title === "Off-Hand");
  const offHandTaken = () => !!offHand && has(offHand);
  for (const slot of slots) {
    if (has(slot)) continue;
    if (
      slot === offHand &&
      weapons?.cards.some(
        (c) => next[c.variantId] && twoHanded.has(c.variantId),
      )
    )
      continue;
    const best = slot.cards.find(
      (c) =>
        !(slot === weapons && offHandTaken() && twoHanded.has(c.variantId)),
    );
    if (best) next[best.variantId] = 1;
  }
  return next;
}
