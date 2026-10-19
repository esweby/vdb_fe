// Hero prompts in goldfish (README "Goldfishing: Hero prompts", phase two step 10): when a hero
// ability or token might trigger, ask. Nothing happens unless the user says yes.
// UNVERIFIED: the rules are a first pass for the maintainer to check.
import {
  act,
  newGame,
  type EngineCard,
  type GameAction,
  type GameHistory,
} from "@vdb/engine";
import { describe, expect, it } from "vitest";
import { promptsAfter } from "./heroPrompts.ts";

const card = (name: string, type = "action"): EngineCard => ({
  id: name,
  name,
  pitch: 1,
  roles: [],
  traits: [],
  amounts: {},
  type,
});
const game = (side: "forsaken" | "usurper" = "forsaken") =>
  newGame({
    deck: [
      ...Array.from({ length: 6 }, (_, i) =>
        card(`Attack ${i}`, "attack_action"),
      ),
      ...Array.from({ length: 6 }, (_, i) => card(`Action ${i}`)),
    ],
    weapons: [card("Nebula Blade", "weapon")],
    seed: 1,
    side,
  });
/** The prompts after one more action. */
function after(h: GameHistory, action: GameAction) {
  const next = act(h, action);
  return { next, prompts: promptsAfter(h.present, action, next.present) };
}
const runechants = (n: number): GameAction => ({
  type: "token",
  token: "runechant",
  delta: n,
});

describe("promptsAfter", () => {
  it("on Forsaken, asks to banish the top card when a Runechant is created", () => {
    const h = game();
    const { prompts } = after(h, runechants(1));
    expect(prompts.map((p) => p.text)).toEqual([
      "You created a Runechant. Banish the top card of your deck?",
    ]);
    expect(prompts[0]!.actions(h.present)).toEqual([
      { type: "move", uid: h.present.zones.deck[0]!.uid, to: "banished" },
    ]);
  });

  it("doesn't ask on Usurper, or when Runechants are taken away", () => {
    expect(after(game("usurper"), runechants(1)).prompts).toEqual([]);
    const { next } = after(game(), runechants(2));
    expect(after(next, runechants(-1)).prompts).toEqual([]);
  });

  it("asks to traverse to Usurper once 3 Runechants are made in a turn", () => {
    const { next } = after(game(), runechants(2));
    const { prompts } = after(next, runechants(1));
    expect(prompts.map((p) => p.text)).toContain(
      "3 Runechants made this turn. Traverse to Usurper?",
    );
    expect(
      prompts
        .find((p) => p.text.startsWith("3 Runechants"))!
        .actions(next.present),
    ).toEqual([{ type: "traverse" }]);
    // Only when it crosses 3, not on every Runechant after.
    const third = after(next, runechants(1)).next;
    expect(
      after(third, runechants(1)).prompts.map((p) => p.text),
    ).not.toContain("3 Runechants made this turn. Traverse to Usurper?");
  });

  it("on Usurper, asks at the end of a turn with a Gate created to traverse back", () => {
    const { next } = after(game("usurper"), {
      type: "token",
      token: "gate",
      delta: 1,
    });
    const { prompts } = after(next, { type: "endTurn" });
    expect(prompts.map((p) => p.text)).toEqual([
      "You created a Gate this turn. Traverse back to Forsaken?",
    ]);
    expect(prompts[0]!.actions(next.present)).toEqual([{ type: "traverse" }]);
    expect(after(game("usurper"), { type: "endTurn" }).prompts).toEqual([]);
  });

  it("asks to destroy Runechants for arcane damage when an attack is played", () => {
    const { next } = after(game("usurper"), runechants(3));
    const attack = next.present.zones.hand.find(
      (c) => c.card.type === "attack_action",
    )!;
    const { prompts } = after(next, {
      type: "move",
      uid: attack.uid,
      to: "arena",
    });
    expect(prompts.map((p) => p.text)).toEqual([
      "Attack played. Destroy 3 Runechants and deal 3 arcane damage?",
    ]);
    expect(prompts[0]!.actions(next.present)).toEqual([
      { type: "token", token: "runechant", delta: -3 },
      { type: "damage", delta: 3 },
    ]);
  });

  it("asks the same for a weapon attack, and not for a non-attack or with no Runechants", () => {
    const { next } = after(game("usurper"), runechants(1));
    const weapon = next.present.zones.weapons[0]!;
    expect(
      after(next, { type: "attack", uid: weapon.uid }).prompts.map(
        (p) => p.text,
      ),
    ).toEqual(["Attack played. Destroy 1 Runechant and deal 1 arcane damage?"]);
    const action = next.present.zones.hand.find(
      (c) => c.card.type === "action",
    );
    if (action)
      expect(
        after(next, { type: "move", uid: action.uid, to: "arena" }).prompts,
      ).toEqual([]);
    expect(
      after(game("usurper"), {
        type: "attack",
        uid: game("usurper").present.zones.weapons[0]!.uid,
      }).prompts,
    ).toEqual([]);
  });
});
