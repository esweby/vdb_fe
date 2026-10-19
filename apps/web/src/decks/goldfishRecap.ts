// Turn recaps for the goldfish tool (README "Goldfishing": a short summary of each turn: cards
// played and pitched, weapon attacks, tokens created, damage dealt, and whether the side
// changed). Worked out from the action log alone.
import type { GameAction, HeroSide } from "@vdb/engine";

const TOKEN_NAMES: Record<string, [string, string]> = {
  runechant: ["Runechant", "Runechants"],
  gate: ["Gate", "Gates"],
  eloquence: ["Eloquence", "Eloquence"],
};

/** One line per finished turn, e.g. "Turn 1: pitched X; made 2 Runechants; traversed to Usurper." */
export function turnRecaps(
  log: GameAction[],
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

  for (const a of log) {
    switch (a.type) {
      case "move":
        if (a.to === "arena") played.push(nameOf(a.uid));
        break;
      case "pitch":
        pitched.push(nameOf(a.uid));
        break;
      case "attack":
        attacks.push(nameOf(a.uid));
        break;
      case "token":
        if (a.delta > 0) made[a.token] = (made[a.token] ?? 0) + a.delta;
        break;
      case "damage":
        damage += a.delta;
        break;
      case "traverse":
        side = side === "forsaken" ? "usurper" : "forsaken";
        traverses++;
        break;
      case "endTurn": {
        const parts: string[] = [];
        if (played.length) parts.push(`played ${played.join(", ")}`);
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
