// Plain-English descriptions of attributes, for review sheets and card pages.
import type { CardGroup } from "./groups.ts";
import type {
  CardAttributes,
  CardRef,
  Tutor,
  Disruption,
  Condition,
  GrantedTo,
  Token,
  Trigger,
} from "./attributes.ts";

const TRIGGER_TEXT: Record<Trigger, string> = {
  on_play: "when played",
  on_attack: "when it attacks",
  on_hit: "when it hits",
  on_defend: "when it defends",
  on_pitch: "when pitched",
  on_banished: "when it's banished",
  on_leave_arena: "when it leaves the arena",
  on_destroyed: "when it's destroyed",
  on_usurped: "when it's usurped",
  would_go_to_graveyard: "instead of going to your graveyard",
  start_of_turn: "at the start of your turn",
  start_of_action_phase: "at the start of your action phase",
  combat_chain_closes: "when the combat chain closes",
  activated: "when activated",
  your_attack_action_played: "when you play an attack action card",
  your_attack_action_hits: "when an attack action card you control hits",
};

const CONDITION_TEXT: Record<Condition, string> = {
  banished_card_is_runeblade: "the banished card is Runeblade",
  banished_card_is_shadow: "the banished card is Shadow",
  pitched_attack_action: "an attack action card was pitched to play it",
  pitched_non_attack_action: "a non-attack action card was pitched to play it",
  played_attack_action_this_turn:
    "you've played an attack action card this turn",
  played_non_attack_action_this_turn:
    "you've played a non-attack action card this turn",
  dealt_arcane_damage_this_turn: "you've dealt arcane damage this turn",
  played_or_created_aura_this_turn:
    "you've played or created an aura this turn",
  played_from_banish: "it was played from your banished zone",
  top_card_matches_pitch:
    "the banished or revealed card matches this card's colour",
  destroyed_own_aura: "you destroyed an aura you control",
  hero_lost_life_this_turn: "a hero has lost life this turn",
  dealt_damage_to_defending_hero_this_turn:
    "you've dealt damage to the defending hero this turn",
  dealt_arcane_damage_to_opponent_this_turn:
    "you've dealt arcane damage to an opponent this turn",
  created_3_or_more_runechants: "it created 3 or more Runechants",
  paid_optional_additional_cost: "you paid its optional additional cost",
  defending_hero_has_soul_cards: "the defending hero has cards in their soul",
  usurped_this_turn: "you've usurped this turn",
};

const TOKEN_TEXT: Record<Token, [one: string, many: string]> = {
  runechant: ["Runechant", "Runechants"],
  gate: ["Gate to i'Arathael", "Gates to i'Arathael"],
  eloquence: ["Eloquence token", "Eloquence tokens"],
};

const BANISH_TEXT = {
  hand: "a card from your hand",
  deck_top: "the top card of your deck",
  graveyard: "a card from your graveyard",
} as const;

const GRANTED_TEXT: Record<GrantedTo, string> = {
  next_attack_action: "Your next attack action card this turn gets",
  next_runeblade_attack_action:
    "Your next Runeblade attack action card this turn gets",
  next_shadow_attack: "Your next Shadow attack this turn gets",
  banished_card: "The card banished this way gets",
  card_in_banished_zone_matching_pitch:
    "A card of this card's colour in your banished zone gets",
  next_action_card_matching_pitch:
    "Your next action card of this card's colour this turn gets",
};

/** "Creates 1 Runechant…" or, when granted, "Your next … gets: creates 1 Runechant…". */
function effect(text: string, grantedTo: GrantedTo | undefined): string {
  return grantedTo
    ? `${GRANTED_TEXT[grantedTo]}: ${text[0]!.toLowerCase()}${text.slice(1)}`
    : text;
}

const DISRUPT_SUBJECT = {
  opponent: "An opponent",
  defending_hero: "The defending hero",
  each_hero: "Each hero (you included)",
} as const;

const plural = (n: number | string, one: string, many: string) =>
  n === 1 ? `1 ${one}` : `${n} ${many}`;

/** The disruption as a verb phrase: [third person, base form]. */
function disruptionPhrase(d: Disruption): [string, string] {
  const all = d.amount === "all";
  if (d.action === "discard") {
    const rest = all ? "their hand" : plural(d.amount, "card", "cards");
    return [`discards ${rest}`, `discard ${rest}`];
  }
  if (d.action === "destroy" || d.from === "auras") {
    const verb = d.action === "destroy" ? "destroy" : "banish";
    const rest = all
      ? "all auras they control"
      : `${plural(d.amount, "aura", "auras")} they control`;
    return [
      `${verb}${verb === "banish" ? "es" : "s"} ${rest}`,
      `${verb} ${rest}`,
    ];
  }
  const rest =
    d.from === "deck_top"
      ? all
        ? "all cards from their deck"
        : d.amount === 1
          ? "the top card of their deck"
          : `the top ${d.amount} cards of their deck`
      : `${all ? "all cards" : plural(d.amount, "card", "cards")} from their ${d.from}`;
  return [`banishes ${rest}`, `banish ${rest}`];
}

const GROUP_TEXT: Record<CardGroup, string> = {
  runechant_aura: "a Runechant aura (sinchant)",
  runeblade_aura: "a Runeblade aura",
  runeblade_attack_action: "a Runeblade attack action card",
  runeblade_non_attack_action: "a Runeblade non-attack action card",
  rune_gate: "a Rune Gate card",
};

const GROUP_PLURAL: Record<CardGroup, string> = {
  runechant_aura: "Runechant auras (sinchants)",
  runeblade_aura: "Runeblade auras",
  runeblade_attack_action: "Runeblade attack action cards",
  runeblade_non_attack_action: "Runeblade non-attack action cards",
  rune_gate: "Rune Gate cards",
};

const refText = (ref: CardRef) =>
  "group" in ref ? GROUP_TEXT[ref.group] : ref.card;

/** [third person, base form] of where a tutor puts the card. */
const TUTOR_TO: Record<Tutor["to"], [string, string]> = {
  hand: ["puts it into your hand", "put it into your hand"],
  arena: ["puts it into the arena", "put it into the arena"],
  banished: ["banishes it", "banish it"],
};

function ifConditions(conditions: Condition[] | undefined): string {
  return conditions?.length
    ? `, if ${conditions.map((c) => CONDITION_TEXT[c]).join(" and ")}`
    : "";
}

export function describeAttributes(attributes: CardAttributes): string[] {
  const lines: string[] = [];

  if (attributes.specialization) {
    lines.push(`${attributes.specialization} specialization.`);
  }
  if (attributes.groups?.includes("runechant_aura")) {
    lines.push("Is a Runechant aura (sinchant).");
  }

  for (const b of attributes.banishesOwn ?? []) {
    const verb = b.optional ? "May banish" : "Banishes";
    lines.push(
      `${verb} ${BANISH_TEXT[b.from]} ${TRIGGER_TEXT[b.trigger]}${ifConditions(b.conditions)}.`,
    );
  }

  for (const b of attributes.banishesSelf ?? []) {
    const verb = b.optional ? "May banish" : "Banishes";
    lines.push(
      `${verb} itself ${TRIGGER_TEXT[b.trigger]}${ifConditions(b.conditions)}.`,
    );
  }

  for (const t of attributes.tokens ?? []) {
    const [one, many] = TOKEN_TEXT[t.token];
    const name = t.amount === 1 ? one : many;
    lines.push(
      effect(
        `Creates ${t.amount} ${name} ${TRIGGER_TEXT[t.trigger]}${ifConditions(t.conditions)}.`,
        t.grantedTo,
      ),
    );
  }

  for (const d of attributes.arcaneDamage ?? []) {
    lines.push(
      effect(
        `Deals ${d.amount} arcane damage ${TRIGGER_TEXT[d.trigger]}${ifConditions(d.conditions)}.`,
        d.grantedTo,
      ),
    );
  }

  for (const d of attributes.disrupts ?? []) {
    const [third, base] = disruptionPhrase(d);
    const subject = DISRUPT_SUBJECT[d.target];
    const sentence = d.optional
      ? `May make ${subject[0]!.toLowerCase()}${subject.slice(1)} ${base}`
      : `${subject} ${third}`;
    lines.push(
      `${sentence} ${TRIGGER_TEXT[d.trigger]}${ifConditions(d.conditions)}.`,
    );
  }

  for (const t of attributes.tutors ?? []) {
    const [third, base] = TUTOR_TO[t.to];
    const sentence = t.optional
      ? `May search your deck for ${refText(t.target)} and ${base}`
      : `Searches your deck for ${refText(t.target)} and ${third}`;
    lines.push(
      `${sentence} ${TRIGGER_TEXT[t.trigger]}${ifConditions(t.conditions)}.`,
    );
  }

  for (const e of attributes.enablesPlayFromBanish ?? []) {
    lines.push(
      `Lets you play ${refText(e.target)} from your banished zone this turn${ifConditions(e.conditions)}.`,
    );
  }

  if (attributes.playableFromBanish) {
    lines.push(
      `Can be played from your banished zone${ifConditions(attributes.playableFromBanish.conditions)}.`,
    );
  }
  if (attributes.isGateTarget) {
    lines.push("Can be played from your banished zone with a Gate.");
  }
  if (attributes.rewardsPlayFromBanish) {
    lines.push("Is better when played from your banished zone.");
  }
  if (attributes.instantSpeed) {
    lines.push(
      `Can be played as an instant${ifConditions(attributes.instantSpeed.conditions)}.`,
    );
  }
  for (const c of attributes.costReductions ?? []) {
    lines.push(`Costs ${c.amount}{r} less${ifConditions(c.conditions)}.`);
  }
  if (attributes.costReducedPerRunechant)
    lines.push("Costs {r} less for each Runechant you control.");
  if (attributes.hasUsurp) lines.push("Usurp.");
  if (attributes.hasRuneGate) {
    lines.push(
      "Rune Gate: if you control at least as many Runechants as its cost, you may play it from your banished zone without paying its cost.",
    );
  }
  if (attributes.goAgain) {
    lines.push(`Gets go again${ifConditions(attributes.goAgain.conditions)}.`);
  } else if (attributes.hasGoAgain) {
    lines.push("Go again.");
  }
  if (attributes.grantsGoAgain) {
    lines.push(`${GRANTED_TEXT[attributes.grantsGoAgain]} go again.`);
  }
  if (attributes.hasBloodDebt) lines.push("Blood debt.");
  for (const sup of attributes.supports ?? []) {
    const what =
      "group" in sup.target ? GROUP_PLURAL[sup.target.group] : sup.target.card;
    lines.push(`Works with ${what}${sup.note ? ` (${sup.note})` : ""}.`);
  }
  if (attributes.notes) lines.push(`Note: ${attributes.notes}`);

  return lines;
}
