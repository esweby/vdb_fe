// Plain-English descriptions of attributes, for review sheets and card pages.
import type { CardGroup } from "./groups.ts";
import type {
  CardAttributes,
  OwnBanish,
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
  would_be_dealt_damage: "when you would be dealt damage",
  your_end_phase: "at the beginning of your end phase",
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
  played_or_created_2_or_more_auras_this_turn:
    "you've played or created 2 or more auras this turn",
  played_or_created_3_or_more_auras_this_turn:
    "you've played or created 3 or more auras this turn",
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
  it_defended: "it defended",
  banished_a_card: "you banished a card this way",
  discarded_attack_action: "you discarded an attack action card",
  discarded_non_attack_action: "you discarded a non-attack action card",
  x_is_2_or_more: "X is 2 or more",
  played_card_from_banish_this_turn:
    "you've played a card from your banished zone this turn",
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
  defending_cards: "all your defending cards on the chain",
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
  target_attack_action: "Target attack action card gets",
  all_attack_actions_this_turn: "Your attack action cards this turn get",
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
  attacking_hero: "The attacking hero",
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
  banishes_from_hand: "a card that banishes from hand",
  rewards_shadow_banish: "a card that rewards banishing a Shadow card",
  rewards_runeblade_banish: "a card that rewards banishing a Runeblade card",
  triggers_when_banished: "a card with an effect when it's banished",
};

const GROUP_PLURAL: Record<CardGroup, string> = {
  runechant_aura: "Runechant auras (sinchants)",
  runeblade_aura: "Runeblade auras",
  runeblade_attack_action: "Runeblade attack action cards",
  runeblade_non_attack_action: "Runeblade non-attack action cards",
  rune_gate: "Rune Gate cards",
  banishes_from_hand: "cards that banish from hand",
  rewards_shadow_banish: "cards that reward banishing a Shadow card",
  rewards_runeblade_banish: "cards that reward banishing a Runeblade card",
  triggers_when_banished: "cards with an effect when they're banished",
};

const refText = (ref: CardRef) =>
  "group" in ref ? GROUP_TEXT[ref.group] : ref.card;

/** [third person, base form] of where a tutor puts the card. */
const TUTOR_TO: Record<Tutor["to"], [string, string]> = {
  hand: ["puts it into your hand", "put it into your hand"],
  arena: ["puts it into the arena", "put it into the arena"],
  banished: ["banishes it", "banish it"],
};

function ownBanishText(b: OwnBanish): string {
  const n = b.amount ?? 1;
  if (b.from === "defending_cards" || (b.from === "deck_top" && n === 1)) {
    return BANISH_TEXT[b.from];
  }
  if (b.from === "deck_top") return `the top ${n} cards of your deck`;
  const kind = b.which === "action" ? "action card" : "card";
  const count =
    n === 1
      ? `a ${kind}`
      : n === "any"
        ? `any number of ${kind}s`
        : `${n} ${kind}s`;
  return `${count} from your ${b.from}`;
}

function ifConditions(conditions: Condition[] | undefined): string {
  return conditions?.length
    ? `, if ${conditions.map((c) => CONDITION_TEXT[c]).join(" and ")}`
    : "";
}

function describedItems(attributes: CardAttributes): Item[] {
  const items: Item[] = [];
  const add = (section: Section, trigger: Trigger | undefined, text: string) =>
    items.push({ section, trigger, text });

  if (attributes.specialization) {
    add("keywords", undefined, `${attributes.specialization} specialization.`);
  }
  if (attributes.groups?.includes("runechant_aura")) {
    add("keywords", undefined, "Is a Runechant aura (sinchant).");
  }

  if (attributes.canAttack) {
    add("keywords", undefined, "Weapon attack: triggers your Runechants.");
  }

  for (const b of attributes.banishesOwn ?? []) {
    const verb = b.optional ? "May banish" : "Banishes";
    const temporary = b.temporary
      ? " (temporarily: they don't stay in your banished zone)"
      : "";
    add(
      "resolves",
      b.trigger,
      `${verb} ${ownBanishText(b)} ${TRIGGER_TEXT[b.trigger]}${ifConditions(b.conditions)}${temporary}.`,
    );
  }

  for (const o of attributes.opt ?? []) {
    add(
      "resolves",
      o.trigger,
      `Opt ${o.amount} ${TRIGGER_TEXT[o.trigger]}${o.fromArsenal ? ", if it was played from arsenal" : ""}.`,
    );
  }

  for (const b of attributes.banishesSelf ?? []) {
    const verb = b.optional ? "May banish" : "Banishes";
    add(
      "resolves",
      b.trigger,
      `${verb} itself${b.from === "hand" ? " from your hand" : ""} ${TRIGGER_TEXT[b.trigger]}${ifConditions(b.conditions)}.`,
    );
  }

  for (const t of attributes.tokens ?? []) {
    const [one, many] = TOKEN_TEXT[t.token];
    const name = t.amount === 1 ? one : many;
    add(
      "resolves",
      t.trigger,
      effect(
        `Creates ${t.amount} ${name} ${TRIGGER_TEXT[t.trigger]}${ifConditions(t.conditions)}.`,
        t.grantedTo,
      ),
    );
  }

  for (const d of attributes.arcaneDamage ?? []) {
    add(
      "resolves",
      d.trigger,
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
    add(
      "resolves",
      d.trigger,
      effect(
        `${sentence} ${TRIGGER_TEXT[d.trigger]}${ifConditions(d.conditions)}.`,
        d.grantedTo,
      ),
    );
  }

  for (const f of attributes.turnsBanishedFaceDown ?? []) {
    const kind = { blood_debt: "blood debt ", shadow: "Shadow ", any: "" }[
      f.which
    ];
    const what =
      f.amount === "all"
        ? `all ${kind}cards`
        : f.amount === 1
          ? `1 ${kind}card`
          : `${f.amount} ${kind}cards`;
    const verb = f.optional ? "May turn" : "Turns";
    add(
      "resolves",
      f.trigger,
      `${verb} ${what} in your banished zone face-down ${TRIGGER_TEXT[f.trigger]}${ifConditions(f.conditions)}.`,
    );
  }

  for (const t of attributes.tutors ?? []) {
    const [third, base] = TUTOR_TO[t.to];
    const sentence = t.optional
      ? `May search your deck for ${refText(t.target)} and ${base}`
      : `Searches your deck for ${refText(t.target)} and ${third}`;
    add(
      "resolves",
      t.trigger,
      `${sentence} ${TRIGGER_TEXT[t.trigger]}${ifConditions(t.conditions)}.`,
    );
  }

  for (const e of attributes.enablesPlayFromBanish ?? []) {
    add(
      "resolves",
      undefined,
      `Lets you play ${refText(e.target)} from your banished zone this turn${ifConditions(e.conditions)}.`,
    );
  }

  for (const b of attributes.conditionalBonuses ?? []) {
    const conds = ifConditions(b.conditions);
    if (b.grantedTo) {
      const what = {
        plus_power: `+${b.amount} power`,
        plus_defense: `+${b.amount} defense`,
        dominate: "dominate",
        overpower: "overpower",
        draw: `"draw ${b.amount}"`,
        arcane_cant_be_prevented: `"when this hits a hero, they can't prevent your arcane damage this turn"`,
      }[b.effect];
      add(
        "resolves",
        undefined,
        `${GRANTED_TEXT[b.grantedTo]} ${what}${conds}.`,
      );
      continue;
    }
    const what = {
      plus_power: `Gets +${b.amount} power`,
      plus_defense: `Gets +${b.amount} defense`,
      dominate: "Gets dominate",
      overpower: "Gets overpower",
      draw: `You draw ${b.amount} ${b.amount === 1 ? "card" : "cards"}`,
      arcane_cant_be_prevented:
        "When it hits a hero, they can't prevent your arcane damage this turn",
    }[b.effect];
    add("resolves", undefined, `${what}${conds}.`);
  }

  if (attributes.playableFromBanish) {
    add(
      "playing",
      undefined,
      `Can be played from your banished zone${ifConditions(attributes.playableFromBanish.conditions)}.`,
    );
  }
  // A Gate target isn't described: every blood debt action card is one, so it would only
  // repeat "Blood debt." (maintainer, 15 Oct 2026). The route stays in the data.
  if (attributes.rewardsPlayFromBanish) {
    add("works", undefined, "Is better when played from your banished zone.");
  }
  if (attributes.instantSpeed) {
    add(
      "playing",
      undefined,
      `Can be played as an instant${ifConditions(attributes.instantSpeed.conditions)}.`,
    );
  }
  for (const c of attributes.costReductions ?? []) {
    add(
      "playing",
      undefined,
      effect(
        `Costs ${c.amount === "per_runechant" ? "{r} less for each Runechant you control" : `${c.amount}{r} less`}${ifConditions(c.conditions)}.`,
        c.grantedTo,
      ),
    );
  }
  if (attributes.costReducedPerRunechant)
    add("playing", undefined, "Costs {r} less for each Runechant you control.");
  if (attributes.hasUsurp) add("keywords", undefined, "Usurp.");
  if (attributes.hasRuneGate) {
    add(
      "playing",
      undefined,
      "Rune Gate: if you control at least as many Runechants as its cost, you may play it from your banished zone without paying its cost.",
    );
  }
  if (attributes.goAgain) {
    add(
      "keywords",
      undefined,
      `Gets go again${ifConditions(attributes.goAgain.conditions)}.`,
    );
  } else if (attributes.hasGoAgain) {
    add("keywords", undefined, "Go again.");
  }
  if (attributes.grantsGoAgain) {
    const g = attributes.grantsGoAgain;
    const [to, conditions] =
      typeof g === "string" ? [g, undefined] : [g.to, g.conditions];
    add(
      "keywords",
      undefined,
      `${GRANTED_TEXT[to]} go again${ifConditions(conditions)}.`,
    );
  }
  if (attributes.hasBloodDebt) add("keywords", undefined, "Blood debt.");
  if (attributes.oneUse)
    add("keywords", undefined, "One use: destroyed or banished when used.");
  for (const sup of attributes.supports ?? []) {
    const what =
      "group" in sup.target ? GROUP_PLURAL[sup.target.group] : sup.target.card;
    add(
      "works",
      undefined,
      `Works with ${what}${sup.note ? ` (${sup.note})` : ""}.`,
    );
  }
  if (attributes.notes) add("works", undefined, `Note: ${attributes.notes}`);

  return items;
}

type Section = "playing" | "resolves" | "keywords" | "works";
interface Item {
  section: Section;
  trigger: Trigger | undefined;
  text: string;
}

const SECTION_HEADINGS: [Section, string][] = [
  ["playing", "Playing it"],
  ["resolves", "When it resolves"],
  ["keywords", "Keywords"],
  ["works", "Works with"],
];

// UNVERIFIED reading order: roughly when each trigger happens during a turn.
const TRIGGER_ORDER: Record<Trigger, number> = {
  on_pitch: 0,
  activated: 1,
  on_play: 1,
  your_attack_action_played: 2,
  on_attack: 3,
  on_defend: 3,
  on_hit: 4,
  your_attack_action_hits: 4,
  would_be_dealt_damage: 5,
  on_banished: 6,
  on_leave_arena: 6,
  on_destroyed: 6,
  would_go_to_graveyard: 6,
  on_usurped: 6,
  combat_chain_closes: 7,
  your_end_phase: 8,
  start_of_turn: 9,
  start_of_action_phase: 9,
};

/** Every line, in the order the attributes are checked (used by the review sheet). */
export function describeAttributes(attributes: CardAttributes): string[] {
  return describedItems(attributes).map((i) => i.text);
}

/**
 * The same lines grouped for reading: how you play it, what it does in the order it happens
 * during a turn, its keywords, then what it works with. Empty sections are left out.
 */
export function describeAttributeSections(
  attributes: CardAttributes,
): { heading: string; lines: string[] }[] {
  const items = describedItems(attributes);
  return SECTION_HEADINGS.flatMap(([section, heading]) => {
    const inSection = items.filter((i) => i.section === section);
    if (section === "resolves") {
      inSection.sort(
        (a, b) =>
          (a.trigger === undefined ? 1 : TRIGGER_ORDER[a.trigger]) -
          (b.trigger === undefined ? 1 : TRIGGER_ORDER[b.trigger]),
      );
    }
    return inSection.length > 0
      ? [{ heading, lines: inSection.map((i) => i.text) }]
      : [];
  });
}
