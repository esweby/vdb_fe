// Classifies the-fab-cube dataset types and decides Viserai legality.
// Card game rules here are a first pass and need checking by a player.

export interface DatasetCard {
  unique_id: string;
  name: string;
  pitch: string;
  cost: string;
  power: string;
  defense: string;
  types: string[];
  card_keywords: string[];
  functional_text_plain: string;
  /** Print runs; each has the official image. Missing in trimmed test fixtures. */
  printings?: DatasetPrinting[];
  type_text: string;
  cc_legal: boolean;
  cc_banned: boolean;
  cc_suspended?: boolean;
  /** Retired from Classic Constructed with its hero (e.g. Nebula Blade). */
  cc_living_legend?: boolean;
}

export interface ClassifiedTypes {
  mainType: string | null;
  classes: string[];
  talents: string[];
  subtypes: string[];
}

const CARD_TYPES = new Set([
  "Action",
  "Attack Reaction",
  "Defense Reaction",
  "Instant",
  "Equipment",
  "Weapon",
  "Hero",
  "Demi-Hero",
  "Token",
  "Resource",
  "Mentor",
  "Ally",
  "Block",
  "Macro",
  "Companion",
  "Event",
]);

const CLASSES = new Set([
  "Generic",
  "Adjudicator",
  "Assassin",
  "Bard",
  "Brute",
  "Guardian",
  "Illusionist",
  "Mechanologist",
  "Merchant",
  "Necromancer",
  "Ninja",
  "Pirate",
  "Ranger",
  "Runeblade",
  "Shapeshifter",
  "Thief",
  "Warrior",
  "Wizard",
]);

const TALENTS = new Set([
  "Chaos",
  "Draconic",
  "Earth",
  "Elemental",
  "Ice",
  "Light",
  "Lightning",
  "Mystic",
  "Revered",
  "Reviled",
  "Royal",
  "Shadow",
]);

// Viserai, the Forsaken / Usurper: Shadow Runeblade.
const VISERAI_CLASSES = new Set(["Runeblade", "Generic"]);
const VISERAI_TALENTS = new Set(["Shadow"]);
const NEVER_IN_DECK = new Set(["Hero", "Demi-Hero", "Token", "Macro"]);

export function classifyTypes(types: string[]): ClassifiedTypes {
  const result: ClassifiedTypes = {
    mainType: null,
    classes: [],
    talents: [],
    subtypes: [],
  };
  for (const type of types) {
    if (CARD_TYPES.has(type) && result.mainType === null)
      result.mainType = type;
    else if (CLASSES.has(type)) result.classes.push(type);
    else if (TALENTS.has(type)) result.talents.push(type);
    else result.subtypes.push(type);
  }
  return result;
}

/** Hero named in "<Hero> Specialization" on the card, or null. */
export function specializationOf(card: DatasetCard): string | null {
  return (
    /\b([A-Z][\w']+) Specialization\b/.exec(
      card.functional_text_plain ?? "",
    )?.[1] ?? null
  );
}

/** Playable in Classic Constructed: legal, and not banned, suspended or Living Legend. */
export function isCcPlayable(card: DatasetCard): boolean {
  return (
    card.cc_legal &&
    !card.cc_banned &&
    !card.cc_suspended &&
    !card.cc_living_legend
  );
}

export function isViseraiLegal(card: DatasetCard): boolean {
  return isCcPlayable(card) && fitsViserai(card);
}

/**
 * Cards a Viserai deck could hold that aren't playable in Classic Constructed (banned,
 * suspended or Living Legend). Once imported, they're hidden rather than deleted, so scores
 * and decks that mention them keep working.
 */
export function retiredNames(cards: DatasetCard[]): string[] {
  const playable = new Set(cards.filter(isViseraiLegal).map((c) => c.name));
  return [
    ...new Set(
      cards
        .filter((c) => fitsViserai(c) && !isCcPlayable(c))
        .map((c) => c.name)
        .filter((name) => !playable.has(name)),
    ),
  ].sort();
}

/** Viserai's class, talents and specialization, whatever the format's legality. */
function fitsViserai(card: DatasetCard): boolean {
  const specialization = specializationOf(card);
  if (specialization !== null && specialization !== "Viserai") return false;
  const { mainType, classes, talents } = classifyTypes(card.types);
  if (mainType === null || NEVER_IN_DECK.has(mainType)) return false;
  if (classes.length === 0 && talents.length === 0) return false;
  return (
    classes.every((c) => VISERAI_CLASSES.has(c)) &&
    talents.every((t) => VISERAI_TALENTS.has(t))
  );
}

export interface DatasetPrinting {
  set_id?: string;
  /** S standard, R rainbow foil, C cold foil, G gold foil */
  foiling?: string;
  /** e.g. "EA" extended art, "FA" full art; empty for normal art */
  art_variations?: string[];
  image_url?: string;
}
