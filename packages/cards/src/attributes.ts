// The attribute vocabulary: what we record about a card's contribution to Viserai's goals.
// It describes effects, it doesn't implement game rules. Extend it in small, tested changes
// when a card can't be described (see docs/attribute-vocabulary.md).
import { z } from "zod";

export const TOKENS = ["runechant", "gate", "eloquence"] as const;

/** When an effect happens. */
export const TRIGGERS = [
  "on_play",
  "on_attack",
  "on_hit",
  "on_defend",
  "on_pitch",
  "on_banished",
  "on_leave_arena",
  "on_destroyed",
  "start_of_turn",
  "start_of_action_phase",
  "combat_chain_closes",
  "activated",
] as const;

/** What has to be true for an effect to happen. */
export const CONDITIONS = [
  "banished_card_is_runeblade",
  "banished_card_is_shadow",
  "pitched_attack_action",
  "pitched_non_attack_action",
  "played_non_attack_action_this_turn",
  "dealt_arcane_damage_this_turn",
  "played_or_created_aura_this_turn",
  "played_from_banish",
  "top_card_matches_pitch",
  "destroyed_own_aura",
  "hero_lost_life_this_turn",
] as const;

export const BANISH_ZONES = ["hand", "deck_top", "graveyard"] as const;

const amount = z.union([z.number().int().positive(), z.literal("X")]);
const trigger = z.enum(TRIGGERS);
const conditions = z.array(z.enum(CONDITIONS)).optional();

export const tokenCreationSchema = z.strictObject({
  token: z.enum(TOKENS),
  amount,
  trigger,
  conditions,
});

export const ownBanishSchema = z.strictObject({
  from: z.enum(BANISH_ZONES),
  trigger,
  conditions,
  optional: z.boolean().optional(),
});

export const arcaneDamageSchema = z.strictObject({
  amount,
  trigger,
  conditions,
});

/** Attributes written by hand (src/authored in the importer). */
export const authoredAttributesSchema = z.strictObject({
  tokens: z.array(tokenCreationSchema).optional(),
  banishesOwn: z.array(ownBanishSchema).optional(),
  playableFromBanish: z.strictObject({ conditions }).optional(),
  arcaneDamage: z.array(arcaneDamageSchema).optional(),
  costReducedPerRunechant: z.boolean().optional(),
  /** Doubts or context for the reviewer. Shown on the review sheet. */
  notes: z.string().optional(),
});

/** Attributes the importer derives from the dataset. */
export interface GeneratedAttributes {
  hasGoAgain: boolean;
  hasBloodDebt: boolean;
  hasUsurp: boolean;
  hasRuneGate: boolean;
  /** Hero named in "<Hero> Specialization", or null. */
  specialization: string | null;
}

export type Token = (typeof TOKENS)[number];
export type Trigger = (typeof TRIGGERS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type TokenCreation = z.infer<typeof tokenCreationSchema>;
export type OwnBanish = z.infer<typeof ownBanishSchema>;
export type ArcaneDamage = z.infer<typeof arcaneDamageSchema>;
export type AuthoredCardAttributes = z.infer<typeof authoredAttributesSchema>;
export type CardAttributes = GeneratedAttributes & AuthoredCardAttributes;
