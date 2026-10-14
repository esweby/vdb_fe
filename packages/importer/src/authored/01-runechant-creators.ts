// Batch 1: Runeblade and Shadow deck cards that create Runechants.
// Drafted from card text, all unverified. Review sheet: docs/reviews/01-runechant-creators.md
import type { AuthoredAttributes } from "../map.ts";

export const runechantCreators: AuthoredAttributes = {
  "Arcane Cussing": {
    verified: true,
    card: {
      notes: "Only creates Runechants if it leaves the arena during your turn.",
    },
    variants: {
      1: {
        tokens: [{ token: "runechant", amount: 3, trigger: "on_leave_arena" }],
      },
      2: {
        tokens: [{ token: "runechant", amount: 2, trigger: "on_leave_arena" }],
      },
      3: {
        tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }],
      },
    },
  },
  "Arknight Ascendancy": {
    verified: true,
    card: {
      costReducedPerRunechant: true,
      tokens: [{ token: "runechant", amount: "X", trigger: "on_hit" }],
      notes: "X is the damage dealt by the hit.",
    },
  },
  "Arknight Descendancy": {
    verified: true,
    card: {
      costReducedPerRunechant: true,
      tokens: [{ token: "runechant", amount: "X", trigger: "on_banished" }],
      notes: "Banished from anywhere; X is the life paid, up to 3.",
    },
  },
  "Arknight Shard": {
    verified: true,
    card: { tokens: [{ token: "runechant", amount: 1, trigger: "on_pitch" }] },
  },
  "Blessing of Occult": {
    verified: true,
    variants: {
      1: {
        tokens: [{ token: "runechant", amount: 3, trigger: "start_of_turn" }],
      },
      2: {
        tokens: [{ token: "runechant", amount: 2, trigger: "start_of_turn" }],
      },
      3: {
        tokens: [{ token: "runechant", amount: 1, trigger: "start_of_turn" }],
      },
    },
  },
  "Bloodspill Invocation": {
    verified: true,
    card: { notes: "Destroyed (no Runechants) if you're dealt damage first." },
    variants: {
      1: {
        tokens: [
          { token: "runechant", amount: 3, trigger: "your_attack_action_hits" },
        ],
      },
      2: {
        tokens: [
          { token: "runechant", amount: 2, trigger: "your_attack_action_hits" },
        ],
      },
      3: {
        tokens: [
          { token: "runechant", amount: 1, trigger: "your_attack_action_hits" },
        ],
      },
    },
  },
  "Deadwood Dirge": {
    verified: true,
    variants: {
      1: {
        tokens: [
          {
            token: "runechant",
            amount: 3,
            trigger: "on_play",
            conditions: ["destroyed_own_aura"],
          },
        ],
      },
      2: {
        tokens: [
          {
            token: "runechant",
            amount: 2,
            trigger: "on_play",
            conditions: ["destroyed_own_aura"],
          },
        ],
      },
      3: {
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_play",
            conditions: ["destroyed_own_aura"],
          },
        ],
      },
    },
  },
  "Deathly Duet": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 2,
          trigger: "on_attack",
          conditions: ["pitched_non_attack_action"],
        },
      ],
      notes: "Also +2 power if an attack action card was pitched.",
    },
  },
  "Deathly Wail": {
    verified: true,
    card: {
      tokens: [
        { token: "runechant", amount: "X", trigger: "combat_chain_closes" },
      ],
      notes: "X is the number of heroes who have lost life this turn.",
    },
  },
  "Douse in Runeblood": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_attack" }],
      goAgain: { conditions: ["created_3_or_more_runechants"] },
      notes:
        "X is the number of non-attack action cards you've played this turn.",
    },
  },
  "Dread Triptych": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_attack",
          conditions: ["played_non_attack_action_this_turn"],
        },
        {
          token: "runechant",
          amount: 1,
          trigger: "on_attack",
          conditions: ["dealt_arcane_damage_this_turn"],
        },
        { token: "runechant", amount: 1, trigger: "on_hit" },
      ],
    },
  },
  "Embrace Ursur": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_attack",
          conditions: ["banished_card_is_runeblade"],
        },
      ],
      goAgain: { conditions: ["banished_card_is_shadow"] },
    },
  },
  "Enshrine Sin": {
    verified: true,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Costs {r} equal to pitch value when played from banish.",
    },
  },
  "Envelop in Darkness": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes:
        "Also gives the next attack action card you rune gate this turn +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Forbidden Harvest": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      notes:
        "Turns up to 3 cards in your banished zone face-down; X is the number of Shadow cards turned.",
    },
  },
  "Funeral Moon": {
    verified: true,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Can be played as an instant if a hero has lost life this turn.",
    },
  },
  "Haunting Rendition": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes:
        "Discard to prevent the next 2 damage; the Runechant comes the first time damage is prevented this way.",
    },
  },
  "Hocus Pocus": {
    verified: true,
    card: { tokens: [{ token: "runechant", amount: 1, trigger: "on_attack" }] },
  },
  "Jack-o'-lantern": {
    verified: true,
    card: {
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["top_card_matches_pitch"],
        },
      ],
    },
  },
  "Malefic Incantation": {
    verified: true,
    card: {
      notes:
        "At most one Runechant per turn, until its verse counters run out.",
    },
    variants: {
      1: {
        tokens: [
          {
            token: "runechant",
            amount: 3,
            trigger: "your_attack_action_played",
          },
        ],
      },
      2: {
        tokens: [
          {
            token: "runechant",
            amount: 2,
            trigger: "your_attack_action_played",
          },
        ],
      },
      3: {
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "your_attack_action_played",
          },
        ],
      },
    },
  },
  "Mauvrion Skies": {
    verified: true,
    card: { grantsGoAgain: "next_runeblade_attack_action" },
    variants: {
      1: {
        tokens: [
          {
            token: "runechant",
            amount: 3,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      },
      2: {
        tokens: [
          {
            token: "runechant",
            amount: 2,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      },
      3: {
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      },
    },
  },
  "Meat and Greet": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_hit" }],
      goAgain: { conditions: ["dealt_arcane_damage_to_opponent_this_turn"] },
    },
  },
  "Mordred Tide": {
    verified: true,
    card: {
      notes:
        "Doesn't create Runechants itself: until end of turn, each time you create Runechants you create 1 extra. The vocabulary can't express this yet.",
    },
  },
  "Murmuring Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      tokens: [
        { token: "runechant", amount: 1, trigger: "on_attack" },
        { token: "runechant", amount: 1, trigger: "on_hit" },
      ],
    },
  },
  "Oath of the Arknight": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes:
        "Also gives your next Runeblade attack +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Otherworldly Sins": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes:
        "Also gives your next Runeblade or Shadow attack +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Promise of Power": {
    verified: true,
    card: {
      tokens: [
        { token: "runechant", amount: 2, trigger: "your_attack_action_played" },
      ],
      notes:
        "Only the next attack action card you play from your banished zone this turn.",
    },
  },
  "Read the Runes": {
    verified: true,
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_play" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "on_play" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }] },
    },
  },
  "Reduce to Runechant": {
    verified: true,
    card: {
      costReducedPerRunechant: true,
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
    },
  },
  "Revel in Runeblood": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 4,
          trigger: "on_play",
          conditions: [
            "played_attack_action_this_turn",
            "played_non_attack_action_this_turn",
          ],
        },
      ],
      notes:
        "Requires another non-attack action card besides this one. Destroys all your Runechants at your end phase.",
    },
  },
  "Runeblood Barrier": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 4, trigger: "on_play" }],
      notes:
        "Created when it enters the arena. Prevents damage by destroying Runechants; destroyed at your next action phase.",
    },
  },
  "Runeblood Incantation": {
    verified: true,
    card: {
      notes:
        "One Runechant per turn at the start of your action phase, until its verse counters run out.",
    },
    variants: {
      1: {
        tokens: [
          { token: "runechant", amount: 3, trigger: "start_of_action_phase" },
        ],
      },
      2: {
        tokens: [
          { token: "runechant", amount: 2, trigger: "start_of_action_phase" },
        ],
      },
      3: {
        tokens: [
          { token: "runechant", amount: 1, trigger: "start_of_action_phase" },
        ],
      },
    },
  },
  "Runechant of Envy": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, gain 1 life.",
    },
  },
  "Runechant of Gluttony": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, gain {r}.",
    },
  },
  "Runechant of Greed": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, draw a card.",
    },
  },
  "Runechant of Lust": {
    verified: true,
    card: {
      tokens: [
        { token: "runechant", amount: 1, trigger: "on_usurped" },
        { token: "runechant", amount: 1, trigger: "on_destroyed" },
      ],
      notes: "Counts as a Runechant itself.",
    },
  },
  "Runechant of Pride": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes:
        "Counts as a Runechant itself. When usurped, the attack gets +1 power.",
    },
  },
  "Runechant of Sloth": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes:
        "Counts as a Runechant itself. When usurped, the attack gets go again.",
    },
  },
  "Runechant of Wrath": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes:
        "Counts as a Runechant itself. When usurped, the attack gets overpower.",
    },
  },
  "Runic Disposition": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Activated by discarding it (instant).",
    },
  },
  "Runic Reaping": {
    verified: true,
    card: {
      notes:
        "Also +1 power to that attack if an attack action card was pitched to play this.",
    },
    variants: {
      1: {
        tokens: [
          {
            token: "runechant",
            amount: 3,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      },
      2: {
        tokens: [
          {
            token: "runechant",
            amount: 2,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      },
      3: {
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_hit",
            grantedTo: "next_runeblade_attack_action",
          },
        ],
      },
    },
  },
  "Runic Reaving": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Activated by discarding it (instant).",
    },
  },
  "Runic Reclamation": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_hit" }],
      notes:
        "Only if it destroys an aura the hit hero controls. No condition exists for opponent auras yet.",
    },
  },
  "Sigil of Deadwood": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }],
      notes: "Destroys itself at the start of your next action phase.",
    },
  },
  "Sky Fire Lanterns": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["top_card_matches_pitch"],
        },
      ],
      notes: "Reveals the top card; doesn't banish it.",
    },
  },
  "Sonata Dystopia": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: "X",
          trigger: "on_hit",
          grantedTo: "next_attack_action",
        },
      ],
      notes:
        "Costs destroying X Runechants. The next attack action card also costs {x} less, gets +X power and overpower.",
    },
  },
  "Sonata Fantasmia": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      notes: "If X is 6 or more, target hero discards 3 random cards.",
    },
  },
  "Spellblade Assault": {
    verified: true,
    card: { tokens: [{ token: "runechant", amount: 2, trigger: "on_attack" }] },
  },
  "Spellblade Strike": {
    verified: true,
    card: { tokens: [{ token: "runechant", amount: 1, trigger: "on_attack" }] },
  },
  "Splintering Deadwood": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_attack",
          conditions: ["destroyed_own_aura"],
        },
        {
          token: "runechant",
          amount: 1,
          trigger: "on_hit",
          conditions: ["destroyed_own_aura"],
        },
      ],
      notes: "Destroying your aura is optional each time.",
    },
  },
  "Sutcliffe's Research Notes": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      notes:
        "Reveals the top 3/2/1 cards (red/yellow/blue); X is the number of Runeblade attack action cards revealed.",
    },
  },
};
