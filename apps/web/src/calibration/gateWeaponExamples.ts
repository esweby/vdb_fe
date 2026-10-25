// Maintainer-approved lines and bounded Descendancy extension, not a default policy change.
import { parseScript, type Script } from "@vdb/engine/rules";

export interface GateWeaponExample {
  id: string;
  purpose: string;
  review: "unverified" | "approved";
  preconditions: readonly string[];
  script: Script;
}

export function descendancyComfortableAfterPayment(
  life: number,
  payment: number,
): boolean {
  return life - payment >= 25;
}

export const GATE_WEAPON_EXAMPLES: readonly GateWeaponExample[] = [
  {
    id: "descendancy-first",
    review: "approved",
    purpose:
      "Play gated Descendancy, then swing Nebula, retaining the other hand cards.",
    preconditions: [
      "Usurper, one action point, an unused Nebula, at least four Runechants and a Gate.",
      "Blue Descendancy is already face up in banish and is the first blood debt attack this turn.",
      "At least 25 current life after any earlier payment; enough floating resources for Gate, Descendancy and Nebula.",
      "No automatic pitching or further life payment; other hand cards are left alone.",
    ],
    script: parseScript({
      version: 1,
      steps: [
        {
          do: "activateGate",
          target: { name: "Arknight Descendancy", pitch: 3 },
        },
        {
          do: "play",
          from: "banished",
          card: { name: "Arknight Descendancy", pitch: 3 },
        },
        { do: "attackWithWeapon", weapon: { name: "Seven Sin Nebula" } },
      ],
    }),
  },
  {
    id: "own-usurp-no-gate",
    review: "approved",
    purpose: "Use Bloodfrenzy's own banish permission without spending a Gate.",
    preconditions: [
      "Usurper, one action point, two resources and an unused Nebula.",
      "Red Bloodfrenzy is face up in banish, not in hand; it is the turn's first blood debt attack.",
      "No traverse back is requested.",
    ],
    script: parseScript({
      version: 1,
      steps: [
        { do: "play", card: { name: "Bloodfrenzy Gloomblade", pitch: 1 } },
        { do: "attackWithWeapon", weapon: { name: "Seven Sin Nebula" } },
      ],
    }),
  },
  {
    id: "own-usurp-traverse-back",
    review: "approved",
    purpose:
      "Spend a Gate on that same card only for an explicitly requested traverse back.",
    preconditions: [
      "Usurper, one action point, three resources, one Gate and an unused Nebula.",
      "Red Bloodfrenzy is face up in banish, not in hand; it is the turn's first blood debt attack.",
      "The caller explicitly wants to traverse back; this example does not infer momentum.",
    ],
    script: parseScript({
      version: 1,
      choices: { optional: { "viserai-usurper-traverse": true } },
      steps: [
        {
          do: "activateGate",
          target: { name: "Bloodfrenzy Gloomblade", pitch: 1 },
        },
        { do: "play", card: { name: "Bloodfrenzy Gloomblade", pitch: 1 } },
        { do: "attackWithWeapon", weapon: { name: "Seven Sin Nebula" } },
        { do: "endTurn" },
      ],
    }),
  },
  {
    id: "spare-shard-descendancy",
    review: "approved",
    purpose:
      "Fund Gate, Descendancy and Nebula with the reviewed spare Shard, keeping BSL.",
    preconditions: [
      "Usurper, one action point, 25 current life, zero resources, four Runechants, one Gate and an unused Nebula.",
      "Blue Descendancy is face up in banish and would be the first blood debt attack this turn.",
      "The hand is blue Shard and blue BSL; the caller explicitly marks Shard spare and BSL reserved.",
      "No life is paid and no other pitch preference is inferred.",
    ],
    script: parseScript({
      version: 1,
      choices: { lifePayment: 0 },
      steps: [
        { do: "pitch", card: { name: "Arknight Shard", pitch: 3 } },
        {
          do: "activateGate",
          target: { name: "Arknight Descendancy", pitch: 3 },
        },
        {
          do: "play",
          from: "banished",
          card: { name: "Arknight Descendancy", pitch: 3 },
        },
        { do: "attackWithWeapon", weapon: { name: "Seven Sin Nebula" } },
      ],
    }),
  },
  {
    id: "spare-sword",
    review: "approved",
    purpose:
      "Use an already floating resource without pitching a reserved starter.",
    preconditions: [
      "An action point and one resource remain, Nebula is unused, and a card was played from banish this turn.",
      "The caller has finished other plays or explicitly reserved the remaining hand for next turn.",
      "The script does not evaluate which card is a better starter, and never pitches to fund this swing.",
    ],
    script: parseScript({
      version: 1,
      steps: [{ do: "attackWithWeapon", weapon: { name: "Seven Sin Nebula" } }],
    }),
  },
  {
    id: "spare-shard-sword",
    review: "approved",
    purpose:
      "Pitch an explicitly designated spare Shard while keeping the chosen starter.",
    preconditions: [
      "Usurper, an action point, zero resources, an unused Nebula and a card played from banish this turn.",
      "The caller designates blue Shard as spare and Become the Shadow Lord as the reserved starter.",
      "This is an explicit hand decision, not a general rule to pitch Shard or preserve BSL.",
    ],
    script: parseScript({
      version: 1,
      steps: [
        { do: "pitch", card: { name: "Arknight Shard", pitch: 3 } },
        { do: "attackWithWeapon", weapon: { name: "Seven Sin Nebula" } },
      ],
    }),
  },
];
