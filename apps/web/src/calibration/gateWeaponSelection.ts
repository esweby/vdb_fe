import {
  runScriptFromState,
  type RulesInstance,
  type RulesState,
} from "@vdb/engine/rules";
import {
  GATE_WEAPON_EXAMPLES,
  type GateWeaponExample,
} from "./gateWeaponExamples.ts";

export interface GateWeaponDecisions {
  currentLife?: number;
  traverseBack?: boolean;
  otherPlaysFinished?: boolean;
  reserveBsl?: boolean;
  spareShard?: boolean;
}

function exactCards(
  cards: RulesInstance[],
  wanted: readonly (readonly [string, number])[],
): boolean {
  return (
    cards.length === wanted.length &&
    wanted.every(([name, pitch]) =>
      cards.some(
        (instance) =>
          instance.card.name === name && instance.card.pitch === pitch,
      ),
    )
  );
}

function matches(
  id: string,
  state: RulesState,
  decisions: GateWeaponDecisions,
): boolean {
  const hand = state.zones.hand;
  const events = state.events.slice(
    state.events.findLastIndex((event) => event.type === "turnStarted") + 1,
  );
  const hasPlayedFromBanish = events.some(
    (event) => event.type === "playedFromBanish",
  );
  const cards = Object.values(state.zones).flat();
  const firstBloodDebtAttack = !events.some((event) => {
    if (event.type !== "attackPlayed") return false;
    const instance = cards.find((instance) => instance.uid === event.uid);
    return !instance || instance.card.traits.includes("blood_debt");
  });
  const faceUpBanish = state.zones.banished.filter(
    (instance) => !state.faceDown.includes(instance.uid),
  );
  const gatePosition = (resources: number, runechants: number) =>
    state.resources === resources &&
    state.tokens.gate === 1 &&
    state.tokens.runechant === runechants &&
    state.zones.banished.length === 1 &&
    firstBloodDebtAttack;

  switch (id) {
    case "descendancy-first":
      return (
        decisions.currentLife === 35 &&
        gatePosition(3, 4) &&
        exactCards(faceUpBanish, [["Arknight Descendancy", 3]]) &&
        exactCards(hand, [["Open the Gate to i'Arathael", 1]])
      );
    case "own-usurp-no-gate":
    case "own-usurp-traverse-back": {
      const traverseBack = id === "own-usurp-traverse-back";
      return (
        decisions.traverseBack === traverseBack &&
        gatePosition(traverseBack ? 3 : 2, 1) &&
        exactCards(faceUpBanish, [["Bloodfrenzy Gloomblade", 1]]) &&
        hand.length === 0
      );
    }
    case "spare-sword":
      return (
        decisions.otherPlaysFinished === true &&
        hasPlayedFromBanish &&
        state.resources === 1 &&
        (hand.length === 0 ||
          (decisions.reserveBsl === true &&
            exactCards(hand, [["Become the Shadow Lord", 3]])))
      );
    case "spare-shard-sword":
      return (
        decisions.otherPlaysFinished === true &&
        decisions.reserveBsl === true &&
        decisions.spareShard === true &&
        hasPlayedFromBanish &&
        state.resources === 0 &&
        exactCards(hand, [
          ["Arknight Shard", 3],
          ["Become the Shadow Lord", 3],
        ])
      );
    default:
      return false;
  }
}

export function selectGateWeaponExample(
  state: RulesState,
  decisions: GateWeaponDecisions = {},
): GateWeaponExample | undefined {
  if (
    state.side !== "usurper" ||
    state.phase !== "action" ||
    state.actionPoints !== 1 ||
    state.zones.arsenal.length !== 0
  )
    return undefined;

  const weapons = state.zones.weapons;
  if (
    weapons.length !== 1 ||
    weapons[0]!.card.name !== "Seven Sin Nebula" ||
    state.usedThisTurn.includes(weapons[0]!.uid)
  )
    return undefined;

  return GATE_WEAPON_EXAMPLES.find((example) => {
    if (example.review !== "approved" || !matches(example.id, state, decisions))
      return false;
    const run = runScriptFromState(state, example.script);
    return (
      run.failure === undefined &&
      run.steps.length === example.script.steps.length &&
      run.steps.every((step) => step.outcome === "done") &&
      (example.id !== "own-usurp-traverse-back" ||
        run.state.side === "forsaken")
    );
  });
}
