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
  "on_usurped",
  "would_go_to_graveyard",
  "start_of_turn",
  "start_of_action_phase",
  "combat_chain_closes",
  "activated",
  "your_attack_action_played",
  "your_attack_action_hits",
] as const;

/** What has to be true for an effect to happen. */
export const CONDITIONS = [
  "banished_card_is_runeblade",
  "banished_card_is_shadow",
  "pitched_attack_action",
  "pitched_non_attack_action",
  "played_attack_action_this_turn",
  "played_non_attack_action_this_turn",
  "dealt_arcane_damage_this_turn",
  "played_or_created_aura_this_turn",
  "played_from_banish",
  "top_card_matches_pitch",
  "destroyed_own_aura",
  "hero_lost_life_this_turn",
] as const;

export const BANISH_ZONES = ["hand", "deck_top", "graveyard"] as const;

/** The effect is given to a later card rather than happening on this one. */
export const GRANTED_TO = [
  "next_attack_action",
  "next_runeblade_attack_action",
  "next_shadow_attack",
] as const;

const amount = z.union([z.number().int().positive(), z.literal("X")]);
const trigger = z.enum(TRIGGERS);
const conditions = z.array(z.enum(CONDITIONS)).optional();
const grantedTo = z.enum(GRANTED_TO).optional();

export const tokenCreationSchema = z.strictObject({
  token: z.enum(TOKENS),
  amount,
  trigger,
  conditions,
  grantedTo,
});

export const ownBanishSchema = z.strictObject({
  from: z.enum(BANISH_ZONES),
  trigger,
  conditions,
  optional: z.boolean().optional(),
});

export const selfBanishSchema = z.strictObject({
  trigger,
  conditions,
  optional: z.boolean().optional(),
});

export const arcaneDamageSchema = z.strictObject({
  amount,
  trigger,
  conditions,
  grantedTo,
});

/** Attributes written by hand (src/authored in the importer). */
export const authoredAttributesSchema = z.strictObject({
  tokens: z.array(tokenCreationSchema).optional(),
  banishesOwn: z.array(ownBanishSchema).optional(),
  /** The card banishes itself (feeds Gates and play-from-banish). */
  banishesSelf: z.array(selfBanishSchema).optional(),
  playableFromBanish: z.strictObject({ conditions }).optional(),
  arcaneDamage: z.array(arcaneDamageSchema).optional(),
  costReducedPerRunechant: z.boolean().optional(),
  /** Conditional go again. Replaces the dataset's "Go again" keyword, which can't tell. */
  goAgain: z.strictObject({ conditions }).optional(),
  /** Gives go again to a later card. */
  grantsGoAgain: z.enum(GRANTED_TO).optional(),
  /** Doubts or context for the reviewer. Shown on the review sheet. */
  notes: z.string().optional(),
});

/** Attributes the importer derives from the dataset. */
export interface GeneratedAttributes {
  /** Natural (unconditional) go again. False when authored `goAgain` says it's conditional. */
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
export type GrantedTo = (typeof GRANTED_TO)[number];
export type TokenCreation = z.infer<typeof tokenCreationSchema>;
export type OwnBanish = z.infer<typeof ownBanishSchema>;
export type ArcaneDamage = z.infer<typeof arcaneDamageSchema>;
export type SelfBanish = z.infer<typeof selfBanishSchema>;
export type AuthoredCardAttributes = z.infer<typeof authoredAttributesSchema>;
export type CardAttributes = GeneratedAttributes & AuthoredCardAttributes;
