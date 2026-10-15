import type { PitchTargets } from "../decks/deckRepository.ts";

export interface CoreCandidate {
  variantId: string;
  cardId: string;
  pitch: number | null;
  value: number;
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
    if (q !== undefined) quantity.set(r.variantId, Math.min(q, c.copyLimit));
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
      if (c.removed.has(r.variantId)) continue;
      const q = Math.min(each, left);
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
        !c.removed.has(r.variantId),
    )
    .slice(0, n);
}
