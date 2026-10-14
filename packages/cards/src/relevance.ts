// Which ratings a scorer is asked for (README "Floor, ceiling and overall").
// Overall is always asked. Floor and ceiling only when the card has conditions; otherwise
// they're left blank and resolve as overall. Keys match score_dimensions.key; a dimension
// without a rule is always shown.
import type { AuthoredCardAttributes, CardAttributes } from "./attributes.ts";
import { hasConditions } from "./conditions.ts";

type Rule = (
  card: CardAttributes,
  variants: Partial<AuthoredCardAttributes>[],
) => boolean;

const RULES: Record<string, Rule> = {
  floor: hasConditions,
  ceiling: hasConditions,
  overall: () => true,
};

export function relevantDimensions(
  dimensionKeys: string[],
  card: CardAttributes,
  variantAttributes: Partial<AuthoredCardAttributes>[] = [],
): string[] {
  return dimensionKeys.filter((key) =>
    RULES[key] ? RULES[key](card, variantAttributes) : true,
  );
}
