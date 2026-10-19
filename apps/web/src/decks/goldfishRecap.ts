// Turn recaps for the goldfish tool (README "Goldfishing": a short summary of each turn: cards
// played and pitched, weapon attacks, tokens created, damage dealt, and whether the side
// changed). Worked out from the rules engine's events (docs/rules-engine.md, step 8).
import type { HeroSide } from "@vdb/engine";
import type { RulesEvent } from "@vdb/engine/rules";

const TOKEN_NAMES: Record<string, [string, string]> = {
  runechant: ["Runechant", "Runechants"],
  gate: ["Gate", "Gates"],
  eloquence: ["Eloquence", "Eloquence"],
};

/** Weapons are the setup's w0, w1… copies. */
const isWeapon = (uid: string) => uid.startsWith("w");

/** One line per finished turn, e.g. "Turn 1: pitched X; made 2 Runechants; traversed to Usurper." */
export function turnRecaps(
  events: RulesEvent[],
  startSide: HeroSide,
  nameOf: (uid: string) => string,
): string[] {
  const recaps: string[] = [];
  let side = startSide;
  let turn = 1;
  let played: string[] = [];
  let pitched: string[] = [];
  let attacks: string[] = [];
  let made: Record<string, number> = {};
  let damage = 0;
  let sideAtStart = side;
  let traverses = 0;

  for (const e of events) {
    switch (e.type) {
      // A card put in the arena by hand counts as played; a played card is counted once.
      case "played":
        if (!played.includes(e.uid)) played.push(e.uid);
        break;
      case "moved":
        if (e.to === "arena" && !played.includes(e.uid)) played.push(e.uid);
        break;
      case "pitched":
        pitched.push(nameOf(e.uid));
        break;
      case "attackPlayed":
        if (isWeapon(e.uid)) attacks.push(nameOf(e.uid));
        break;
      case "attackNoted":
        attacks.push(nameOf(e.uid));
        break;
      case "tokensCreated":
        made[e.token] = (made[e.token] ?? 0) + e.amount;
        break;
      case "arcaneDamage":
      case "damageNoted":
        damage += e.amount;
        break;
      case "traversed":
        side = e.to;
        traverses++;
        break;
      case "turnEnded": {
        const parts: string[] = [];
        if (played.length)
          parts.push(`played ${played.map(nameOf).join(", ")}`);
        if (pitched.length) parts.push(`pitched ${pitched.join(", ")}`);
        if (attacks.length) parts.push(`attacked with ${attacks.join(", ")}`);
        for (const [token, n] of Object.entries(made)) {
          const [one, many] = TOKEN_NAMES[token] ?? [token, token];
          parts.push(`made ${n} ${n === 1 ? one : many}`);
        }
        if (damage > 0) parts.push(`dealt ${damage} damage`);
        if (traverses > 0)
          parts.push(
            side === sideAtStart
              ? "traversed and back"
              : `traversed to ${side === "usurper" ? "Usurper" : "Forsaken"}`,
          );
        recaps.push(
          `Turn ${turn}: ${parts.length ? parts.join("; ") : "nothing happened"}.`,
        );
        turn++;
        played = [];
        pitched = [];
        attacks = [];
        made = {};
        damage = 0;
        traverses = 0;
        sideAtStart = side;
        break;
      }
      default:
        break;
    }
  }
  return recaps;
}
