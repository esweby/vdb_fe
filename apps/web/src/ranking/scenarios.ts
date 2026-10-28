// Built-in scenarios (README "Scenarios") and how a card becomes an engine card.
// UNVERIFIED: the scenarios and their thresholds are a first pass for the scoring group.
import { rolesOf, type RoleId } from "@vdb/cards";
import type { EngineCard, ScenarioDefinition } from "@esweby/fab-engine";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";

export interface BuiltInScenario {
  definition: ScenarioDefinition;
}

const opening = (
  name: string,
  condition: ScenarioDefinition["condition"],
): ScenarioDefinition => ({
  version: 1,
  name,
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition,
});

export const BUILT_IN_SCENARIOS: BuiltInScenario[] = [
  {
    definition: opening("Opening hand creates 3 or more Runechants", {
      all: [
        {
          label: "3 or more Runechants (conditions met)",
          filter: {},
          total: "runechants",
          min: 3,
        },
      ],
    }),
  },
  {
    definition: opening(
      "Opening hand has a Rune Gate card and 2 or more Runechant makers",
      {
        all: [
          { label: "a Rune Gate card", filter: { role: "rune_gate" }, min: 1 },
          {
            label: "2 Runechant makers",
            filter: { role: "runechant_generator" },
            min: 2,
          },
        ],
      },
    ),
  },
  {
    definition: opening("Opening hand has a Gate maker and a Gate target", {
      all: [
        { label: "a Gate maker", filter: { role: "gate_generator" }, min: 1 },
        { label: "a Gate target", filter: { role: "gate_target" }, min: 1 },
      ],
    }),
  },
  {
    definition: opening(
      "Opening hand banishes a card and has something that uses the banished zone",
      {
        all: [
          {
            any: [
              {
                label: "a card that banishes",
                filter: { role: "hand_banisher" },
                min: 1,
              },
              {
                label: "a card that banishes",
                filter: { role: "deck_banisher" },
                min: 1,
              },
              {
                label: "a card that banishes",
                filter: { role: "self_banisher" },
                min: 1,
              },
            ],
          },
          {
            any: [
              {
                label: "a banished-zone payoff",
                filter: { role: "plays_from_banish" },
                min: 1,
              },
              {
                label: "a banished-zone payoff",
                filter: { role: "banish_type_payoff" },
                min: 1,
              },
              {
                label: "a banished-zone payoff",
                filter: { role: "banish_trigger" },
                min: 1,
              },
            ],
          },
        ],
      },
    ),
  },
  {
    definition: opening("Opening hand has an Usurp card and a sinchant", {
      all: [
        { label: "an Usurp card", filter: { role: "usurp" }, min: 1 },
        { label: "a sinchant", filter: { role: "sinchant" }, min: 1 },
      ],
    }),
  },
  {
    definition: opening("Opening hand has 2 or more Shadow cards", {
      all: [{ label: "2 Shadow cards", filter: { trait: "shadow" }, min: 2 }],
    }),
  },
  {
    // README "Scenarios", illustrative example.
    definition: opening(
      "Opening hand has Become the Shadow Lord and another Shadow card",
      {
        all: [
          {
            label: "Become the Shadow Lord",
            filter: { name: "Become the Shadow Lord" },
            min: 1,
          },
          { label: "another Shadow card", filter: { trait: "shadow" }, min: 2 },
        ],
      },
    ),
  },
  {
    definition: opening("Opening hand has a blue card to pitch", {
      all: [{ label: "a blue card", filter: { pitch: 3 }, min: 1 }],
    }),
  },
];

/** "X" Runechants are counted as 2 until there's a better rule (UNVERIFIED). */
const X_AS = 2;

/**
 * A card as the engine sees it: its roles, a few traits, and how many Runechants and Gates it
 * makes, with and without its conditions (an on-hit effect counts as conditional).
 */
/** Subtypes that stay in the arena when the turn ends (signed off, 20 Oct 2026). */
const PERMANENT_SUBTYPES = ["Aura", "Item", "Ally", "Landmark"];

export function toEngineCard(
  card: CardSummary,
  variant: VariantSummary,
  roles: RoleId[],
): EngineCard {
  // A pitch's attributes are merged over the card's, so its tokens replace the card's.
  const tokens = variant.attributes.tokens ?? card.attributes.tokens ?? [];
  const made = (token: "runechant" | "gate", unconditionalOnly: boolean) =>
    tokens
      .filter((t) => t.token === token && !t.grantedTo)
      .filter(
        (t) =>
          !unconditionalOnly ||
          ((t.conditions ?? []).length === 0 && t.trigger !== "on_hit"),
      )
      .reduce((n, t) => n + (t.amount === "X" ? X_AS : t.amount), 0);
  return {
    id: variant.id,
    name: card.name,
    pitch: variant.pitch,
    roles,
    traits: [
      ...(card.attributes.hasBloodDebt ? ["blood_debt"] : []),
      ...(card.talents.includes("Shadow") ? ["shadow"] : []),
      ...(card.classes.includes("Runeblade") ? ["runeblade"] : []),
      ...(card.classes.includes("Generic") ? ["generic"] : []),
      // Easier to play from banish, for the scripted Opt rule (the maintainer, 20 Oct 2026).
      ...(card.attributes.hasRuneGate ? ["rune_gate"] : []),
      ...(card.attributes.hasUsurp ? ["usurp"] : []),
      ...(card.attributes.playableFromBanish ? ["playable_from_banish"] : []),
      // Auras, items, allies and landmarks stay in the arena when the turn ends (signed off).
      ...card.subtypes
        .filter((t) => PERMANENT_SUBTYPES.includes(t))
        .map((t) => t.toLowerCase()),
      ...(card.subtypes.includes("Aura") ? ["aura"] : []),
    ],
    type: card.type,
    amounts: {
      runechants: made("runechant", false),
      runechantsUnconditional: made("runechant", true),
      gates: made("gate", false),
      gatesUnconditional: made("gate", true),
    },
  };
}

/** A card as the engine sees it, with its roles worked out from its attributes. */
export function engineCardOf(
  card: CardSummary,
  variant: VariantSummary,
): EngineCard {
  return toEngineCard(
    card,
    variant,
    rolesOf({
      type: card.type,
      subtypes: card.subtypes,
      attributes: card.attributes,
      variantAttributes: card.variants.map((v) => v.attributes),
    }),
  );
}
