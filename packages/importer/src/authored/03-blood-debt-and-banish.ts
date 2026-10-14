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
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
      notes: "Opt 3/2/1 (red/yellow/blue) first.",
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
      notes: "When it hits, may banish an aura the hit hero controls.",
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
      notes:
        "Banishing is an optional additional cost. Gets dominate if the banished card is Shadow.",
    },
  },
  "Corrupt and Conquer": {
    verified: true,
    card: {
      rewardsPlayFromBanish: true,
      notes:
        "From banish: defense reaction cards can't be played this chain link.",
    },
  },
  Cull: {
    verified: true,
    card: {
      playableFromBanish: {},
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      notes:
        "Every hero banishes a card from hand, you included. Instant speed if a hero has lost life this turn.",
    },
  },
  "Cullingsong Gloomblade": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes: "When it hits, the hit hero banishes a card from their hand.",
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
        "Your next Shadow attack gets +4/+3/+1 power (red/yellow/blue). Can be paid for by putting a card from hand on top of your deck.",
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
      notes:
        "Banished face-down, so it can't be played from banish. Then banishes cards from graveyards of heroes who lost life.",
    },
  },
  "Demonbound Gloomblade": {
    verified: true,
    card: { playableFromBanish: {} },
  },
  "Depths of Despair": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "combat_chain_closes" }],
      notes: "Only after it has defended.",
    },
  },
  "Dimenxxional Crossroads": {
    verified: true,
    card: {
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
      notes:
        "Costs {r}{r} less from banish. Every hero banishes a card from their arsenal, you included. The dataset has no pitch for this card.",
    },
  },
  "Eclipse Existence": {
    verified: false,
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
      notes:
        "Your next attack gets +2 power, and you may play an aura with Runechant in its name from your banished zone this turn.",
    },
  },
  "Engulfing Shadows": {
    verified: true,
    card: { banishesSelf: [{ trigger: "would_go_to_graveyard" }] },
  },
  "Fallen Herald": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "activated" }],
      notes: "Banish it from hand to prevent the next 4 damage.",
    },
  },
  "Fasting Carcass": {
    verified: true,
    card: {
      notes:
        "The next red/yellow/blue action card you play this turn (matching its colour) gets go again. Granting to a card of a colour isn't in the vocabulary yet.",
    },
  },
  "Ghostly Visit": {
    verified: true,
    card: { playableFromBanish: {} },
  },
  "Grim Feast": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes:
        "Costs {r}{r} less from banish. Gain 3/2/1 life (red/yellow/blue).",
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
      notes:
        "Only playable from banish if an opponent has cards in their soul (Light heroes).",
    },
  },
  "Invert Existence": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes:
        "Banishes up to 2 cards from an opponent's graveyard; 2 arcane damage if they're an attack and a non-attack action card.",
    },
  },
  "Lunartide Plunderer": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "on_hit" }],
      notes: "Also banishes a card from the hit hero's soul.",
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
      notes:
        "Banishes an attack action card from hand, which gets +3 power or go again this turn (so it can be played with a Gate).",
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
      notes: "When it hits, the hit hero banishes a card from their arsenal.",
    },
  },
  "Putrid Stirrings": {
    verified: true,
    card: {
      playableFromBanish: {},
      notes:
        "The next attack action card you rune gate this turn gets +5/+4/+3 power (red/yellow/blue).",
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
      notes:
        "Banishes a Runeblade attack action card from your graveyard, which you may play this turn. Instant speed if you've dealt arcane damage to an opponent.",
    },
  },
  "Requiem for the Damned": {
    verified: true,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "eloquence", amount: 1, trigger: "on_play" }],
      notes: "Instant speed if a hero has lost life this turn.",
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
      notes: "+2 power if the banished card is Shadow.",
    },
  },
  "Shadowrealm Walker": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      notes: "+2 power if the banished card is Shadow.",
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
      notes:
        "From banish, when it attacks you may search your deck for a Runechant aura (e.g. Runechant of Lust) and put it into the arena.",
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
    card: {
      notes:
        "A red/yellow/blue action card (matching its colour) in your banished zone gets go again.",
    },
  },
  "Tome of Torment": {
    verified: true,
    card: { playableFromBanish: {}, notes: "Draw a card." },
  },
  "Tribute to Greater Power": {
    verified: true,
    card: {
      banishesSelf: [{ trigger: "activated" }],
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
      playableFromBanish: {},
      notes:
        "Only playable from banish (and 6{r} cheaper) if you've usurped this turn. No condition for usurping exists yet.",
    },
  },
  "Vantom Banshee": {
    verified: false,
    card: {},
  },
  "Vantom Wraith": {
    verified: false,
    card: {},
  },
  "Vexing Gloomblade": {
    verified: false,
    card: {
      playableFromBanish: {},
      arcaneDamage: [{ amount: 2, trigger: "on_hit" }],
    },
  },
  "Vile Inquisition": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "Costs {r}{r} less from banish. Target hero banishes their top card and loses 1 life if it's red/yellow/blue (matching).",
    },
  },
  "Void Wraith": {
    verified: false,
    card: { playableFromBanish: {} },
  },
  "Weeping Battleground": {
    verified: false,
    card: {
      banishesOwn: [{ from: "graveyard", trigger: "on_play", optional: true }],
      arcaneDamage: [{ amount: 1, trigger: "on_play" }],
      notes: "The arcane damage needs an aura banished from your graveyard.",
    },
  },
  "Widespread Annihilation": {
    verified: false,
    card: {
      notes:
        "Each hero who lost life this turn banishes a card from their hand.",
    },
  },
  "Widespread Destruction": {
    verified: false,
    card: {
      notes:
        "Each hero who lost life this turn banishes a card from their arsenal.",
    },
  },
  "Widespread Ruin": {
    verified: false,
    card: {
      notes:
        "Each hero who lost life this turn banishes the top card of their deck.",
    },
  },
};
