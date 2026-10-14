// Batch 4: Runeblade and Shadow weapons and equipment.
// Drafted from card text, all unverified. Review sheet: docs/reviews/04-weapons-and-equipment.md
// Weapon attacks (canAttack) and keywords are generated; this file adds what they can't.
import type { AuthoredAttributes } from "../map.ts";

const DARKNESS =
  "Part of the Darkness set (Cloak, Dance, Grasp and Shroud of Darkness): each prevents 2 damage by banishing itself.";

export const weaponsAndEquipment: AuthoredAttributes = {
  // Weapons
  "Annals of Sutcliffe": {
    verified: true,
    card: {
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "activated",
          conditions: ["pitched_attack_action", "pitched_non_attack_action"],
        },
      ],
      notes:
        "Once per turn, {r}{r}{r}: draw a card. It doesn't attack, so it doesn't fire Runechants.",
    },
  },
  "Dread Scythe": {
    verified: true,
    card: {
      arcaneDamage: [{ amount: 1, trigger: "on_attack" }],
      notes:
        "Costs {r}{r}{r} to attack. When it deals damage, that hero can't gain life during their next action phase.",
    },
  },
  "Galaxxi Black": {
    verified: true,
    card: {
      arcaneDamage: [{ amount: 1, trigger: "on_hit" }],
      notes:
        "+2 power if you've played a card from your banished zone this turn.",
    },
  },
  "Nebula Blade": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_hit" }],
      notes: "+3 power if you've played a non-attack action card this turn.",
    },
  },
  "Rosetta Thorn": {
    verified: true,
    card: {
      arcaneDamage: [
        {
          amount: 2,
          trigger: "on_attack",
          conditions: [
            "played_attack_action_this_turn",
            "played_non_attack_action_this_turn",
          ],
        },
      ],
    },
  },
  "Scepter of Pain": {
    verified: true,
    card: {
      arcaneDamage: [{ amount: 1, trigger: "activated" }],
      tokens: [{ token: "runechant", amount: "X", trigger: "activated" }],
      notes:
        "Once per turn, {r}{r}. X is the damage dealt (normally 1). It doesn't attack, so it doesn't fire Runechants.",
    },
  },
  "Seven Sin Nebula": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_hit" }],
      notes:
        "Can only attack if you've played a card from a banished zone this turn.",
    },
  },

  // Equipment that creates Runechants or Eloquence
  "Grasp of the Arknight": {
    verified: true,
    card: {
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes:
        "Once per turn, {r}{r}, plus {r} for each Runechant you control. Go again.",
    },
  },
  "Grasp of the Darknight": {
    verified: true,
    card: {
      oneUse: true,
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "{r}, destroy it: Opt 1, then the Runechant. Go again.",
    },
  },
  "Grimoire of Fellingsong": {
    verified: true,
    card: {
      oneUse: true,
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Instant: {r}, destroy it.",
    },
  },
  "Grimoire of the Haunt": {
    verified: true,
    card: {
      oneUse: true,
      banishesSelf: [{ trigger: "activated" }],
      tokens: [{ token: "eloquence", amount: 1, trigger: "activated" }],
      notes: "Instant: {r}, banish it. Then it's a blood debt card in banish.",
    },
  },
  "Runehold Release": {
    verified: true,
    card: {
      oneUse: true,
      tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
      notes: "Action: destroy it. Go again.",
    },
  },
  "Vexing Quillhand": {
    verified: true,
    card: {
      oneUse: true,
      tokens: [{ token: "runechant", amount: 2, trigger: "activated" }],
      notes: "Action: destroy it. Go again.",
    },
  },

  // Blood debt equipment
  "Carrion Husk": {
    verified: true,
    card: {
      banishesSelf: [
        { trigger: "combat_chain_closes" },
        { trigger: "start_of_turn" },
      ],
      notes:
        "6 defense. Banished after it defends, or at the start of your turn if you have 13 or less life.",
    },
  },
  "Cloak of Darkness": {
    verified: true,
    card: {
      oneUse: true,
      banishesSelf: [{ trigger: "would_be_dealt_damage", optional: true }],
      notes: DARKNESS,
    },
  },
  "Dance of Darkness": {
    verified: true,
    card: {
      oneUse: true,
      banishesSelf: [{ trigger: "would_be_dealt_damage", optional: true }],
      notes: DARKNESS,
    },
  },
  "Embraforged Gauntlet": {
    verified: true,
    card: { banishesSelf: [{ trigger: "would_go_to_graveyard" }] },
  },
  "Grasp of Darkness": {
    verified: true,
    card: {
      oneUse: true,
      banishesSelf: [{ trigger: "would_be_dealt_damage", optional: true }],
      notes: DARKNESS,
    },
  },
  "Shroud of Darkness": {
    verified: true,
    card: {
      oneUse: true,
      banishesSelf: [{ trigger: "would_be_dealt_damage", optional: true }],
      notes: DARKNESS,
    },
  },

  // Blood debt management
  "Grille of Repentance": {
    verified: true,
    card: {
      oneUse: true,
      turnsBanishedFaceDown: [
        { which: "blood_debt", amount: 1, trigger: "activated" },
      ],
    },
  },
  "Path of Repentance": {
    verified: true,
    card: {
      oneUse: true,
      turnsBanishedFaceDown: [
        { which: "blood_debt", amount: 1, trigger: "activated" },
      ],
    },
  },
  "Robe of Repentance": {
    verified: true,
    card: {
      oneUse: true,
      turnsBanishedFaceDown: [
        { which: "blood_debt", amount: 1, trigger: "activated" },
      ],
    },
  },

  // Banishing from hand
  "Corrupted Crown": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_defend", optional: true }],
      notes: "+1 defense if you banish a card.",
    },
  },
  "Ebon Fold": {
    verified: true,
    card: {
      oneUse: true,
      banishesOwn: [{ from: "hand", trigger: "activated" }],
      notes:
        "Instant: {r}, destroy it. Draw a card if the banished card is Shadow.",
    },
  },
  "Reach of the Abyss": {
    verified: true,
    card: {
      notes:
        "When the combat chain closes, if it defended, banishes all the defending cards (yours), feeding your banished zone.",
    },
  },

  // Granting and enabling
  "Gauntlet of Sword and Sorcery": {
    verified: true,
    card: {
      arcaneDamage: [
        { amount: 1, trigger: "on_attack", grantedTo: "next_attack_action" },
      ],
      notes:
        "{r}{r}, tap it and your hero. That attack also gets +1 power if the damage is dealt. Go again.",
    },
  },
  "Spellbound Creepers": {
    verified: true,
    card: {
      notes:
        "Once per turn, {r}: your next non-attack action card can be played as an instant. Only if you've attacked or defended with an attack action card this turn. Destroyed at end phase unless you've dealt enough arcane damage.",
    },
  },
  "Sutcliffe's Suede Hides": {
    verified: true,
    card: {
      oneUse: true,
      grantsGoAgain: "target_attack_action",
      notes:
        "Attack reaction: {r}, destroy it. Only if you've played a non-attack action card this turn.",
    },
  },

  // Arcane damage and auras
  "Aether Crackers": {
    verified: true,
    card: {
      oneUse: true,
      arcaneDamage: [{ amount: 1, trigger: "your_attack_action_hits" }],
      notes: "Any attack you control hitting a hero, weapon attacks included.",
    },
  },
  "Bloodtorn Bodice": {
    verified: true,
    card: {
      oneUse: true,
      notes:
        "Action: destroy it and an aura you control (a Runechant counts): gain {r}. Go again.",
    },
  },
  "Beckoning Haunt": {
    verified: true,
    card: {
      oneUse: true,
      notes:
        "Action: {x}{x}{r}, destroy it: return an aura with cost X from your graveyard to your hand.",
    },
  },
  "Runebleed Robe": {
    verified: true,
    card: {
      oneUse: true,
      notes:
        "Instant: destroy it and a Runechant you control to prevent the next 1 arcane damage.",
    },
  },
  "Amethyst Tiara": {
    verified: true,
    card: {
      oneUse: true,
      notes: "Instant: destroy it. Your Runechants get Spellvoid 1 this turn.",
    },
  },

  // Resources, recursion and other
  "Aether Ironweave": {
    verified: true,
    card: {
      oneUse: true,
      notes:
        "Action: destroy it to gain {r}{r}, only if you've played an attack action card and a non-attack action card this turn. Go again.",
    },
  },
  "Crown of Dichotomy": {
    verified: true,
    card: {
      oneUse: true,
      notes:
        "Action: {r}, destroy it: put a Runeblade attack action card and a Runeblade non-attack action card from your graveyard on top of your deck.",
    },
  },
  "Face Purgatory": {
    verified: true,
    card: {
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "attacking_hero",
          trigger: "on_defend",
        },
      ],
      notes:
        "Only when it defends together with an attack action card and a non-attack action card. You also draw a card.",
    },
  },
  "Vestige of Flagellation": {
    verified: true,
    card: {
      notes:
        "The first time each turn an opponent would gain life, you lose that much instead and create that many Vigor tokens.",
    },
  },

  // Defensive only (keywords such as Arcane Barrier, Temper and Blade Break are in the dataset)
  "Blackstone Greaves": {
    verified: true,
    card: { notes: "+1 defense if you've dealt arcane damage this turn." },
  },
  "Dyadic Carapace": { verified: true, card: {} },
  "Helm of Might and Magic": { verified: true, card: {} },
  "Helm of the Arknight": { verified: true, card: {} },
};
