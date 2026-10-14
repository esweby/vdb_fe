// Maps dataset entries (one per name + pitch) to our cards and variants.
import {
  authoredAttributesSchema,
  type AuthoredCardAttributes,
  type CardAttributes,
  type GeneratedAttributes,
} from "@vdb/cards";
import {
  classifyTypes,
  isViseraiLegal,
  specializationOf,
  type DatasetCard,
} from "./classify.ts";

export interface AuthoredEntry {
  /** Has a player checked these attributes? */
  verified: boolean;
  card?: AuthoredCardAttributes;
  /** Overrides for a specific pitch. Each key replaces the card's value for that key. */
  variants?: Partial<Record<number, AuthoredCardAttributes>>;
}

/** Hand-authored attributes keyed by card name. */
export type AuthoredAttributes = Record<string, AuthoredEntry>;

export interface ImportVariant {
  externalId: string;
  pitch: number | null;
  cost: number | null;
  power: number | null;
  defense: number | null;
  text: string | null;
  /** Overrides merged over the card's attributes. */
  attributes: AuthoredCardAttributes;
}

export interface ImportCard {
  externalId: string;
  name: string;
  type: string;
  subtypes: string[];
  classes: string[];
  talents: string[];
  keywords: string[];
  text: string | null;
  attributes: CardAttributes;
  attributesVerified: boolean;
  variants: ImportVariant[];
}

/** Dataset stats are strings; "", "X", "*" and the like become null. */
export function parseStat(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function toTypeKey(mainType: string, subtypes: string[]): string {
  if (mainType === "Action" && subtypes.includes("Attack"))
    return "attack_action";
  return mainType.toLowerCase().replace(/[\s-]+/g, "_");
}

function generatedAttributes(
  keywords: string[],
  specialization: string | null,
  type: string,
): GeneratedAttributes {
  const hasBloodDebt = keywords.includes("Blood Debt");
  return {
    hasGoAgain: keywords.includes("Go again"),
    hasBloodDebt,
    hasUsurp: keywords.includes("Usurp"),
    hasRuneGate: keywords.includes("Rune Gate"),
    // Gate to i'Arathael: "play target action card with blood debt from your banished zone".
    isGateTarget:
      hasBloodDebt && (type === "action" || type === "attack_action"),
    specialization,
  };
}

function validated(
  name: string,
  where: string,
  value: unknown,
): AuthoredCardAttributes {
  const result = authoredAttributesSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Authored attributes for "${name}" (${where}) don't match the vocabulary: ${result.error.message}`,
    );
  }
  return result.data;
}

/** A variant's full attributes: the card's, with the variant's overrides replacing matching keys. */
export function variantAttributes(
  card: ImportCard,
  variant: ImportVariant,
): CardAttributes {
  return { ...card.attributes, ...variant.attributes };
}

export function toImportCards(
  entries: DatasetCard[],
  authored: AuthoredAttributes,
): ImportCard[] {
  const groups = new Map<string, DatasetCard[]>();
  for (const entry of entries.filter(isViseraiLegal)) {
    groups.set(entry.name, [...(groups.get(entry.name) ?? []), entry]);
  }

  for (const name of Object.keys(authored)) {
    if (!groups.has(name))
      throw new Error(
        `Authored attributes for "${name}", which isn't an imported card`,
      );
  }

  return [...groups.entries()].map(([name, group]) => {
    const first = group[0]!;
    const { mainType, classes, talents, subtypes } = classifyTypes(first.types);
    const keywords = [...new Set(group.flatMap((e) => e.card_keywords))].sort();
    const texts = new Set(group.map((e) => e.functional_text_plain));
    const entry = authored[name];

    const variants = group
      .map((e): ImportVariant => ({
        externalId: e.unique_id,
        pitch: parseStat(e.pitch),
        cost: parseStat(e.cost),
        power: parseStat(e.power),
        defense: parseStat(e.defense),
        text: e.functional_text_plain || null,
        attributes: {},
      }))
      .sort((a, b) => (a.pitch ?? 0) - (b.pitch ?? 0));

    for (const [pitch, attributes] of Object.entries(entry?.variants ?? {})) {
      const variant = variants.find((v) => v.pitch === Number(pitch));
      if (!variant)
        throw new Error(
          `Authored attributes for "${name}" pitch ${pitch}, which doesn't exist`,
        );
      variant.attributes = validated(name, `pitch ${pitch}`, attributes);
    }

    return {
      externalId: name,
      name,
      type: toTypeKey(mainType!, subtypes),
      subtypes,
      classes,
      talents,
      keywords,
      text: texts.size === 1 ? first.functional_text_plain || null : null,
      attributes: {
        ...generatedAttributes(
          keywords,
          specializationOf(first),
          toTypeKey(mainType!, subtypes),
        ),
        ...(entry?.card ? validated(name, "card", entry.card) : {}),
        // Authored conditional go again means the keyword isn't natural go again.
        ...(entry?.card?.goAgain ? { hasGoAgain: false } : {}),
      },
      attributesVerified: entry?.verified ?? false,
      variants,
    };
  });
}
