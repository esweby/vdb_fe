// Batch 1: Runeblade and Shadow deck cards that create Runechants.
// Drafted from card text, all unverified. Review sheet: docs/reviews/01-runechant-creators.md
import type { AuthoredAttributes } from "../map.ts";

const CONDITIONAL_GO_AGAIN = "Go again is listed as a keyword in the dataset, but on this card it's conditional.";

export const runechantCreators: AuthoredAttributes = {
  "Arcane Cussing": {
    verified: false,
    card: { notes: "Only creates Runechants if it leaves the arena during your turn." },
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_leave_arena" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "on_leave_arena" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }] },
    },
  },
  "Arknight Ascendancy": {
    verified: false,
    card: {
      costReducedPerRunechant: true,
      tokens: [{ token: "runechant", amount: "X", trigger: "on_hit" }],
      notes: "X is the damage dealt by the hit.",
    },
  },
  "Arknight Descendancy": {
    verified: false,
    card: {
      costReducedPerRunechant: true,
      tokens: [{ token: "runechant", amount: "X", trigger: "on_banished" }],
      notes: "Banished from anywhere; X is the life paid, up to 3.",
    },
  },
  "Arknight Shard": {
    verified: false,
    card: { tokens: [{ token: "runechant", amount: 1, trigger: "on_pitch" }] },
  },
  "Blessing of Occult": {
    verified: false,
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "start_of_turn" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "start_of_turn" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "start_of_turn" }] },
    },
  },
  "Bloodspill Invocation": {
    verified: false,
    card: { notes: "Destroyed (no Runechants) if you're dealt damage first." },
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "your_attack_action_hits" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "your_attack_action_hits" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "your_attack_action_hits" }] },
    },
  },
  "Deadwood Dirge": {
    verified: false,
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_play", conditions: ["destroyed_own_aura"] }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "on_play", conditions: ["destroyed_own_aura"] }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_play", conditions: ["destroyed_own_aura"] }] },
    },
  },
  "Deathly Duet": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 2, trigger: "on_attack", conditions: ["pitched_non_attack_action"] }],
      notes: "Also +2 power if an attack action card was pitched.",
    },
  },
  "Deathly Wail": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "combat_chain_closes" }],
      notes: "X is the number of heroes who have lost life this turn.",
    },
  },
  "Douse in Runeblood": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_attack" }],
      notes: `X is the number of non-attack action cards you've played this turn. Gets go again if X is 3 or more. ${CONDITIONAL_GO_AGAIN}`,
    },
  },
  "Dread Triptych": {
    verified: false,
    card: {
      tokens: [
        { token: "runechant", amount: 1, trigger: "on_attack", conditions: ["played_non_attack_action_this_turn"] },
        { token: "runechant", amount: 1, trigger: "on_attack", conditions: ["dealt_arcane_damage_this_turn"] },
        { token: "runechant", amount: 1, trigger: "on_hit" },
      ],
    },
  },
  "Embrace Ursur": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
      tokens: [{ token: "runechant", amount: 1, trigger: "on_attack", conditions: ["banished_card_is_runeblade"] }],
      notes: `Gets go again if the banished card is Shadow. ${CONDITIONAL_GO_AGAIN}`,
    },
  },
  "Enshrine Sin": {
    verified: false,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Costs an additional {r} when played from banish.",
    },
  },
  "Envelop in Darkness": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Also gives the next attack action card you rune gate this turn +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Forbidden Harvest": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      notes: "Turns up to 3 cards in your banished zone face-down; X is the number of Shadow cards turned.",
    },
  },
  "Funeral Moon": {
    verified: false,
    card: {
      playableFromBanish: {},
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Can be played as an instant if a hero has lost life this turn.",
    },
  },
  "Haunting Rendition": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Discard to prevent the next 2 damage; the Runechant comes the first time damage is prevented this way.",
    },
  },
  "Hocus Pocus": {
    verified: false,
    card: { tokens: [{ token: "runechant", amount: 1, trigger: "on_attack" }] },
  },
  "Jack-o'-lantern": {
    verified: false,
    card: {
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play", conditions: ["top_card_matches_pitch"] }],
    },
  },
  "Malefic Incantation": {
    verified: false,
    card: { notes: "At most one Runechant per turn, until its verse counters run out." },
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "your_attack_action_played" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "your_attack_action_played" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "your_attack_action_played" }] },
    },
  },
  "Mauvrion Skies": {
    verified: false,
    card: { notes: "The next Runeblade attack action card also gets go again." },
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_hit", grantedTo: "next_runeblade_attack_action" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "on_hit", grantedTo: "next_runeblade_attack_action" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_hit", grantedTo: "next_runeblade_attack_action" }] },
    },
  },
  "Meat and Greet": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_hit" }],
      notes: `Gets go again if you've dealt arcane damage to an opposing hero this turn. ${CONDITIONAL_GO_AGAIN}`,
    },
  },
  "Mordred Tide": {
    verified: false,
    card: {
      notes:
        "Doesn't create Runechants itself: until end of turn, each time you create Runechants you create 1 extra. The vocabulary can't express this yet.",
    },
  },
  "Murmuring Gloomblade": {
    verified: false,
    card: {
      playableFromBanish: {},
      tokens: [
        { token: "runechant", amount: 1, trigger: "on_attack" },
        { token: "runechant", amount: 1, trigger: "on_hit" },
      ],
    },
  },
  "Oath of the Arknight": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Also gives your next Runeblade attack +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Otherworldly Sins": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      notes: "Also gives your next Runeblade or Shadow attack +3/+2/+1 power (red/yellow/blue).",
    },
  },
  "Promise of Power": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 2, trigger: "your_attack_action_played" }],
      notes: "Only the next attack action card you play from your banished zone this turn.",
    },
  },
  "Read the Runes": {
    verified: false,
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_play" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "on_play" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }] },
    },
  },
  "Reduce to Runechant": {
    verified: false,
    card: {
      costReducedPerRunechant: true,
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
    },
  },
  "Revel in Runeblood": {
    verified: false,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 4,
          trigger: "on_play",
          conditions: ["played_attack_action_this_turn", "played_non_attack_action_this_turn"],
        },
      ],
      notes: "Requires another non-attack action card besides this one. Destroys all your Runechants at your end phase.",
    },
  },
  "Runeblood Barrier": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 4, trigger: "on_play" }],
      notes: "Created when it enters the arena. Prevents damage by destroying Runechants; destroyed at your next action phase.",
    },
  },
  "Runeblood Incantation": {
    verified: false,
    card: { notes: "One Runechant per turn at the start of your action phase, until its verse counters run out." },
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "start_of_action_phase" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "start_of_action_phase" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "start_of_action_phase" }] },
    },
  },
  "Runechant of Envy": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, gain 1 life.",
    },
  },
  "Runechant of Gluttony": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, gain {r}.",
    },
  },
  "Runechant of Greed": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, draw a card.",
    },
  },
  "Runechant of Lust": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, create another Runechant.",
    },
  },
  "Runechant of Pride": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, the attack gets +1 power.",
    },
  },
  "Runechant of Sloth": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, the attack gets go again.",
    },
  },
  "Runechant of Wrath": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_destroyed" }],
      notes: "Counts as a Runechant itself. When usurped, the attack gets overpower.",
    },
  },
  "Runic Disposition": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Activated by discarding it (instant).",
    },
  },
  "Runic Reaping": {
    verified: false,
    card: { notes: "Also +1 power to that attack if an attack action card was pitched to play this." },
    variants: {
      1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_hit", grantedTo: "next_runeblade_attack_action" }] },
      2: { tokens: [{ token: "runechant", amount: 2, trigger: "on_hit", grantedTo: "next_runeblade_attack_action" }] },
      3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_hit", grantedTo: "next_runeblade_attack_action" }] },
    },
  },
  "Runic Reaving": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Activated by discarding it (instant).",
    },
  },
  "Runic Reclamation": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_hit" }],
      notes: "Only if it destroys an aura the hit hero controls. No condition exists for opponent auras yet.",
    },
  },
  "Sigil of Deadwood": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }],
      notes: "Destroys itself at the start of your next action phase.",
    },
  },
  "Sky Fire Lanterns": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play", conditions: ["top_card_matches_pitch"] }],
      notes: "Reveals the top card; doesn't banish it.",
    },
  },
  "Sonata Dystopia": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_hit", grantedTo: "next_attack_action" }],
      notes:
        "Costs destroying X Runechants. The next attack action card also costs {x} less, gets +X power and overpower.",
    },
  },
  "Sonata Fantasmia": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      notes: "If X is 6 or more, target hero discards 3 random cards.",
    },
  },
  "Spellblade Assault": {
    verified: false,
    card: { tokens: [{ token: "runechant", amount: 2, trigger: "on_attack" }] },
  },
  "Spellblade Strike": {
    verified: false,
    card: { tokens: [{ token: "runechant", amount: 1, trigger: "on_attack" }] },
  },
  "Splintering Deadwood": {
    verified: false,
    card: {
      tokens: [
        { token: "runechant", amount: 1, trigger: "on_attack", conditions: ["destroyed_own_aura"] },
        { token: "runechant", amount: 1, trigger: "on_hit", conditions: ["destroyed_own_aura"] },
      ],
      notes: "Destroying your aura is optional each time.",
    },
  },
  "Sutcliffe's Research Notes": {
    verified: false,
    card: {
      tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
      notes:
        "Reveals the top 3/2/1 cards (red/yellow/blue); X is the number of Runeblade attack action cards revealed.",
    },
  },
};
