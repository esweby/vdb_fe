// Hero prompts in goldfish (README "Goldfishing: Hero prompts", phase two step 10): when a hero
// ability or token might trigger, the tool asks. Nothing happens unless the user says yes, and
// a yes is ordinary actions, logged and undoable. A rule set kept apart from the engine.
//
// UNVERIFIED: these rules are a first pass for the maintainer to check against the hero text.
// - Forsaken: creating a Runechant may banish the top card of your deck.
// - Forsaken: creating 3 or more Runechants in a turn traverses you to Usurper.
// - Usurper: having created a Gate this turn, you may traverse back at the end of the turn.
// - Runechants: when you play an attack (an attack action or a weapon attack), they're
//   destroyed and each deals 1 arcane damage.
import type { GameAction, GameState } from "@vdb/engine";

export interface Prompt {
  id: string;
  text: string;
  /**
   * What a yes does, worked out when it's answered: an earlier yes may have changed the
   * table (two banish prompts take two different top cards).
   */
  actions: (now: GameState) => GameAction[];
}

let next = 0;
const prompt = (
  text: string,
  actions: (now: GameState) => GameAction[],
): Prompt => ({
  id: `prompt-${++next}`,
  text,
  actions,
});

const created = (s: GameState, token: string) => s.createdThisTurn[token] ?? 0;

/** The prompts an action raises, given the state before and after it. */
export function promptsAfter(
  before: GameState,
  action: GameAction,
  after: GameState,
): Prompt[] {
  const out: Prompt[] = [];

  if (
    action.type === "token" &&
    action.token === "runechant" &&
    action.delta > 0 &&
    before.side === "forsaken"
  ) {
    if (after.zones.deck.length > 0)
      out.push(
        prompt(
          "You created a Runechant. Banish the top card of your deck?",
          (now) => {
            const top = now.zones.deck[0];
            return top ? [{ type: "move", uid: top.uid, to: "banished" }] : [];
          },
        ),
      );
    if (created(before, "runechant") < 3 && created(after, "runechant") >= 3)
      out.push(
        prompt("3 Runechants made this turn. Traverse to Usurper?", () => [
          { type: "traverse" },
        ]),
      );
  }

  if (
    action.type === "endTurn" &&
    before.side === "usurper" &&
    created(before, "gate") > 0
  )
    out.push(
      prompt("You created a Gate this turn. Traverse back to Forsaken?", () => [
        { type: "traverse" },
      ]),
    );

  const attacked =
    (action.type === "move" &&
      action.to === "arena" &&
      // Played from anywhere but the arena itself (hand, arsenal, banished…).
      Object.entries(before.zones).some(
        ([zone, cards]) =>
          zone !== "arena" &&
          cards.some(
            (c) => c.uid === action.uid && c.card.type === "attack_action",
          ),
      )) ||
    action.type === "attack";
  const runechants = before.tokens.runechant ?? 0;
  if (attacked && runechants > 0) {
    const n = runechants === 1 ? "1 Runechant" : `${runechants} Runechants`;
    out.push(
      prompt(
        `Attack played. Destroy ${n} and deal ${runechants} arcane damage?`,
        () => [
          { type: "token", token: "runechant", delta: -runechants },
          { type: "damage", delta: runechants },
        ],
      ),
    );
  }

  return out;
}
