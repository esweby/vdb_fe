// Checked by the maintainer, 15 Oct 2026 (README "Floor, ceiling and overall"): whether a card gets floor and ceiling
// ratings. A card has conditions when any recorded effect has a condition, or happens on a
// hit (a blocked attack doesn't get it). Effects given to a later card without a condition
// don't count. Cards without authored attributes have none, so they're asked overall only;
// scorers can still choose to rate floor and ceiling.
import {
  CONDITIONS,
  type AuthoredCardAttributes,
  type CardAttributes,
  type Condition,
} from "./attributes.ts";

const HIT_TRIGGERS = new Set(["on_hit", "your_attack_action_hits"]);

type Effect = { conditions?: readonly string[]; trigger?: string };

const conditional = (e: Effect | undefined) =>
  !!e &&
  ((e.conditions?.length ?? 0) > 0 ||
    (e.trigger !== undefined && HIT_TRIGGERS.has(e.trigger)));

function effectsOf(a: Partial<AuthoredCardAttributes>): (Effect | undefined)[] {
  const grants = typeof a.grantsGoAgain === "object" ? [a.grantsGoAgain] : [];
  return [
    ...(a.tokens ?? []),
    ...(a.banishesOwn ?? []),
    ...(a.banishesSelf ?? []),
    ...(a.arcaneDamage ?? []),
    ...(a.conditionalBonuses ?? []),
    ...(a.turnsBanishedFaceDown ?? []),
    ...(a.costReductions ?? []),
    ...(a.disrupts ?? []),
    ...(a.tutors ?? []),
    ...(a.enablesPlayFromBanish ?? []),
    ...grants,
    a.playableFromBanish,
    a.instantSpeed,
    a.goAgain,
  ];
}

export function hasConditions(
  card: CardAttributes | Partial<AuthoredCardAttributes>,
  variantAttributes: Partial<AuthoredCardAttributes>[] = [],
): boolean {
  return [card, ...variantAttributes].some((a) =>
    effectsOf(a).some(conditional),
  );
}

/** Every condition the card's effects record, across its pitches, each once (vocabulary order). */
export function conditionsOf(
  card: CardAttributes | Partial<AuthoredCardAttributes>,
  variantAttributes: Partial<AuthoredCardAttributes>[] = [],
): Condition[] {
  const found = new Set(
    [card, ...variantAttributes].flatMap((a) =>
      effectsOf(a).flatMap((e) => e?.conditions ?? []),
    ),
  );
  return CONDITIONS.filter((c) => found.has(c));
}
