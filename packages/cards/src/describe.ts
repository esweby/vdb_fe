// Plain-English descriptions of attributes, for review sheets and card pages.
import type {
  CardAttributes,
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
};

/** "Creates 1 Runechant…" or, when granted, "Your next … gets: creates 1 Runechant…". */
function effect(text: string, grantedTo: GrantedTo | undefined): string {
  return grantedTo
    ? `${GRANTED_TEXT[grantedTo]}: ${text[0]!.toLowerCase()}${text.slice(1)}`
    : text;
}

function ifConditions(conditions: Condition[] | undefined): string {
  return conditions?.length
    ? `, if ${conditions.map((c) => CONDITION_TEXT[c]).join(" and ")}`
    : "";
}

export function describeAttributes(attributes: CardAttributes): string[] {
  const lines: string[] = [];

  if (attributes.specialization)
    lines.push(`${attributes.specialization} specialization.`);

  for (const b of attributes.banishesOwn ?? []) {
    const verb = b.optional ? "May banish" : "Banishes";
    lines.push(
      `${verb} ${BANISH_TEXT[b.from]} ${TRIGGER_TEXT[b.trigger]}${ifConditions(b.conditions)}.`,
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

  if (attributes.playableFromBanish) {
    lines.push(
      `Can be played from your banished zone${ifConditions(attributes.playableFromBanish.conditions)}.`,
    );
  }
  if (attributes.costReducedPerRunechant)
    lines.push("Costs {r} less for each Runechant you control.");
  if (attributes.hasUsurp) lines.push("Usurp.");
  if (attributes.hasRuneGate) lines.push("Rune Gate.");
  if (attributes.goAgain) {
    const conditions = attributes.goAgain.conditions;
    lines.push(
      conditions?.length
        ? `Gets go again${ifConditions(conditions)}.`
        : "Gets go again under a condition (see note).",
    );
  } else if (attributes.hasGoAgain) {
    lines.push("Go again.");
  }
  if (attributes.grantsGoAgain) {
    lines.push(`${GRANTED_TEXT[attributes.grantsGoAgain]} go again.`);
  }
  if (attributes.hasBloodDebt) lines.push("Blood debt.");
  if (attributes.notes) lines.push(`Note: ${attributes.notes}`);

  return lines;
}
