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

export function suggestCore(
  _ranked: CoreCandidate[],
  _c: CoreConstraints,
): CoreSuggestion {
  return { picks: [], byPitch: [] };
}

export function alternatives(
  _ranked: CoreCandidate[],
  _s: CoreSuggestion,
  _c: CoreConstraints,
  _variantId: string,
): CoreCandidate[] {
  return [];
}
