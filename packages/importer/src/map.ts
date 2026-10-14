// Maps dataset entries (one per name + pitch) to our cards and variants.
import { classifyTypes, isViseraiLegal, type DatasetCard } from "./classify.ts";

export type Attributes = Record<string, unknown>;

export interface AuthoredEntry {
  /** Has a player checked these attributes? */
  verified: boolean;
  card?: Attributes;
  /** Overrides for a specific pitch, merged over the card's attributes. */
  variants?: Partial<Record<number, Attributes>>;
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
  attributes: Attributes;
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
  attributes: Attributes;
  attributesVerified: boolean;
  variants: ImportVariant[];
}

/** Dataset stats are strings; "", "X", "*" and the like become null. */
export function parseStat(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function toTypeKey(mainType: string, subtypes: string[]): string {
  if (mainType === "Action" && subtypes.includes("Attack")) return "attack_action";
  return mainType.toLowerCase().replace(/[\s-]+/g, "_");
}

function generatedAttributes(keywords: string[]): Attributes {
  return {
    hasGoAgain: keywords.includes("Go again"),
    hasBloodDebt: keywords.includes("Blood Debt"),
  };
}

export function toImportCards(entries: DatasetCard[], authored: AuthoredAttributes): ImportCard[] {
  const groups = new Map<string, DatasetCard[]>();
  for (const entry of entries.filter(isViseraiLegal)) {
    groups.set(entry.name, [...(groups.get(entry.name) ?? []), entry]);
  }

  for (const name of Object.keys(authored)) {
    if (!groups.has(name)) throw new Error(`Authored attributes for "${name}", which isn't an imported card`);
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
      if (!variant) throw new Error(`Authored attributes for "${name}" pitch ${pitch}, which doesn't exist`);
      variant.attributes = { ...attributes };
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
      attributes: { ...generatedAttributes(keywords), ...entry?.card },
      attributesVerified: entry?.verified ?? false,
      variants,
    };
  });
}
