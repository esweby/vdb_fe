// Gaps (README "Deck analysis", phase two step 3): a maker role the deck relies on that's
// missing from a pitch it plays, e.g. "no red Gate makers". UNVERIFIED: the roles and
// thresholds are a first pass, for the maintainer to tune.
import { rolesOf, type RoleId } from "@vdb/cards";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { sectionOf, type DeckEntry } from "./deckRules.ts";

export interface GapRole {
  id: "runechant" | "gate" | "banish" | "tempo";
  /** Plural, lower case, as it reads mid-sentence. */
  label: string;
  roles: RoleId[];
}

/** The maker roles a deck can be short of in a pitch, in the order gaps are listed. */
export const GAP_ROLES: GapRole[] = [
  {
    id: "runechant",
    label: "Runechant makers",
    roles: ["runechant_generator"],
  },
  { id: "gate", label: "Gate makers", roles: ["gate_generator"] },
  {
    id: "banish",
    label: "banishers",
    roles: ["hand_banisher", "deck_banisher", "self_banisher"],
  },
  { id: "tempo", label: "go again givers", roles: ["go_again_granter"] },
];

/** A role counts as relied on from this many copies in the deck (UNVERIFIED). */
const MIN_ROLE = 3;
/** A pitch counts as played from this many cards in the deck (UNVERIFIED). */
const MIN_PITCH = 5;

export interface Gap {
  role: GapRole;
  pitch: number;
  /** Copies of the role across the deck. */
  roleCopies: number;
  /** Cards of this pitch in the deck. */
  pitchCopies: number;
}

/** A version's roles: its own text, as a pitch can differ (3, 2 or 1 Runechants). */
export function variantRoles(card: CardSummary, variant: VariantSummary) {
  return rolesOf({
    type: card.type,
    subtypes: card.subtypes,
    attributes: { ...card.attributes, ...variant.attributes },
  });
}

const hasRole = (roles: RoleId[], role: GapRole) =>
  role.roles.some((r) => roles.includes(r));

/**
 * Gaps in the main deck: red first, then yellow, then blue (the maintainer, 20 Oct 2026); most-used
 * roles first within a colour. Weapons, equipment and sideboard aren't counted.
 */
export function findGaps(entries: DeckEntry[]): Gap[] {
  const deck = entries.filter(
    (e) => !e.sideboard && sectionOf(e.card) === "deck" && e.variant.pitch,
  );
  const pitchCopies = new Map<number, number>();
  for (const e of deck)
    pitchCopies.set(
      e.variant.pitch!,
      (pitchCopies.get(e.variant.pitch!) ?? 0) + e.quantity,
    );

  const gaps: Gap[] = [];
  for (const role of GAP_ROLES) {
    const withRole = deck.filter((e) =>
      hasRole(variantRoles(e.card, e.variant), role),
    );
    const roleCopies = withRole.reduce((n, e) => n + e.quantity, 0);
    if (roleCopies < MIN_ROLE) continue;
    const covered = new Set(withRole.map((e) => e.variant.pitch));
    for (const pitch of [1, 2, 3]) {
      const played = pitchCopies.get(pitch) ?? 0;
      if (played >= MIN_PITCH && !covered.has(pitch))
        gaps.push({ role, pitch, roleCopies, pitchCopies: played });
    }
  }
  return gaps.sort((a, b) => a.pitch - b.pitch || b.roleCopies - a.roleCopies);
}

/**
 * Cards in the pool that would fill a gap: that role, that pitch, not already in the deck.
 * Best rated first (`values`: variant id → 0–100), unrated after.
 */
export function fillersFor(
  gap: Gap,
  pool: CardSummary[],
  values: Map<string, number>,
  inDeck: Set<string>,
  limit = 3,
): { card: CardSummary; variant: VariantSummary; value?: number }[] {
  return pool
    .filter((c) => sectionOf(c) === "deck")
    .flatMap((card) =>
      card.variants
        .filter(
          (v) =>
            v.pitch === gap.pitch &&
            !inDeck.has(v.id) &&
            hasRole(variantRoles(card, v), gap.role),
        )
        .map((variant) => ({ card, variant, value: values.get(variant.id) })),
    )
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    .slice(0, limit);
}
