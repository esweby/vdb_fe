// The card filter groups (facets) used by the sidebar on every card list.
import { banishPlayRoutes, type CardAttributes, type Token } from "@vdb/cards";
import type {
  Facet,
  FacetValue,
  FilterState,
} from "../filters/applyFilters.ts";
import type { CardSummary } from "./cardRepository.ts";

/** Card-level attributes plus every pitch's overrides, for "does any version…" checks. */
const allAttributes = (c: CardSummary): Partial<CardAttributes>[] => [
  c.attributes,
  ...c.variants.map((v) => v.attributes),
];

const value = (
  id: string,
  label: string,
  test: (c: CardSummary) => boolean,
): FacetValue<CardSummary> => ({ id, label, test });

const creates = (token: Token) => (c: CardSummary) =>
  allAttributes(c).some((a) =>
    a.tokens?.some((t) => t.token === token && !t.grantedTo),
  );

const disrupts = (zone: string) => (c: CardSummary) =>
  allAttributes(c).some((a) => a.disrupts?.some((d) => d.from === zone));

const inGroup = (group: string) => (c: CardSummary) =>
  (c.attributes.groups as string[]).includes(group);

/** A stat group: a card matches a band if any of its pitches does. */
function statFacet(
  id: "power" | "defense",
  label: string,
  bands: [string, string, (n: number) => boolean][],
): Facet<CardSummary> {
  return {
    id,
    label,
    mode: "any",
    summaryPrefix: true,
    values: bands.map(([valueId, valueLabel, test]) =>
      value(valueId, valueLabel, (c) =>
        c.variants.some((v) => v[id] !== null && test(v[id]!)),
      ),
    ),
  };
}

/** Attack and defense reactions share one line; the rest follow TYPE_LABELS. */
const TYPE_VALUES: [string, string, string[]][] = [
  ["attack_action", "Attack action", ["attack_action"]],
  ["action", "Action", ["action"]],
  ["instant", "Instant", ["instant"]],
  ["reaction", "Reactions", ["attack_reaction", "defense_reaction"]],
  ["block", "Block", ["block"]],
  ["resource", "Resource", ["resource"]],
  ["weapon", "Weapon", ["weapon"]],
  ["equipment", "Equipment", ["equipment"]],
];

/** Red, yellow, blue, pitch 4 (the rare one), and no pitch (weapons, equipment). */
export const PITCH_VALUES: [string, string][] = [
  ["1", "Red"],
  ["2", "Yellow"],
  ["3", "Blue"],
  ["4", "Pitch 4"],
  ["none", "No pitch"],
];
export const pitchId = (pitch: number | null) =>
  pitch === null ? "none" : String(pitch);

export function cardFacets(
  context: { reviewedCardIds?: Set<string> } = {},
): Facet<CardSummary>[] {
  const facets: Facet<CardSummary>[] = [
    {
      id: "type",
      label: "Card type",
      mode: "any",
      values: TYPE_VALUES.map(([id, label, types]) =>
        value(id, label, (c) => types.includes(c.type)),
      ),
    },
    {
      id: "pitch",
      label: "Pitch",
      mode: "any",
      placement: "bar",
      values: PITCH_VALUES.map(([id, label]) =>
        value(id, label, (c) =>
          c.variants.some((v) => pitchId(v.pitch) === id),
        ),
      ),
    },
    {
      id: "class",
      label: "Class",
      mode: "any",
      placement: "bar",
      values: [
        value("Runeblade", "Runeblade", (c) => c.classes.includes("Runeblade")),
        value("Shadow", "Shadow", (c) => c.talents.includes("Shadow")),
        value("Generic", "Generic", (c) => c.classes.includes("Generic")),
      ],
    },
    {
      id: "slot",
      label: "Equipment slot",
      mode: "any",
      showWhen: (state) => state.type?.equipment !== "exclude",
      onlyAlso: {
        type: Object.fromEntries(
          TYPE_VALUES.filter(([id]) => id !== "equipment").map(([id]) => [
            id,
            "exclude" as const,
          ]),
        ),
      },
      values: ["Head", "Chest", "Arms", "Legs", "Off-Hand"].map((slot) =>
        value(
          slot,
          slot,
          (c) => c.type === "equipment" && c.subtypes.includes(slot),
        ),
      ),
    },
    statFacet("power", "Power", [
      ["0-1", "0–1", (n) => n <= 1],
      ["2-3", "2–3", (n) => n >= 2 && n <= 3],
      ["4-5", "4–5", (n) => n >= 4 && n <= 5],
      ["ge6", "6+", (n) => n >= 6],
    ]),
    statFacet("defense", "Defense", [
      ["0-1", "0–1", (n) => n <= 1],
      ["2", "2", (n) => n === 2],
      ["ge3", "3+", (n) => n >= 3],
    ]),
    {
      id: "keywords",
      label: "Keywords",
      mode: "all",
      kind: "feature",
      section: "Mechanics",
      values: [
        value("go_again", "Go again", (c) => c.attributes.hasGoAgain),
        value("conditional_go_again", "Conditional go again", (c) =>
          allAttributes(c).some((a) => a.goAgain),
        ),
        value("grants_go_again", "Grants go again", (c) =>
          allAttributes(c).some((a) => a.grantsGoAgain),
        ),
        value("blood_debt", "Blood debt", (c) => c.attributes.hasBloodDebt),
        value("rune_gate", "Rune Gate", (c) => c.attributes.hasRuneGate),
        value("usurp", "Usurp", (c) => c.attributes.hasUsurp),
        value(
          "specialization",
          "Viserai specialization",
          (c) => c.attributes.specialization === "Viserai",
        ),
      ],
    },
    {
      id: "creates",
      label: "Creates",
      mode: "all",
      kind: "feature",
      section: "Mechanics",
      values: [
        value("runechant", "Runechants", creates("runechant")),
        value("gate", "Gates to i'Arathael", creates("gate")),
        value("eloquence", "Eloquence", creates("eloquence")),
      ],
    },
    {
      id: "banish",
      label: "Plays from banish",
      mode: "any",
      kind: "feature",
      section: "Mechanics",
      values: [
        value("own_text", "By its own text", (c) =>
          banishPlayRoutes(c.attributes).includes("own_text"),
        ),
        value("gate", "With a Gate", (c) =>
          banishPlayRoutes(c.attributes).includes("gate"),
        ),
        value("rune_gate", "With Rune Gate", (c) =>
          banishPlayRoutes(c.attributes).includes("rune_gate"),
        ),
      ],
    },
    {
      id: "tags",
      label: "Tags",
      mode: "all",
      kind: "feature",
      section: "Mechanics",
      values: [
        value(
          "banishes_from_hand",
          "Banishes from hand",
          inGroup("banishes_from_hand"),
        ),
        value(
          "rewards_shadow_banish",
          "Shadow banish payoff",
          inGroup("rewards_shadow_banish"),
        ),
        value(
          "rewards_runeblade_banish",
          "Runeblade banish payoff",
          inGroup("rewards_runeblade_banish"),
        ),
        value(
          "triggers_when_banished",
          "Triggers when banished",
          inGroup("triggers_when_banished"),
        ),
        value("sinchant", "Sinchant", inGroup("runechant_aura")),
        value("can_attack", "Weapon attack", (c) => c.attributes.canAttack),
        value("cost_per_runechant", "Cheaper per Runechant", (c) =>
          allAttributes(c).some(
            (a) =>
              a.costReducedPerRunechant ||
              a.costReductions?.some((r) => r.amount === "per_runechant"),
          ),
        ),
        value("instant_speed", "Instant speed", (c) =>
          allAttributes(c).some((a) => a.instantSpeed),
        ),
        value("rewards_play_from_banish", "Better from banish", (c) =>
          allAttributes(c).some((a) => a.rewardsPlayFromBanish),
        ),
        value("one_use", "One use", (c) =>
          allAttributes(c).some((a) => a.oneUse),
        ),
      ],
    },
    {
      id: "disrupts",
      label: "Disrupts",
      mode: "all",
      kind: "feature",
      section: "Mechanics",
      values: [
        value("hand", "Hand", disrupts("hand")),
        value("arsenal", "Arsenal", disrupts("arsenal")),
        value("deck_top", "Top of deck", disrupts("deck_top")),
        value("graveyard", "Graveyard", disrupts("graveyard")),
        value("soul", "Soul", disrupts("soul")),
        value("auras", "Auras", disrupts("auras")),
      ],
    },
    {
      id: "verified",
      label: "Attributes",
      mode: "any",
      values: [
        value("verified", "Verified", (c) => c.attributesVerified),
        value("unverified", "Unverified", (c) => !c.attributesVerified),
      ],
    },
    ...(context.reviewedCardIds
      ? [
          {
            id: "reviewed",
            label: "My reviews",
            mode: "any" as const,
            values: [
              value("reviewed", "Reviewed by me", (c) =>
                context.reviewedCardIds!.has(c.id),
              ),
              value(
                "unreviewed",
                "Not reviewed by me",
                (c) => !context.reviewedCardIds!.has(c.id),
              ),
            ],
          },
        ]
      : []),
  ];
  return facets;
}

/** Whether a pitch's rows or tiles are shown, given the pitch toggles. */
export function pitchShown(state: FilterState, pitch: number | null): boolean {
  const choices = state.pitch ?? {};
  const id = pitchId(pitch);
  if (choices[id] === "exclude") return false;
  const includes = Object.values(choices).includes("include");
  return !includes || choices[id] === "include";
}
