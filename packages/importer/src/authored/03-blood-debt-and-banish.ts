// Batch 3: Runeblade and Shadow deck cards with blood debt, banishing or playing from banish
// (not already covered by batches 1 and 2). Drafted from card text, all unverified.
// Review sheet: docs/reviews/03-blood-debt-and-banish.md
import type { AuthoredAttributes } from "../map.ts";

export const bloodDebtAndBanish: AuthoredAttributes = {
  "Abyssal Bite": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes: "Your next Shadow attack this turn gets +1 power.",
    },
  },
  "Abyssal Force": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes: "Your next Shadow attack this turn gets overpower.",
    },
  },
  "Abyssal Rush": {
    verified: true,
    card: {
      playableFromBanish: {},
      grantsGoAgain: "next_shadow_attack",
      notes: "The go again is granted only when that attack hits.",
    },
  },
  "Beseech the Demigon": {
    verified: true,
    card: {
      notes:
        "Gives an attack action card in your banished zone +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Blood Tribute": {
    verified: true,
    card: {
      // Opt 3/2/1 comes from each pitch's text (optsFromText).
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
    },
  },
  "Bloodfrenzy Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      goAgain: { conditions: ["dealt_damage_to_defending_hero_this_turn"] },
    },
  },
  "Bloodsong Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      disrupts: [
        {
          action: "banish",
          from: "auras",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          optional: true,
        },
      ],
    },
  },
  "Bounding Demigon": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      playableFromBanish: {
        conditions: ["played_non_attack_action_this_turn"],
      },
      notes: "From banish: +1 power.",
    },
  },
  "Chains of Mephetis": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes:
        "While in the arena, draws during an action phase become banish-the-top-card-and-may-play-it (for every hero).",
    },
  },
  "Consuming Aftermath": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
      conditionalBonuses: [
        { effect: "dominate", conditions: ["banished_card_is_shadow"] },
      ],
      notes:
        "Banishing is an optional additional cost. Dominate is listed as a keyword in the dataset but is conditional.",
    },
  },
  "Corrupt and Conquer": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      disrupts: [
        {
          action: "banish",
          from: "arsenal",
          amount: "all",
          target: "defending_hero",
          trigger: "on_hit",
        },
      ],
      notes:
        "From banish: defense reaction cards can't be played this chain link.",
    },
  },
  Cull: {
    verified: true,
    card: {
      playableFromBanish: {},
      disrupts: [
        {
          action: "banish",
          from: "hand",
          amount: 1,
          target: "each_hero",
          trigger: "on_play",
        },
      ],
      instantSpeed: { conditions: ["hero_lost_life_this_turn"] },
    },
  },
  "Cullingsong Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      disrupts: [
        {
          action: "banish",
          from: "hand",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
        },
      ],
    },
  },
  "Dabble in Darkness": {
    verified: true,
    card: {
      banishesOwn: [{ from: "deck_top", trigger: "on_attack" }],
      notes: "Loses power equal to the banished card's pitch value.",
    },
  },
  "Darkest Hour": {
    verified: true,
    card: {
      notes:
        "Your next Shadow attack gets +4/+3/+2 power (red/yellow/blue). Can be paid for by putting a card from hand on top of your deck.",
    },
  },
  "Deathly Delight": {
    verified: true,
    card: {
      notes: "Gain life equal to the number of heroes who lost life this turn.",
    },
  },
  "Deep Recesses of Existence": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "combat_chain_closes", optional: true }],
      disrupts: [
        {
          action: "banish",
          from: "graveyard",
          amount: 1,
          target: "each_hero",
          trigger: "combat_chain_closes",
          conditions: ["hero_lost_life_this_turn"],
        },
      ],
      notes:
        "Banished face-down, so it can't be played from banish. Only heroes who have lost life this turn banish from their graveyard.",
    },
  },
  "Demonbound Gloomblade": {
    verified: true,
    card: { playableFromBanish: {} },
  },
  "Depths of Despair": {
    verified: true,
    card: {
      banishesSelf: [
        { trigger: "combat_chain_closes", conditions: ["it_defended"] },
      ],
    },
  },
  "Dimenxxional Crossroads": {
    // Back to unverified: the role and destroyedOnLifeLoss below wait for the maintainer.
    verified: false,
    card: {
      // Pays off cards played from the banished zone; destroyed by losing life on your turn, so
      // blood debt kills it in your end phase (20 Oct 2026).
      roles: { add: ["banish_play_payoff"] },
      destroyedOnLifeLoss: true,
      notes:
        "Deals 1 arcane damage the first time each turn you play an attack action card, and the first time a non-attack action card, from the banished zone. Destroyed if you lose life on your turn.",
    },
  },
  "Dimenxxional Ferryman": {
    verified: true,
    card: {
      notes:
        "Puts itself and a blood debt action card from your banished zone on the bottom of your deck.",
    },
  },
  "Dimenxxional Gateway": {
    verified: true,
    card: {
      banishesOwn: [
        {
          from: "deck_top",
          trigger: "on_play",
          optional: true,
          conditions: ["banished_card_is_shadow"],
        },
      ],
      notes:
        "Opt 3/2/1 first, then reveals the top card: if Runeblade, 1 arcane damage to each opponent; if Shadow, may banish it.",
    },
  },
  "Dimenxxional Vortex": {
    verified: true,
    card: {
      playableFromBanish: {},
      costReductions: [{ amount: 2, conditions: ["played_from_banish"] }],
      disrupts: [
        {
          action: "banish",
          from: "arsenal",
          amount: 1,
          target: "each_hero",
          trigger: "on_play",
        },
      ],
      notes: "The dataset has no pitch for this card.",
    },
  },
  "Eclipse Existence": {
    verified: true,
    card: {
      banishesOwn: [{ from: "graveyard", trigger: "on_play", optional: true }],
      notes:
        "Light-hero hate. You may banish an action card from your graveyard only if you have more life than an opposing Light hero.",
    },
  },
  "Eloquent Eulogy": {
    verified: true,
    card: {
      tokens: [
        {
          token: "eloquence",
          amount: 1,
          trigger: "combat_chain_closes",
          conditions: ["hero_lost_life_this_turn"],
        },
      ],
    },
  },
  Embalm: {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      playableFromBanish: {},
      goAgain: { conditions: ["played_from_banish"] },
      notes:
        "Puts a blood debt attack action card from your graveyard on the bottom of your deck.",
    },
  },
  "Embrace Sin": {
    verified: true,
    card: {
      enablesPlayFromBanish: [{ target: { group: "runechant_aura" } }],
      notes: "Your next attack this turn also gets +2 power.",
    },
  },
  "Engulfing Shadows": {
    verified: true,
    card: { banishesSelf: [{ trigger: "would_go_to_graveyard" }] },
  },
  "Fallen Herald": {
    verified: true,
    card: {
      banishesSelf: [{ from: "hand", trigger: "activated" }],
      notes: "Banish it from hand to prevent the next 4 damage.",
    },
  },
  "Fasting Carcass": {
    verified: true,
    card: { grantsGoAgain: "next_action_card_matching_pitch" },
  },
  "Ghostly Visit": {
    verified: true,
    card: { playableFromBanish: {} },
  },
  "Grim Feast": {
    verified: true,
    card: {
      playableFromBanish: {},
      costReductions: [{ amount: 2, conditions: ["played_from_banish"] }],
      notes: "Gain 3/2/1 life (red/yellow/blue).",
    },
  },
  "Guardian of the Shadowrealm": {
    verified: true,
    card: {
      notes:
        "While in your banished zone, pay {r}{r} to return it to your hand (an action, not playing it from banish).",
    },
  },
  "Howl from Beyond": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes:
        "Your next attack action card gets +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Hungering Demigon": {
    verified: true,
    card: {
      playableFromBanish: {},
      disrupts: [
        {
          action: "banish",
          from: "soul",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
        },
      ],
      notes:
        "Only playable from banish if an opponent has cards in their soul (Light heroes).",
    },
  },
  "Invert Existence": {
    verified: true,
    card: {
      playableFromBanish: {},
      disrupts: [
        {
          action: "banish",
          from: "graveyard",
          amount: 2,
          target: "opponent",
          trigger: "on_play",
          optional: true,
        },
      ],
      arcaneDamage: [{ amount: 2, trigger: "on_play" }],
      notes:
        "Up to 2 cards. The arcane damage needs an attack and a non-attack action card among them.",
    },
  },
  "Lunartide Plunderer": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "on_hit" }],
      disrupts: [
        {
          action: "banish",
          from: "soul",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
          optional: true,
        },
      ],
    },
  },
  "Mutated Mass": {
    verified: true,
    card: { playableFromBanish: {} },
  },
  "Painful Passage": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
      grantsGoAgain: "banished_card",
      notes:
        "Banishes an attack action card; it gets your choice of +3 power or go again this turn.",
    },
  },
  "Permanent Interment": {
    verified: true,
    card: {
      notes:
        "Pay up to {r}{r}{r} to turn that many Shadow cards in your banished zone face-down for +1 power each. Uses up your banished zone.",
    },
  },
  "Piercing Shadow Vise": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes: "+2 power if you've dealt arcane damage to an opponent this turn.",
    },
  },
  "Plundersong Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      disrupts: [
        {
          action: "banish",
          from: "arsenal",
          amount: 1,
          target: "defending_hero",
          trigger: "on_hit",
        },
      ],
    },
  },
  "Putrid Stirrings": {
    verified: true,
    card: {
      playableFromBanish: {},
      supports: [
        {
          target: { group: "rune_gate" },
          note: "+5/+4/+3 power to the next one you rune gate this turn",
        },
      ],
    },
  },
  "Rally the Shadow Horde": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "activated", optional: true }],
      notes:
        "Once per turn while defending: banish a card from hand for +2 defense.",
    },
  },
  "Rattle Bones": {
    verified: true,
    card: {
      banishesOwn: [{ from: "graveyard", trigger: "on_play" }],
      enablesPlayFromBanish: [
        { target: { group: "runeblade_attack_action" }, from: "graveyard" },
      ],
      instantSpeed: {
        conditions: ["dealt_arcane_damage_to_opponent_this_turn"],
      },
      notes:
        "Banishes a Runeblade attack action card from your graveyard; that card is the one you may play this turn.",
    },
  },
  "Requiem for the Damned": {
    verified: true,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "eloquence", amount: 1, trigger: "on_play" }],
      instantSpeed: { conditions: ["hero_lost_life_this_turn"] },
    },
  },
  "Rift Bind": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      playableFromBanish: {},
      notes:
        "From banish: +X power, where X is the number of non-attack action cards you've played this turn.",
    },
  },
  "Rift Skitter": {
    verified: true,
    card: {},
  },
  "Rifted Torment": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      playableFromBanish: {},
      arcaneDamage: [
        { amount: 1, trigger: "on_play", conditions: ["played_from_banish"] },
      ],
    },
  },
  "Rip Through Reality": {
    verified: true,
    card: {
      playableFromBanish: {},
      goAgain: { conditions: ["dealt_arcane_damage_to_opponent_this_turn"] },
    },
  },
  "Runic Fellingsong": {
    verified: true,
    card: {
      banishesOwn: [
        { from: "graveyard", trigger: "on_attack", optional: true },
      ],
      arcaneDamage: [{ amount: 1, trigger: "on_attack" }],
      notes: "The arcane damage needs an aura banished from your graveyard.",
    },
  },
  "Seeds of Agony": {
    verified: true,
    card: {
      playableFromBanish: {},
      arcaneDamage: [
        { amount: 1, trigger: "on_attack", grantedTo: "next_attack_action" },
      ],
      notes:
        "Only an attack action card costing 2/1/0 or less (red/yellow/blue).",
    },
  },
  "Seeping Shadows": {
    verified: true,
    card: {
      playableFromBanish: {},
      grantsGoAgain: "next_attack_action",
      notes:
        "Only an attack action card costing 2/1/0 or less (red/yellow/blue); it also gets +1 power.",
    },
  },
  "Shadow of Ursur": {
    verified: true,
    card: {
      playableFromBanish: {},
      banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
      goAgain: { conditions: ["paid_optional_additional_cost"] },
      notes:
        "The optional additional cost is banishing a blood debt card from your hand.",
    },
  },
  "Shadow Puppetry": {
    verified: true,
    card: {
      grantsGoAgain: "next_attack_action",
      notes:
        "That attack also gets +1 power and, when it hits, lets you look at the top card of your deck and banish it.",
    },
  },
  "Shadowrealm Bloodhound": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      goAgain: { conditions: ["banished_card_is_shadow"] },
    },
  },
  "Shadowrealm Harrower": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      notes:
        "From banish: +1 power and gain life equal to the damage dealt when it hits.",
    },
  },
  "Shadowrealm Harvester": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      notes:
        "From banish: +1 power and overpower. Overpower is listed as a keyword but is conditional.",
    },
  },
  "Shadowrealm Reaper": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      goAgain: { conditions: ["played_from_banish"] },
      notes: "From banish: also +1 power.",
    },
  },
  "Shadowrealm Ripper": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      conditionalBonuses: [
        {
          effect: "plus_power",
          amount: 2,
          conditions: ["banished_card_is_shadow"],
        },
      ],
    },
  },
  // Corrected 16 Oct 2026: the pre-release data had Shadowrealm Ripper's text (+2 power). The
  // fixed text creates a Gate instead. Checked by the maintainer, 16 Oct 2026.
  "Shadowrealm Walker": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      tokens: [
        {
          token: "gate",
          amount: 1,
          trigger: "on_attack",
          conditions: ["banished_card_is_shadow"],
        },
      ],
    },
  },
  "Sigil of Silphidae": {
    verified: true,
    card: {
      banishesOwn: [
        { from: "graveyard", trigger: "on_play", optional: true },
        { from: "graveyard", trigger: "on_leave_arena", optional: true },
      ],
      arcaneDamage: [
        { amount: 1, trigger: "on_play" },
        { amount: 1, trigger: "on_leave_arena" },
      ],
      notes:
        "Each arcane damage needs another aura banished from your graveyard. Destroyed at your next action phase.",
    },
  },
  "Sinspeaker Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      tutors: [
        {
          target: { group: "runechant_aura" },
          to: "arena",
          trigger: "on_attack",
          conditions: ["played_from_banish"],
          optional: true,
        },
      ],
    },
  },
  "Sonata Arcanix": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "on_play" }],
      arcaneDamage: [{ amount: "X", trigger: "on_play" }],
      notes:
        "Reveals the top X+3 cards; X is the number of attack action cards put into your hand.",
    },
  },
  "Soul Butcher": {
    verified: true,
    card: { notes: "+2 power if the defending hero has cards in their soul." },
  },
  "Soul Cleaver": {
    verified: true,
    card: {
      goAgain: { conditions: ["defending_hero_has_soul_cards"] },
    },
  },
  "Spew Shadow": {
    verified: true,
    card: {
      notes:
        "Lets you play an attack action card costing 2/1/0 or less (red/yellow/blue) from your banished zone this turn.",
    },
  },
  "Tear Through the Portal": {
    verified: true,
    card: { grantsGoAgain: "card_in_banished_zone_matching_pitch" },
  },
  "Tome of Torment": {
    verified: true,
    card: { playableFromBanish: {}, notes: "Draw a card." },
  },
  "Tribute to Greater Power": {
    verified: true,
    card: {
      banishesSelf: [{ from: "hand", trigger: "activated" }],
      notes:
        "Banish it from hand: your next attack gets overpower. Overpower is listed as a keyword but is granted to another attack.",
    },
  },
  "Unhallowed Rites": {
    verified: true,
    card: {
      playableFromBanish: {
        conditions: ["played_non_attack_action_this_turn"],
      },
      notes:
        "May put a blood debt non-attack action card from your graveyard on the bottom of your deck.",
    },
  },
  "Usurp the Shadow Throne": {
    verified: true,
    card: {
      costReductions: [{ amount: 6, conditions: ["usurped_this_turn"] }],
      playableFromBanish: { conditions: ["usurped_this_turn"] },
      notes:
        "When it hits, turns all cards in their banished zone face-down; they lose X life and you gain X, where X is the number turned.",
    },
  },
  "Vantom Banshee": {
    verified: true,
    card: {},
  },
  "Vantom Wraith": {
    verified: true,
    card: {},
  },
  "Vexing Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      arcaneDamage: [{ amount: 2, trigger: "on_hit" }],
    },
  },
  "Vile Inquisition": {
    verified: true,
    card: {
      playableFromBanish: {},
      costReductions: [{ amount: 2, conditions: ["played_from_banish"] }],
      disrupts: [
        {
          action: "banish",
          from: "deck_top",
          amount: 1,
          target: "opponent",
          trigger: "on_play",
        },
      ],
      notes:
        "Targets a hero (normally an opponent). They lose 1 life if the banished card matches this card's colour.",
    },
  },
  "Void Wraith": {
    verified: true,
    card: { playableFromBanish: {} },
  },
  "Weeping Battleground": {
    verified: true,
    card: {
      banishesOwn: [{ from: "graveyard", trigger: "on_play", optional: true }],
      arcaneDamage: [{ amount: 1, trigger: "on_play" }],
      notes: "The arcane damage needs an aura banished from your graveyard.",
    },
  },
  "Widespread Annihilation": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "banish",
          from: "hand",
          amount: 1,
          target: "each_hero",
          trigger: "combat_chain_closes",
          conditions: ["hero_lost_life_this_turn"],
        },
      ],
      notes: "Only heroes who have lost life this turn.",
    },
  },
  "Widespread Destruction": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "banish",
          from: "arsenal",
          amount: 1,
          target: "each_hero",
          trigger: "combat_chain_closes",
          conditions: ["hero_lost_life_this_turn"],
        },
      ],
      notes: "Only heroes who have lost life this turn.",
    },
  },
  "Widespread Ruin": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "banish",
          from: "deck_top",
          amount: 1,
          target: "each_hero",
          trigger: "combat_chain_closes",
          conditions: ["hero_lost_life_this_turn"],
        },
      ],
      notes: "Only heroes who have lost life this turn.",
    },
  },
};
