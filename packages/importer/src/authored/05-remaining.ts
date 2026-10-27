// Batch 5: the remaining Runeblade and Shadow cards.
// Drafted from card text, all unverified. Review sheet: docs/reviews/05-remaining.md
import type { AuthoredAttributes } from "../map.ts";

export const remaining: AuthoredAttributes = {
  "Call for Backup": {
    verified: false,
    card: {
      notes:
        "When this defends, choose 2 differently named attack action cards in your graveyard. An opponent chooses 1 to banish; put the other on top of your deck.",
    },
  },
  "Sink Below": {
    verified: false,
    card: {
      notes:
        "You may put a card from your hand on the bottom of your deck. If you do, draw a card.",
    },
  },
  "Looking for a Scrap": {
    verified: false,
    card: {
      notes:
        "As an additional cost, you may banish a 1-power card from your graveyard. If you do, this gets +1 power and go again.",
    },
  },
  // Approved by the maintainer, 24 Oct 2026: conditional, not natural go again.
  "Scar for a Scar": {
    verified: true,
    card: { goAgain: { conditions: ["less_life_than_opposing_hero"] } },
  },
  // Costs less per Runechant
  "Amplify the Arknight": {
    verified: true,
    card: { costReducedPerRunechant: true },
  },
  "Bequest the Vast Beyond": {
    verified: true,
    card: {
      costReductions: [
        {
          amount: "per_runechant",
          grantedTo: "next_runeblade_attack_action",
        },
      ],
    },
  },
  "Drawn to the Dark Dimension": {
    verified: true,
    card: {
      costReducedPerRunechant: true,
      notes: "When it attacks, draw a card.",
    },
  },
  "Ninth Blade of the Blood Oath": {
    verified: true,
    card: { costReducedPerRunechant: true },
  },
  "Rune Flash": {
    verified: true,
    card: { costReducedPerRunechant: true },
  },
  "Runic Reckoning": {
    verified: true,
    card: {
      costReducedPerRunechant: true,
      notes: "Your next Runeblade attack action card this turn gets +3 power.",
    },
  },
  "Sonata Galaxia": {
    verified: true,
    card: {
      costReducedPerRunechant: true,
      tutors: [
        {
          target: { group: "runeblade_aura" },
          to: "arena",
          trigger: "on_play",
        },
      ],
      goAgain: { conditions: ["x_is_2_or_more"] },
      notes: "Only a Runeblade aura costing X or less.",
    },
  },

  // Tutors
  "Become the Arknight": {
    verified: true,
    card: {
      tutors: [
        {
          target: { group: "runeblade_non_attack_action" },
          to: "hand",
          trigger: "on_play",
          conditions: ["discarded_attack_action"],
        },
        {
          target: { group: "runeblade_attack_action" },
          to: "hand",
          trigger: "on_play",
          conditions: ["discarded_non_attack_action"],
        },
      ],
      notes: "Discarding an action card is optional.",
    },
  },

  // Arcane damage
  "Aether Slash": {
    verified: true,
    card: {
      arcaneDamage: [
        {
          amount: 1,
          trigger: "on_attack",
          conditions: ["pitched_non_attack_action"],
        },
      ],
    },
  },
  "Arcanic Crackle": {
    verified: true,
    card: { arcaneDamage: [{ amount: 1, trigger: "on_attack" }] },
  },
  "Deny Redemption": {
    verified: true,
    card: {
      arcaneDamage: [{ amount: 1, trigger: "on_attack" }],
      notes:
        "Only against a hero with more life than you, and it can't be prevented. Instant, discard it: heroes can't gain life this turn.",
    },
  },
  "Looming Doom": {
    verified: true,
    card: {
      arcaneDamage: [{ amount: 2, trigger: "your_end_phase" }],
      notes:
        "Destroys all your Runechants when it enters; deals 2 arcane damage at each of your end phases, once per Runechant destroyed.",
    },
  },
  "Sigil of Gravespawning": {
    verified: true,
    card: {
      notes:
        "Deals 1 arcane damage whenever an aura leaves your graveyard. Destroyed at your next action phase.",
    },
  },
  "Sigil of Suffering": {
    verified: true,
    card: {
      arcaneDamage: [{ amount: 1, trigger: "on_play" }],
      conditionalBonuses: [
        {
          effect: "plus_defense",
          amount: 1,
          conditions: ["dealt_arcane_damage_this_turn"],
        },
      ],
      notes: "The arcane damage hits the attacking hero.",
    },
  },
  "Singeing Steelblade": {
    verified: true,
    card: { arcaneDamage: [{ amount: 1, trigger: "on_attack" }] },
  },
  "Sting of Sorcery": {
    verified: true,
    card: {
      arcaneDamage: [
        {
          amount: 1,
          trigger: "on_attack",
          grantedTo: "all_attack_actions_this_turn",
        },
      ],
      notes: "Destroyed at the beginning of your end phase.",
    },
  },
  "Vexing Malice": {
    verified: true,
    card: { arcaneDamage: [{ amount: 2, trigger: "on_attack" }] },
  },

  // Rewards dealing arcane damage
  "Arcanic Spike": {
    verified: true,
    card: {
      conditionalBonuses: [
        {
          effect: "plus_power",
          amount: 2,
          conditions: ["dealt_arcane_damage_this_turn"],
        },
      ],
    },
  },
  "Consuming Volition": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          conditions: ["dealt_arcane_damage_this_turn"],
        },
      ],
    },
  },
  "Succumb to Temptation": {
    verified: true,
    card: {
      instantSpeed: { conditions: ["dealt_arcane_damage_this_turn"] },
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          grantedTo: "next_runeblade_attack_action",
        },
      ],
      notes: "You look at their hand and choose the card.",
    },
  },

  // Rewards playing or creating auras
  "Drowning Dire": {
    verified: true,
    card: {
      conditionalBonuses: [
        {
          effect: "dominate",
          conditions: ["played_or_created_aura_this_turn"],
        },
      ],
      notes:
        "When it hits, may put a non-attack action card from your graveyard on the bottom of your deck. Dominate is listed as a keyword but is conditional.",
    },
  },
  "Hit the High Notes": {
    verified: true,
    card: {
      conditionalBonuses: [
        {
          effect: "plus_power",
          amount: 2,
          conditions: ["played_or_created_aura_this_turn"],
        },
      ],
    },
  },
  "Reek of Corruption": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          conditions: ["played_or_created_aura_this_turn"],
        },
      ],
    },
  },
  "Runerager Swarm": {
    verified: true,
    card: { goAgain: { conditions: ["played_or_created_aura_this_turn"] } },
  },
  "Shrill of Skullform": {
    verified: true,
    card: {
      conditionalBonuses: [
        {
          effect: "plus_power",
          amount: 3,
          conditions: ["played_or_created_aura_this_turn"],
        },
      ],
    },
  },
  "Swarming Gloomveil": {
    verified: true,
    card: {
      goAgain: { conditions: ["played_or_created_aura_this_turn"] },
      conditionalBonuses: [
        {
          effect: "plus_power",
          amount: 1,
          conditions: ["played_or_created_2_or_more_auras_this_turn"],
        },
        {
          effect: "arcane_cant_be_prevented",
          conditions: ["played_or_created_3_or_more_auras_this_turn"],
        },
      ],
      notes:
        "The thresholds stack: with 3 or more auras it has go again, +1 power and the arcane effect.",
    },
  },
  "Vantage Point": {
    verified: true,
    card: {
      conditionalBonuses: [
        {
          effect: "overpower",
          conditions: ["played_or_created_aura_this_turn"],
        },
      ],
      notes: "Overpower is listed as a keyword but is conditional.",
    },
  },
  "Machinations of Dominion": {
    verified: true,
    card: {
      conditionalBonuses: [
        { effect: "overpower", grantedTo: "next_runeblade_attack_action" },
      ],
      grantsGoAgain: {
        to: "next_runeblade_attack_action",
        conditions: ["played_or_created_aura_this_turn"],
      },
    },
  },

  // Aura destruction and disruption
  "Caress of the Reaper": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "destroy",
          from: "auras",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
        },
      ],
      notes: "Whenever it deals damage to a hero.",
    },
  },
  "Condemn to Slaughter": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "destroy",
          from: "auras",
          amount: 1,
          target: "opponent",
          trigger: "on_play",
          conditions: ["destroyed_own_aura"],
        },
      ],
      notes:
        "Destroying your own aura is optional (a Runechant counts). Your next Runeblade attack gets +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Cryptic Crossing": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          conditions: ["pitched_attack_action", "pitched_non_attack_action"],
        },
      ],
      notes: "The first time it deals damage; you also draw a card.",
    },
  },
  "Diabolic Ultimatum": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "destroy",
          from: "auras",
          amount: 1,
          target: "each_hero",
          trigger: "on_play",
          conditions: ["pitched_non_attack_action"],
        },
      ],
      notes:
        "If an attack action card was pitched, each hero destroys an ally instead (or as well, if both were pitched).",
    },
  },
  Doomsaying: {
    verified: true,
    card: {
      disrupts: [
        {
          action: "destroy",
          from: "auras",
          amount: "X",
          target: "each_hero",
          trigger: "your_end_phase",
        },
      ],
      notes:
        "X is its doom counters, +1 each end phase. Your Runechants are auras too.",
    },
  },
  "Leech Renown": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "destroy",
          from: "auras",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          grantedTo: "next_attack_action",
        },
      ],
      notes: "Only an aura token. That attack also gets +3 power.",
    },
  },
  "Snuff Out": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          conditions: ["destroyed_own_aura"],
          optional: true,
        },
      ],
      notes: "Destroying your own aura (a Runechant counts) is the cost.",
    },
  },

  // Card advantage and other
  "Arcanic Cunning": {
    verified: true,
    card: {
      notes:
        "While attacking, defending or on the stack, prevents 1 of any arcane damage you'd be dealt.",
    },
  },
  "Leech Memory": {
    verified: true,
    card: {
      notes:
        "Your next attack action card gets +3 power and may put an attack action card from your graveyard on the bottom of your deck when it deals damage.",
    },
  },
  "Leech Vitality": {
    verified: true,
    card: {
      notes:
        "Your next attack action card gets +3 power and gains you 1 life when it deals damage.",
    },
  },
  "Sigil of the Arknight": {
    verified: true,
    card: {
      notes:
        "When it leaves the arena (at your next action phase), reveal the top card; if it's an attack action card, put it into your hand.",
    },
  },
  Slay: { verified: true, card: { notes: "Destroys an angel ally (Light)." } },
  "Soul of Existence": {
    verified: true,
    card: { notes: "Pitch 4 resource. When pitched, lose 1 life." },
  },
  "Tome of the Arknight": {
    verified: true,
    card: {
      notes:
        "Reveals the top 2; if they're an attack action card and a non-attack action card, both go into your hand.",
    },
  },
};
