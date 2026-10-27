// Effect drafts from a card's recorded facts (docs/rules-engine.md, step 9). A draft is a
// starting point, never the oracle: it's UNVERIFIED until a player checks it against the
// printed text. What the facts record but the engine can't run is listed in notDrafted rather
// than guessed at.
import type { AuthoredCardAttributes, Condition } from "@vdb/cards";
import {
  describeEffects,
  type Check,
  type CostReduction,
  type Effect,
  type Trigger,
  type RulesCard,
} from "@vdb/engine/rules";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { CONDITION_PLAIN } from "../decks/conditionAvailability.ts";

export interface DraftRules {
  effects: Effect[];
  goAgain?: boolean;
  instantWhen?: RulesCard["instantWhen"];
  triggers?: Trigger[];
  usurp?: boolean;
  playableFromBanish?: boolean;
  playableFromBanishWhen?: RulesCard["playableFromBanishWhen"];
  /** "If this would be put into your graveyard from anywhere, instead banish it." */
  graveyardToBanish?: boolean;
  /** What makes it cost less (docs/phase-two.md, engine features, 2). */
  costReductions?: CostReduction[];
  /** An activated ability: how it's paid, and what it does (20 Oct 2026). */
  activate?: {
    speed: "instant" | "action";
    cost: number;
    pay: "destroy" | "banish" | "banish_from_hand" | "discard" | "none";
    effects: Effect[];
  };
}

/** How an activation is paid, as the card says it. */
const PAY_TEXT: Record<string, string> = {
  destroy: "destroy this",
  banish: "banish this",
  banish_from_hand: "banish this from your hand",
  discard: "discard this",
};

export interface EffectDraft {
  cardName: string;
  pitch: number | null;
  rules: DraftRules;
  /** The draft in plain words, to check against the printed text. */
  description: string[];
  /** What the facts record that the draft leaves out for now, and why. */
  notDrafted: string[];
  /**
   * What the engine never models (combat, effects on opponents), shown as a reminder. It doesn't
   * hold a draft back (the maintainer, 20 Oct 2026).
   */
  outOfScope: string[];
  /** Both, in the order noted: what a draft's hash covers, so verdicts carry over. */
  leftOut: string[];
  /** Nothing was left out but what's out of scope. Still unverified until a player checks it. */
  complete: boolean;
  /** The note on the card's facts, if any: read it before accepting. */
  factsNote?: string;
}

const TOKEN_LABEL: Record<string, string> = {
  runechant: "Runechants",
  gate: "Gates",
  eloquence: "Eloquence",
};

const TOKEN_SINGLE: Record<string, string> = {
  runechant: "Runechant",
  gate: "Gate",
  eloquence: "Eloquence",
};

const TRIGGER_PLAIN: Record<string, string> = {
  on_defend: "when it defends",
  on_pitch: "when it's pitched",
  on_banished: "when it's banished",
  on_leave_arena: "when it leaves the arena",
  on_destroyed: "when it's destroyed",
  on_usurped: "when it's usurped",
  would_go_to_graveyard: "instead of going to the graveyard",
  would_be_dealt_damage: "when you would be dealt damage",
  your_end_phase: "in your end phase",
  start_of_turn: "at the start of your turn",
  start_of_action_phase: "at the start of your action phase",
  combat_chain_closes: "when the combat chain closes",
  activated: "when it's activated",
};

/** How a drafted trigger's event reads. */
const TRIGGER_EVENT_TEXT: Record<string, string> = {
  pitched: "When this is pitched",
  moved: "When this is banished",
  attacking: "When this attacks",
  played: "When you play an attack action card",
  lifeLost: "When you lose life",
  arcaneDamage: "When Runechants deal arcane damage",
  damageNoted: "When you note damage dealt to the defending hero",
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A condition the engine can check, given what the draft has bound so far. */
function conditionCheck(
  condition: Condition,
  bound: Set<string>,
  pitch: number | null,
): Check | null {
  if (condition === "banished_card_is_runeblade" && bound.has("banished"))
    return { has: "runeblade", target: "banished" };
  if (condition === "banished_card_is_shadow" && bound.has("banished"))
    return { has: "shadow", target: "banished" };
  if (
    condition === "top_card_matches_pitch" &&
    bound.has("banished") &&
    pitch !== null
  )
    // UNVERIFIED Pull from Beyond draft: check the card just banished from the deck.
    return { pitch, target: "banished" };
  return null;
}

/** One check for several conditions, or the first condition it can't check. */
function checksFor(
  conditions: readonly Condition[] | undefined,
  bound: Set<string>,
  pitch: number | null,
): { check?: Check; missing?: Condition } {
  const checks: Check[] = [];
  for (const c of conditions ?? []) {
    const check = conditionCheck(c, bound, pitch);
    if (!check) return { missing: c };
    checks.push(check);
  }
  if (checks.length === 0) return {};
  return { check: checks.length === 1 ? checks[0] : { all: checks } };
}

const guarded = (check: Check | undefined, effects: Effect[]): Effect[] =>
  check ? [{ op: "if", check, then: effects }] : effects;

/** A draft of a card's rules from its recorded facts (its pitch's facts over the card's). */
export function draftEffects(
  card: CardSummary,
  variant: VariantSummary,
): EffectDraft {
  const a = {
    ...card.attributes,
    ...variant.attributes,
  } as CardSummary["attributes"] & Partial<AuthoredCardAttributes>;
  const effects: Effect[] = [];
  const triggers: Trigger[] = [];
  let manualGoAgain = false;
  const notDrafted: string[] = [];
  const outOfScope: string[] = [];
  const leftOut: string[] = [];
  const bound = new Set<string>();
  const note = (line: string) => {
    if (leftOut.includes(line)) return;
    leftOut.push(line);
    (line.endsWith("out of scope") ? outOfScope : notDrafted).push(line);
  };

  const attackTriggerEffects: Effect[] = [];
  const attackPlayedEffects: Effect[] = [];
  let banishesOnAttack = false;

  // Opt comes first: on every card with it, it's the card's first instruction (Blood Tribute:
  // "Opt 3, then banish the top card of your deck").
  // What an activated ability does: the facts that happen "when activated" (20 Oct 2026).
  const activation = a.activation;
  const activated: Effect[] = [];

  for (const o of a.opt ?? []) {
    if (activation && o.trigger === "activated") {
      activated.push({ op: "opt", amount: o.amount });
      continue;
    }
    if (o.fromArsenal) {
      note(
        "Opt if it was played from arsenal: the engine can't check that yet",
      );
      continue;
    }
    // A Gate that needs a top card of the card's own pitch (Pull from Beyond): keep one on top.
    const wantsPitch =
      variant.pitch !== null &&
      (a.tokens ?? []).some((t) =>
        t.conditions?.includes("top_card_matches_pitch"),
      );
    const opt: Effect = {
      op: "opt",
      amount: o.amount,
      ...(wantsPitch ? { keepPitch: variant.pitch! } : {}),
    };
    if (o.trigger === "on_play") effects.push(opt);
    else if (o.trigger === "on_attack") attackTriggerEffects.push(opt);
    else if (o.trigger === "on_hit" || o.trigger === "on_defend")
      note(
        `Opt when it ${o.trigger === "on_hit" ? "hits" : "defends"}: combat is out of scope`,
      );
    else note(`Opt ${TRIGGER_PLAIN[o.trigger] ?? o.trigger}: not drafted yet`);
  }

  // UNVERIFIED Embrace Ursur draft adds the attack timing; on-play banishing is established.
  // Banishing your own cards as the card is played or attacks.
  for (const b of a.banishesOwn ?? []) {
    if (b.trigger !== "on_play" && b.trigger !== "on_attack") {
      note(
        `Banishing ${TRIGGER_PLAIN[b.trigger] ?? b.trigger}: not drafted yet`,
      );
      continue;
    }
    if (b.from === "defending_cards") {
      note("Banishing defending cards: combat is out of scope");
      continue;
    }
    const amount = b.amount ?? 1;
    if (amount === "any" || amount === "X") {
      note(
        `Banishing ${amount === "any" ? "any number of" : "X"} cards: the engine needs a number`,
      );
      continue;
    }
    if (b.which) {
      note("Banishing only action cards: the engine can't filter that yet");
      continue;
    }
    if (b.temporary) {
      note("Banishing cards that then move on: not drafted yet");
      continue;
    }
    if ((b.conditions?.length ?? 0) > 0) {
      note(
        `Banishing if ${CONDITION_PLAIN[b.conditions![0]!]}: the engine can't check that yet`,
      );
      continue;
    }
    const from =
      b.from === "hand"
        ? "hand"
        : b.from === "deck_top"
          ? "deckTop"
          : "graveyard";
    const needsBanishedBinding =
      from === "hand" ||
      (a.tokens ?? []).some((token) =>
        token.conditions?.includes("top_card_matches_pitch"),
      );
    const storeAs =
      needsBanishedBinding && !bound.has("banished") ? "banished" : undefined;
    const banish: Effect = {
      op: "banish",
      from,
      amount,
      ...(b.optional ? { optional: true } : {}),
      ...(storeAs ? { storeAs } : {}),
    };
    (b.trigger === "on_attack" ? attackTriggerEffects : effects).push(banish);
    if (b.trigger === "on_attack") banishesOnAttack = true;
    if (storeAs) bound.add(storeAs);
  }

  // Tokens.
  for (const t of a.tokens ?? []) {
    const label = TOKEN_LABEL[t.token] ?? t.token;
    if (t.grantedTo) {
      note(`${label} given to a later card`);
      continue;
    }
    const amount = t.amount;
    if (amount === "X") {
      if (
        t.trigger === "on_banished" &&
        t.lifePaidUpTo &&
        !t.conditions?.length
      ) {
        triggers.push({
          id: `${slug(card.name)}-banished`,
          on: { event: "moved", to: "banished", self: true },
          effects: [
            { op: "payLifeForToken", token: t.token, maximum: t.lifePaidUpTo },
          ],
        });
        continue;
      }
      note(`X ${label}: the engine needs a number`);
      continue;
    }
    if (t.trigger === "on_hit" || t.trigger === "your_attack_action_hits") {
      note(`${label} on hit: combat is out of scope`);
      continue;
    }
    const { check, missing } = checksFor(t.conditions, bound, variant.pitch);
    if (missing) {
      note(
        `${amount} ${amount === 1 ? (TOKEN_SINGLE[t.token] ?? t.token) : label} if ${CONDITION_PLAIN[missing]}: the engine can't check that yet`,
      );
      continue;
    }
    const make = guarded(check, [
      { op: "createToken", token: t.token, amount },
    ]);
    if (t.trigger === "on_play") effects.push(...make);
    else if (t.trigger === "on_pitch" || t.trigger === "on_banished")
      triggers.push({
        id: `${slug(card.name)}-${t.trigger === "on_pitch" ? "pitched" : "banished"}`,
        on:
          t.trigger === "on_pitch"
            ? { event: "pitched", self: true }
            : { event: "moved", to: "banished", self: true },
        effects: make,
      });
    else if (activation && t.trigger === "activated") activated.push(...make);
    else if (t.trigger === "on_attack") attackTriggerEffects.push(...make);
    else if (t.trigger === "your_attack_action_played")
      attackPlayedEffects.push(...make);
    else
      note(
        `${label} ${TRIGGER_PLAIN[t.trigger] ?? t.trigger}: not drafted yet`,
      );
  }
  // "If you lose {h} during your turn, destroy this." Goldfish and scenarios play your turns only.
  if (a.destroyedOnLifeLoss)
    triggers.push({
      id: `${slug(card.name)}-life-lost`,
      on: { event: "lifeLost" },
      effects: [{ op: "destroySelf" }],
    });
  if (attackPlayedEffects.length)
    triggers.push({
      id: `${slug(card.name)}-attack-played`,
      on: { event: "played" },
      condition: { cardIs: { type: "attack_action" }, target: "event" },
      effects: attackPlayedEffects,
    });

  // Conditional go again.
  if (a.goAgain) {
    if (
      a.goAgain.conditions.length === 1 &&
      a.goAgain.conditions[0] === "banished_card_is_shadow" &&
      banishesOnAttack &&
      bound.has("banished")
    ) {
      attackTriggerEffects.push({
        op: "if",
        check: { has: "shadow", target: "banished" },
        then: [{ op: "grantGoAgain", target: "self" }],
      });
    } else if (
      a.goAgain.conditions.length === 1 &&
      a.goAgain.conditions[0] === "less_life_than_opposing_hero"
    ) {
      manualGoAgain = true;
      triggers.push({
        id: `${slug(card.name)}-go-again`,
        on: { event: "played", self: true },
        effects: [
          {
            op: "ifAnswered",
            condition: "less_life_than_opposing_hero",
            then: [{ op: "grantGoAgain", target: "self" }],
          },
        ],
      });
    } else if (
      a.goAgain.conditions.length === 1 &&
      a.goAgain.conditions[0] === "dealt_damage_to_defending_hero_this_turn"
    ) {
      // UNVERIFIED draft. The maintainer confirmed on 23 Oct 2026 that damage from its own
      // Runechants or hit counts. Combat damage is noted by hand; the goldfish has no prevention.
      for (const event of ["played", "arcaneDamage", "damageNoted"] as const)
        triggers.push({
          id: `${slug(card.name)}-go-again-${event}`,
          on: { event, ...(event === "played" ? { self: true } : {}) },
          effects: [
            {
              op: "if",
              check: {
                all: [{ latestAttack: "self" }, { damageDealtThisTurn: 1 }],
              },
              then: [{ op: "grantGoAgain", target: "self" }],
            },
          ],
        });
      note(
        "Damage from this attack's hit must be noted by hand: combat is out of scope",
      );
    } else {
      const { check, missing } = checksFor(
        a.goAgain.conditions,
        bound,
        variant.pitch,
      );
      if (missing || !check)
        note(
          `Go again if ${CONDITION_PLAIN[missing ?? a.goAgain.conditions[0]!]}: the engine can't check that yet`,
        );
      else effects.push({ op: "if", check, then: [{ op: "gainActionPoint" }] });
    }
  }
  if (attackTriggerEffects.length)
    triggers.push({
      id: `${slug(card.name)}-attacks`,
      on: { event: "attacking", self: true },
      effects: attackTriggerEffects,
    });

  // Everything else the facts record, noted rather than guessed.
  if (a.arcaneDamage?.length)
    note("Arcane damage: damage to an opponent is out of scope");
  for (const d of a.disrupts ?? []) {
    if (d.target === "each_hero" && d.trigger === "combat_chain_closes") {
      // UNVERIFIED Widespread cycle draft: combat-chain resolution stays outside this engine.
      note(
        `Each hero ${d.action === "discard" ? "discards" : d.action === "banish" ? "banishes" : "destroys"} when the combat chain closes: combat is out of scope`,
      );
    } else if (
      d.target === "each_hero" &&
      d.action === "banish" &&
      d.from === "hand" &&
      d.amount === 1 &&
      d.trigger === "on_play" &&
      !d.conditions?.length &&
      !d.optional
    ) {
      effects.push({ op: "banish", from: "hand", amount: 1 });
      note("Banishing cards from opposing heroes' hands: out of scope");
    } else
      note(
        d.target === "each_hero"
          ? `Each hero ${d.action === "discard" ? "discards" : `${d.action}s`}: not drafted yet`
          : "Disrupting an opponent: out of scope",
      );
  }
  // Banishing itself (20 Oct 2026): instead of the graveyard is drafted; combat timings are out
  // of scope; activated abilities and the rest aren't drafted yet.
  let graveyardToBanish = false;
  for (const b of a.banishesSelf ?? []) {
    // Banishing itself to activate it is the activation's payment.
    if (activation && b.trigger === "activated") continue;
    if (b.trigger === "would_go_to_graveyard") graveyardToBanish = true;
    else if (
      [
        "combat_chain_closes",
        "would_be_dealt_damage",
        "on_hit",
        "on_defend",
      ].includes(b.trigger)
    )
      note(
        `Banishing itself ${TRIGGER_PLAIN[b.trigger] ?? (b.trigger === "on_hit" ? "when it hits" : b.trigger)}: combat is out of scope`,
      );
    else if (b.trigger === "activated")
      note(
        "Banishing itself when it's activated: activated abilities aren't drafted yet",
      );
    else
      note(
        `Banishing itself ${TRIGGER_PLAIN[b.trigger] ?? b.trigger}: not drafted yet`,
      );
  }
  for (const bonus of a.conditionalBonuses ?? [])
    note(
      bonus.effect === "draw"
        ? "Drawing cards: not drafted yet"
        : "Bonuses to power or defence: combat is out of scope",
    );
  // Cost reductions: per Runechant, or a fixed amount from the banished zone or after a usurp.
  const costReductions: CostReduction[] = [];
  if (a.costReducedPerRunechant)
    costReductions.push({ amount: "perRunechant" });
  for (const r of a.costReductions ?? []) {
    if (r.grantedTo) {
      note("Cost reductions given to a later card: not drafted yet");
      continue;
    }
    const when = (r.conditions ?? []).map((c) => COST_WHEN[c]);
    if (r.amount === "per_runechant" && when.length === 0)
      costReductions.push({ amount: "perRunechant" });
    else if (typeof r.amount === "number" && when.length === 1 && when[0])
      costReductions.push({ amount: r.amount, when: when[0] });
    else
      note(
        `Cost reductions if ${CONDITION_PLAIN[r.conditions?.[0] as Condition] ?? "something else"}: not drafted yet`,
      );
  }
  for (const tutor of a.tutors ?? []) {
    if (
      "group" in tutor.target &&
      tutor.target.group === "runechant_aura" &&
      tutor.to === "arena" &&
      tutor.trigger === "on_attack" &&
      tutor.conditions?.length === 1 &&
      tutor.conditions[0] === "played_from_banish"
    )
      triggers.push({
        id: `${slug(card.name)}-search`,
        on: { event: "attacking", self: true },
        condition: { playedFromBanish: "self" },
        ...(tutor.optional ? { optional: true } : {}),
        effects: [{ op: "searchRunechantAura" }],
      });
    else note("Searching the deck: not drafted yet");
  }
  for (const enabler of a.enablesPlayFromBanish ?? []) {
    if (
      "group" in enabler.target &&
      enabler.target.group === "runechant_aura" &&
      !enabler.from &&
      !enabler.conditions?.length
    )
      effects.push({ op: "allowRunechantAuraPlay" });
    else
      note(
        "Letting other cards be played from the banished zone: not drafted yet",
      );
  }
  if (a.turnsBanishedFaceDown?.length)
    note("Turning banished cards face down: not drafted yet");
  const instantWhen =
    a.instantSpeed?.conditions.length === 1 &&
    a.instantSpeed.conditions[0] === "hero_lost_life_this_turn"
      ? ("hero_lost_life_this_turn" as const)
      : undefined;
  if (a.instantSpeed && !instantWhen)
    note("Playing it as an instant: not drafted yet");
  if (a.grantsGoAgain) note("Go again given to a later card: not drafted yet");
  // A note says what the facts couldn't: it's read before accepting, but doesn't hold the draft
  // back (the maintainer, 20 Oct 2026). It stays among what's left out, so the hash, and the
  // verdicts given on it, don't change.
  if (a.notes)
    leftOut.push(`A note on the card's facts, to check by hand: ${a.notes}`);
  const playableFromBanish =
    !!a.playableFromBanish &&
    (a.playableFromBanish.conditions?.length ?? 0) === 0;
  const playableFromBanishWhen =
    a.playableFromBanish?.conditions?.length === 1 &&
    a.playableFromBanish.conditions[0] === "usurped_this_turn"
      ? ("usurpedThisTurn" as const)
      : undefined;
  if (a.playableFromBanish && !playableFromBanish && !playableFromBanishWhen)
    note(
      "Playing it from the banished zone under a condition: not drafted yet",
    );

  if (activation?.extraCost)
    note(
      "Another cost to activate it (discarding, tapping, counters): not drafted yet",
    );
  const rules: DraftRules = {
    effects,
    ...(manualGoAgain ? { goAgain: false } : {}),
    ...(instantWhen ? { instantWhen } : {}),
    ...(activation
      ? {
          activate: {
            speed: activation.speed,
            cost: activation.cost,
            pay: activation.pay,
            effects: activated,
          },
        }
      : {}),
    ...(triggers.length ? { triggers } : {}),
    ...(a.hasUsurp ? { usurp: true } : {}),
    ...(playableFromBanish ? { playableFromBanish: true } : {}),
    ...(playableFromBanishWhen ? { playableFromBanishWhen } : {}),
    ...(graveyardToBanish ? { graveyardToBanish: true } : {}),
    ...(costReductions.length ? { costReductions } : {}),
  };
  const description = [
    ...describeEffects(effects),
    ...triggers.flatMap((t) =>
      describeEffects(t.effects).map(
        (line) =>
          `${t.on.event === "played" && t.on.self ? "When this is played" : (TRIGGER_EVENT_TEXT[t.on.event] ?? "When you play an attack action card")}${t.condition && "playedFromBanish" in t.condition ? ", if this was played from the banished zone" : ""}: ${t.optional ? "you may " : ""}${line[0]!.toLowerCase()}${line.slice(1)}`,
      ),
    ),
    ...(rules.usurp ? ["Usurp."] : []),
    ...(rules.instantWhen
      ? [
          "You may play this as an instant if a hero has lost life this turn (the player answers).",
        ]
      : []),
    ...(rules.playableFromBanish
      ? ["It can be played from the banished zone."]
      : []),
    ...(rules.playableFromBanishWhen === "usurpedThisTurn"
      ? ["It can be played from the banished zone if you've usurped this turn."]
      : []),
    ...(rules.graveyardToBanish
      ? ["If it would go to the graveyard, it's banished instead."]
      : []),
    ...(rules.costReductions ?? []).map(describeCostReduction),
    ...(rules.activate ? [describeActivation(rules.activate)] : []),
  ];
  return {
    cardName: card.name,
    pitch: variant.pitch,
    rules,
    description: [
      ...description,
      ...(description.length === 0 && leftOut.length === 0 && a.hasRuneGate
        ? ["Rune Gate."]
        : []),
      ...(description.length === 0 && leftOut.length === 0 && a.hasBloodDebt
        ? ["Blood debt."]
        : []),
    ],
    notDrafted,
    outOfScope,
    leftOut,
    complete: notDrafted.length === 0,
    ...(a.notes ? { factsNote: a.notes } : {}),
  };
}

/** The conditions a fixed cost reduction can be drafted for. */
const COST_WHEN: Partial<
  Record<string, Extract<CostReduction, { when: string }>["when"]>
> = {
  played_from_banish: "playedFromBanish",
  usurped_this_turn: "usurpedThisTurn",
};

/** "It costs 2 less if it's played from the banished zone." */
function describeCostReduction(r: CostReduction): string {
  if (r.amount === "perRunechant")
    return "It costs 1 less for each Runechant you have.";
  return `It costs ${r.amount} less if ${
    r.when === "playedFromBanish"
      ? "it's played from the banished zone"
      : "you've usurped this turn"
  }.`;
}

/** "Activate (instant, 1 resource, destroy this): create 1 Runechant." */
function describeActivation(a: NonNullable<DraftRules["activate"]>): string {
  const how = [
    a.speed,
    ...(a.cost ? [`${a.cost} resource${a.cost === 1 ? "" : "s"}`] : []),
    ...(PAY_TEXT[a.pay] ? [PAY_TEXT[a.pay]!] : []),
  ].join(", ");
  const does = describeEffects(a.effects)
    .map(
      (line) => `${line[0]!.toLowerCase()}${line.slice(1).replace(/\.$/, "")}`,
    )
    .join("; ");
  return `Activate (${how})${does ? `: ${does}` : ""}.`;
}
