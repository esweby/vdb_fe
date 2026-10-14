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
      goAgain: {},
      notes:
        "Gets go again if you've dealt damage to the defending hero this turn.",
    },
  },
  "Bloodsong Gloomblade": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes: "When it hits, may banish an aura the hit hero controls.",
    },
  },
  "Bounding Demigon": {
    verified: false,
    card: {
      playableFromBanish: {
        conditions: ["played_non_attack_action_this_turn"],
      },
      notes: "+1 power when played from your banished zone.",
    },
  },
  "Chains of Mephetis": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "While in the arena, draws during an action phase become banish-the-top-card-and-may-play-it (for every hero).",
    },
  },
  "Consuming Aftermath": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
      notes:
        "Banishing is an optional additional cost. Gets dominate if the banished card is Shadow.",
    },
  },
  "Corrupt and Conquer": {
    verified: false,
    card: {
      notes:
        "Rewards being played from your banished zone (defense reactions can't be played), but nothing on the card lets it be played from there.",
    },
  },
  Cull: {
    verified: false,
    card: {
      playableFromBanish: {},
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      notes:
        "Every hero banishes a card from hand, you included. Instant speed if a hero has lost life this turn.",
    },
  },
  "Cullingsong Gloomblade": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes: "When it hits, the hit hero banishes a card from their hand.",
    },
  },
  "Dabble in Darkness": {
    verified: false,
    card: {
      banishesOwn: [{ from: "deck_top", trigger: "on_attack" }],
      notes: "Loses power equal to the banished card's pitch value.",
    },
  },
  "Darkest Hour": {
    verified: false,
    card: {
      notes:
        "Your next Shadow attack gets +4/+3/+1 power (red/yellow/blue). Can be paid for by putting a card from hand on top of your deck.",
    },
  },
  "Deathly Delight": {
    verified: false,
    card: {
      notes: "Gain life equal to the number of heroes who lost life this turn.",
    },
  },
  "Deep Recesses of Existence": {
    verified: false,
    card: {
      banishesSelf: [{ trigger: "combat_chain_closes", optional: true }],
      notes:
        "Banished face-down, so it can't be played from banish. Then banishes cards from graveyards of heroes who lost life.",
    },
  },
  "Demonbound Gloomblade": {
    verified: false,
    card: { playableFromBanish: {} },
  },
  "Depths of Despair": {
    verified: false,
    card: {
      banishesSelf: [{ trigger: "combat_chain_closes" }],
      notes: "Only after it has defended.",
    },
  },
  "Dimenxxional Crossroads": {
    verified: false,
    card: {
      notes:
        "Deals 1 arcane damage the first time each turn you play an attack action card, and the first time a non-attack action card, from the banished zone. Destroyed if you lose life on your turn.",
    },
  },
  "Dimenxxional Ferryman": {
    verified: false,
    card: {
      notes:
        "Puts itself and a blood debt action card from your banished zone on the bottom of your deck.",
    },
  },
  "Dimenxxional Gateway": {
    verified: false,
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
    verified: false,
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
    verified: false,
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
    verified: false,
    card: {
      playableFromBanish: {},
      goAgain: { conditions: ["played_from_banish"] },
      notes:
        "Puts a blood debt attack action card from your graveyard on the bottom of your deck.",
    },
  },
  "Embrace Sin": {
    verified: false,
    card: {
      notes:
        "Your next attack gets +2 power, and you may play an aura with Runechant in its name from your banished zone this turn.",
    },
  },
  "Engulfing Shadows": {
    verified: false,
    card: { banishesSelf: [{ trigger: "would_go_to_graveyard" }] },
  },
  "Fallen Herald": {
    verified: false,
    card: {
      banishesSelf: [{ trigger: "activated" }],
      notes: "Banish it from hand to prevent the next 4 damage.",
    },
  },
  "Fasting Carcass": {
    verified: false,
    card: {
      notes:
        "The next red/yellow/blue action card you play this turn (matching its colour) gets go again. Granting to a card of a colour isn't in the vocabulary yet.",
    },
  },
  "Ghostly Visit": {
    verified: false,
    card: { playableFromBanish: {} },
  },
  "Grim Feast": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "Costs {r}{r} less from banish. Gain 3/2/1 life (red/yellow/blue).",
    },
  },
  "Guardian of the Shadowrealm": {
    verified: false,
    card: {
      notes:
        "While in your banished zone, pay {r}{r} to return it to your hand (an action, not playing it from banish).",
    },
  },
  "Howl from Beyond": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "Your next attack action card gets +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Hungering Demigon": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "Only playable from banish if an opponent has cards in their soul (Light heroes).",
    },
  },
  "Invert Existence": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "Banishes up to 2 cards from an opponent's graveyard; 2 arcane damage if they're an attack and a non-attack action card.",
    },
  },
  "Lunartide Plunderer": {
    verified: false,
    card: {
      banishesSelf: [{ trigger: "on_hit" }],
      notes: "Also banishes a card from the hit hero's soul.",
    },
  },
  "Mutated Mass": {
    verified: false,
    card: { playableFromBanish: {} },
  },
  "Painful Passage": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
      notes:
        "Banishes an attack action card from hand, which gets +3 power or go again this turn (so it can be played with a Gate).",
    },
  },
  "Permanent Interment": {
    verified: false,
    card: {
      notes:
        "Pay up to {r}{r}{r} to turn that many Shadow cards in your banished zone face-down for +1 power each. Uses up your banished zone.",
    },
  },
  "Piercing Shadow Vise": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes: "+2 power if you've dealt arcane damage to an opponent this turn.",
    },
  },
  "Plundersong Gloomblade": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes: "When it hits, the hit hero banishes a card from their arsenal.",
    },
  },
  "Putrid Stirrings": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "The next attack action card you rune gate this turn gets +5/+4/+3 power (red/yellow/blue).",
    },
  },
  "Rally the Shadow Horde": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "activated", optional: true }],
      notes:
        "Once per turn while defending: banish a card from hand for +2 defense.",
    },
  },
  "Rattle Bones": {
    verified: false,
    card: {
      banishesOwn: [{ from: "graveyard", trigger: "on_play" }],
      notes:
        "Banishes a Runeblade attack action card from your graveyard, which you may play this turn. Instant speed if you've dealt arcane damage to an opponent.",
    },
  },
  "Requiem for the Damned": {
    verified: false,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "eloquence", amount: 1, trigger: "on_play" }],
      notes: "Instant speed if a hero has lost life this turn.",
    },
  },
  "Rift Bind": {
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "From banish, gets +X power, where X is the number of non-attack action cards you've played this turn.",
    },
  },
  "Rift Skitter": {
    verified: false,
    card: {},
  },
  "Rifted Torment": {
    verified: false,
    card: {
      playableFromBanish: {},
      arcaneDamage: [
        { amount: 1, trigger: "on_play", conditions: ["played_from_banish"] },
      ],
    },
  },
  "Rip Through Reality": {
    verified: false,
    card: {
      playableFromBanish: {},
      goAgain: { conditions: ["dealt_arcane_damage_this_turn"] },
      notes: "The arcane damage must have been dealt to an opponent.",
    },
  },
  "Runic Fellingsong": {
    verified: false,
    card: {
      banishesOwn: [
        { from: "graveyard", trigger: "on_attack", optional: true },
      ],
      arcaneDamage: [{ amount: 1, trigger: "on_attack" }],
      notes: "The arcane damage needs an aura banished from your graveyard.",
    },
  },
  "Seeds of Agony": {
    verified: false,
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
    verified: false,
    card: {
      playableFromBanish: {},
      grantsGoAgain: "next_attack_action",
      notes:
        "Only an attack action card costing 2/1/0 or less (red/yellow/blue); it also gets +1 power.",
    },
  },
  "Shadow of Ursur": {
    verified: false,
    card: {
      playableFromBanish: {},
      banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
      goAgain: {},
      notes:
        "Gets go again if you paid the optional additional cost: banishing a blood debt card from your hand.",
    },
  },
  "Shadow Puppetry": {
    verified: false,
    card: {
      grantsGoAgain: "next_attack_action",
      notes:
        "That attack also gets +1 power and, when it hits, lets you look at the top card of your deck and banish it.",
    },
  },
  "Shadowrealm Bloodhound": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      goAgain: { conditions: ["banished_card_is_shadow"] },
    },
  },
  "Shadowrealm Harrower": {
    verified: false,
    card: {
      notes:
        "From banish, +1 power and lifegain on hit, but nothing on the card lets it be played from there.",
    },
  },
  "Shadowrealm Harvester": {
    verified: false,
    card: {
      notes:
        "From banish, +1 power and overpower, but nothing on the card lets it be played from there. Overpower is listed as a keyword but is conditional.",
    },
  },
  "Shadowrealm Reaper": {
    verified: false,
    card: {
      goAgain: { conditions: ["played_from_banish"] },
      notes:
        "Also +1 power from banish, but nothing on the card lets it be played from there.",
    },
  },
  "Shadowrealm Ripper": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      notes: "+2 power if the banished card is Shadow.",
    },
  },
  "Shadowrealm Walker": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      notes: "+2 power if the banished card is Shadow.",
    },
  },
  "Sigil of Silphidae": {
    verified: false,
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
    verified: false,
    card: {
      playableFromBanish: {},
      notes:
        "From banish, when it attacks you may search your deck for a Runechant aura (e.g. Runechant of Lust) and put it into the arena.",
    },
  },
  "Sonata Arcanix": {
    verified: false,
    card: {
      banishesSelf: [{ trigger: "on_play" }],
      arcaneDamage: [{ amount: "X", trigger: "on_play" }],
      notes:
        "Reveals the top X+3 cards; X is the number of attack action cards put into your hand.",
    },
  },
  "Soul Butcher": {
    verified: false,
    card: { notes: "+2 power if the defending hero has cards in their soul." },
  },
  "Soul Cleaver": {
    verified: false,
    card: {
      goAgain: {},
      notes: "Gets go again if the defending hero has cards in their soul.",
    },
  },
  "Spew Shadow": {
    verified: false,
    card: {
      notes:
        "Lets you play an attack action card costing 2/1/0 or less (red/yellow/blue) from your banished zone this turn.",
    },
  },
  "Tear Through the Portal": {
    verified: false,
    card: {
      notes:
        "A red/yellow/blue action card (matching its colour) in your banished zone gets go again.",
    },
  },
  "Tome of Torment": {
    verified: false,
    card: { playableFromBanish: {}, notes: "Draw a card." },
  },
  "Tribute to Greater Power": {
    verified: false,
    card: {
      banishesSelf: [{ trigger: "activated" }],
      notes:
        "Banish it from hand: your next attack gets overpower. Overpower is listed as a keyword but is granted to another attack.",
    },
  },
  "Unhallowed Rites": {
    verified: false,
    card: {
      playableFromBanish: {
        conditions: ["played_non_attack_action_this_turn"],
      },
      notes:
        "May put a blood debt non-attack action card from your graveyard on the bottom of your deck.",
    },
  },
  "Usurp the Shadow Throne": {
    verified: false,
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
