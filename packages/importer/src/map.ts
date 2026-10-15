// Maps dataset entries (one per name + pitch) to our cards and variants.
import {
  attributeGroups,
  authoredAttributesSchema,
  groupsOf,
  type AuthoredCardAttributes,
  type CardAttributes,
  type GeneratedAttributes,
} from "@vdb/cards";
import {
  classifyTypes,
  isViseraiLegal,
  specializationOf,
  type DatasetCard,
  type DatasetPrinting,
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
  /** Official image of the chosen printing, or null. */
  imageUrl: string | null;
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
  groups: GeneratedAttributes["groups"],
  text: string,
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
    groups,
    // Weapon attacks fire Runechants; some weapons have no Attack ability.
    canAttack: type === "weapon" && /:\s*Attack\b/.test(text),
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

  const cards = [...groups.entries()].map(([name, group]) => {
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
        imageUrl: pickImageUrl(e.printings),
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
          groupsOf({
            name,
            type: toTypeKey(mainType!, subtypes),
            subtypes,
            classes,
            keywords,
          }),
          first.functional_text_plain ?? "",
        ),
        ...(entry?.card ? validated(name, "card", entry.card) : {}),
        // Authored conditional go again means the keyword isn't natural go again.
        ...(entry?.card?.goAgain ? { hasGoAgain: false } : {}),
      },
      attributesVerified: entry?.verified ?? false,
      variants,
    };
  });

  for (const card of cards) addAttributeGroups(card);
  checkReferences(cards);
  return cards;
}

/** Every card named in a tutor or play-from-banish enabler must be an imported card. */
function checkReferences(cards: ImportCard[]): void {
  const names = new Set(cards.map((c) => c.name));
  for (const card of cards) {
    for (const attributes of [
      card.attributes,
      ...card.variants.map((v) => v.attributes),
    ]) {
      const refs = [
        ...(attributes.tutors ?? []).map((t) => t.target),
        ...(attributes.enablesPlayFromBanish ?? []).map((e) => e.target),
      ];
      for (const ref of refs) {
        if ("card" in ref && !names.has(ref.card)) {
          throw new Error(
            `"${card.name}" references "${ref.card}", which isn't an imported card`,
          );
        }
      }
    }
  }
}

/** Adds groups derived from the merged attributes (card and every variant). */
function addAttributeGroups(card: ImportCard): void {
  const derived = [
    card.attributes,
    ...card.variants.map((v) => v.attributes),
  ].flatMap((a) => attributeGroups(a));
  card.attributes.groups = [
    ...new Set([...card.attributes.groups, ...derived]),
  ];
}

/**
 * The image a variant shows: the latest printing with standard foiling and normal art, or
 * failing that any printing with an image (docs/phase-one.md backlog).
 */
export function pickImageUrl(
  printings: DatasetPrinting[] | undefined,
): string | null {
  const withImage = (printings ?? []).filter((p) => !!p.image_url);
  const standard = withImage.filter(
    (p) => (p.foiling ?? "S") === "S" && (p.art_variations ?? []).length === 0,
  );
  return (standard.at(-1) ?? withImage.at(-1))?.image_url ?? null;
}
