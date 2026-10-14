// Which score dimensions a card does anything for, so scorers only rate what's relevant.
// A dimension that isn't shown is never scored, and a blank on a reviewed card counts as 0.
// Keys match score_dimensions.key; a dimension without a rule is always shown.
import type {
  AuthoredCardAttributes,
  CardAttributes,
  Token,
} from "./attributes.ts";
import { banishPlayRoutes } from "./routes.ts";

type All = Partial<AuthoredCardAttributes>[];

const creates = (all: All, token: Token) =>
  all.some((a) => a.tokens?.some((t) => t.token === token));

const RULES: Record<string, (all: All, card: CardAttributes) => boolean> = {
  runechantCreation: (all) => creates(all, "runechant"),
  gateCreation: (all) => creates(all, "gate"),
  banish: (all) =>
    all.some(
      (a) =>
        a.banishesOwn?.length ||
        a.banishesSelf?.length ||
        a.disrupts?.some((d) => d.action === "banish"),
    ),
  playableFromBanish: (all, card) =>
    banishPlayRoutes(card).length > 0 ||
    all.some(
      (a) =>
        a.playableFromBanish ||
        a.rewardsPlayFromBanish ||
        a.enablesPlayFromBanish?.length,
    ),
  // The hero traverses on 3+ Runechants created (Forsaken) or a Gate created or activated (Usurper).
  enablesTraverse: (all) => creates(all, "runechant") || creates(all, "gate"),
  utility: () => true,
};

export function relevantDimensions(
  dimensionKeys: string[],
  card: CardAttributes,
  variantAttributes: Partial<AuthoredCardAttributes>[] = [],
): string[] {
  const all: All = [card, ...variantAttributes];
  return dimensionKeys.filter((key) =>
    RULES[key] ? !!RULES[key](all, card) : true,
  );
}
