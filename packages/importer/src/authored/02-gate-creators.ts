// Batch 2: Runeblade and Shadow deck cards that create Gates to i'Arathael.
// Drafted from card text, all unverified. Review sheet: docs/reviews/02-gate-creators.md
import type { AuthoredAttributes } from "../map.ts";

export const gateCreators: AuthoredAttributes = {
  "Breach Flesh": {
    verified: true,
    card: { tokens: [{ token: "gate", amount: 1, trigger: "on_hit" }] },
  },
  "Corporeal Chasm": {
    verified: true,
    card: { tokens: [{ token: "gate", amount: 1, trigger: "on_hit" }] },
  },
  "Countdown to Extinction": {
    verified: false,
    card: {
      tokens: [{ token: "gate", amount: 1, trigger: "on_attack" }],
      tutors: [
        {
          target: { card: "Darkest Hour" },
          to: "banished",
          trigger: "on_hit",
          optional: true,
        },
      ],
    },
  },
  "Dam the Shadowake": {
    verified: true,
    card: {
      tokens: [{ token: "gate", amount: 1, trigger: "on_defend" }],
      notes:
        "Only when it defends a Shadow hero's attack, so it depends on the opponent. No condition exists for that yet.",
    },
  },
  "Harbinger of Destruction": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      tokens: [
        {
          token: "gate",
          amount: 2,
          trigger: "on_hit",
          conditions: ["banished_card_is_shadow"],
        },
      ],
      notes: "Banishing a card from hand is an additional cost to play it.",
    },
  },
  "Open the Gate to i'Arathael": {
    verified: true,
    card: {
      tokens: [
        { token: "gate", amount: 1, trigger: "on_hit" },
        { token: "gate", amount: 1, trigger: "on_banished" },
      ],
      notes: "The banish trigger only counts when banished from hand or deck.",
    },
  },
  "Planar Chaos": {
    verified: true,
    card: {
      tokens: [{ token: "gate", amount: 1, trigger: "on_play" }],
      notes:
        "The next Gate you activate this turn can target an action card with blood debt in any banished zone, including an opponent's.",
    },
  },
  "Pull from Beyond": {
    verified: true,
    card: {
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
      tokens: [
        {
          token: "gate",
          amount: 1,
          trigger: "on_play",
          conditions: ["top_card_matches_pitch"],
        },
      ],
      notes: "Opt 2 before banishing, so you can set up the top card.",
    },
  },
  "Rites of Nightfall": {
    verified: true,
    card: { tokens: [{ token: "gate", amount: 1, trigger: "on_play" }] },
  },
  "Shadowake Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "gate", amount: 1, trigger: "on_hit" }],
    },
  },
  "Step through Realms": {
    verified: true,
    card: {
      tokens: [
        {
          token: "gate",
          amount: 1,
          trigger: "on_hit",
          grantedTo: "next_shadow_attack",
        },
      ],
      notes: "That attack also gets +4/+3/+2 power (red/yellow/blue).",
    },
  },
  "Unbound by Shadow": {
    verified: true,
    card: {
      tokens: [
        {
          token: "gate",
          amount: 1,
          trigger: "on_attack",
          conditions: ["played_from_banish"],
        },
      ],
    },
  },
};
