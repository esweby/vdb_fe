// Maps dataset entries (one per name + pitch) to our cards and variants.
import { firstRelease, type Release } from "./releases.ts";
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
  isCcPlayable,
  retiredNames,
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
  /** When the card first came out; null without set data. */
  firstRelease: Release | null;
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

/**
 * Opt in a card's text, sentence by sentence: "Opt 3", "When this attacks, opt 1", "If this was
 * played from arsenal, opt 2", "Instant - Destroy this: Opt 2" (the maintainer, 20 Oct 2026).
 * Without a "When this …" or an activated ability, it happens as the card is played.
 */
export function optsFromText(
  text: string,
): NonNullable<AuthoredCardAttributes["opt"]> {
  const opts: NonNullable<AuthoredCardAttributes["opt"]> = [];
  // An activated ability ("Instant - Destroy this: Opt 2"): its Opt happens when activated.
  const activated = /^\s*(Instant|Action)\s*-[^:]*:/i.test(text);
  for (const sentence of text.split(".")) {
    const found = /\bopt (\d+)\b/i.exec(sentence);
    if (!found) continue;
    const trigger = activated
      ? "activated"
      : /when this attacks/i.test(sentence)
        ? "on_attack"
        : /when this hits/i.test(sentence)
          ? "on_hit"
          : /when this defends/i.test(sentence)
            ? "on_defend"
            : /when this is pitched/i.test(sentence)
              ? "on_pitch"
              : "on_play";
    opts.push({
      amount: Number(found[1]),
      trigger,
      ...(/played from (your )?arsenal/i.test(sentence)
        ? { fromArsenal: true }
        : {}),
    });
  }
  return opts;
}

/**
 * An activated ability in a card's text ("Instant - {r}, destroy this: …"), or undefined: its
 * speed, resource cost and how the card pays, and whether more is asked (discard a card, tap your
 * hero, counters). The maintainer asked for an activate action, 20 Oct 2026.
 */
export function activationFromText(
  text: string,
): AuthoredCardAttributes["activation"] {
  // Anywhere in the text ("Usurp Instant - Discard this: …"), but only a "Speed - cost:" ability.
  const found = /\b(Instant|Action)\s*-\s*([^:.]*):/.exec(text);
  if (!found) return undefined;
  const speed = found[1]!.toLowerCase() === "instant" ? "instant" : "action";
  const costText = found[2]!;
  const cost = (costText.match(/\{r\}/g) ?? []).length;
  const pay = /banish this from your hand/i.test(costText)
    ? "banish_from_hand"
    : /banish this/i.test(costText)
      ? "banish"
      : /discard this/i.test(costText)
        ? "discard"
        : /destroy this/i.test(costText)
          ? "destroy"
          : "none";
  // Anything left once the resources and the card's own payment are taken out.
  const rest = costText
    .replace(/\{r\}/g, "")
    .replace(
      /(banish this from your hand|banish this|discard this|destroy this)/i,
      "",
    )
    .replace(/[\s,]/g, "");
  return { speed, cost, pay, ...(rest ? { extraCost: true } : {}) };
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
  releases: Map<string, Release> = new Map(),
): ImportCard[] {
  const groups = new Map<string, DatasetCard[]>();
  for (const entry of entries.filter(isViseraiLegal)) {
    groups.set(entry.name, [...(groups.get(entry.name) ?? []), entry]);
  }

  // Retired cards (no longer playable) aren't imported, but keep their checked attributes.
  const retired = new Set(retiredNames(entries));
  for (const name of Object.keys(authored)) {
    if (!groups.has(name) && !retired.has(name))
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

    // Opt and activated abilities from each pitch's text, unless authored.
    for (const variant of variants) {
      const opt = optsFromText(variant.text ?? "");
      if (opt.length && !variant.attributes.opt)
        variant.attributes = { ...variant.attributes, opt };
      const activation =
        mainType === "Weapon"
          ? undefined
          : activationFromText(variant.text ?? "");
      if (activation && !variant.attributes.activation)
        variant.attributes = { ...variant.attributes, activation };
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
      firstRelease: firstRelease(
        group.flatMap((e) =>
          (e.printings ?? []).flatMap((p) => p.set_id ?? []),
        ),
        releases,
      ),
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

/** An opposing hero for matchups. */
export interface ImportHero {
  externalId: string;
  name: string;
  classes: string[];
  talents: string[];
  imageUrl: string | null;
}

/** Every adult hero playable in Classic Constructed (young heroes are for Blitz). */
export function toHeroes(dataset: DatasetCard[]): ImportHero[] {
  return dataset
    .filter(
      (c) =>
        c.types.includes("Hero") &&
        !c.types.includes("Young") &&
        isCcPlayable(c),
    )
    .map((c) => {
      const { classes, talents } = classifyTypes(c.types);
      return {
        externalId: c.unique_id,
        name: c.name,
        classes,
        talents,
        imageUrl: pickImageUrl(c.printings),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
