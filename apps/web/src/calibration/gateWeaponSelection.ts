import {
  effectiveCost,
  runScriptFromState,
  type RulesInstance,
  type RulesState,
} from "@vdb/engine/rules";
import {
  GATE_WEAPON_EXAMPLES,
  descendancyComfortableAfterPayment,
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
  const descendancy = faceUpBanish.find(
    (instance) =>
      instance.card.name === "Arknight Descendancy" &&
      instance.card.pitch === 3,
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
        Number.isInteger(decisions.currentLife) &&
        descendancyComfortableAfterPayment(decisions.currentLife!, 0) &&
        (state.tokens.gate ?? 0) >= 1 &&
        (state.tokens.runechant ?? 0) >= 4 &&
        firstBloodDebtAttack &&
        !!descendancy &&
        state.resources >=
          1 +
            effectiveCost(state, descendancy.uid) +
            (state.zones.weapons[0]?.card.weaponAttack?.cost ?? Infinity)
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
    case "spare-shard-descendancy":
      return (
        Number.isInteger(decisions.currentLife) &&
        descendancyComfortableAfterPayment(decisions.currentLife!, 0) &&
        decisions.spareShard === true &&
        decisions.reserveBsl === true &&
        state.resources === 0 &&
        state.tokens.gate === 1 &&
        state.tokens.runechant === 4 &&
        firstBloodDebtAttack &&
        !!descendancy &&
        exactCards(hand, [
          ["Arknight Shard", 3],
          ["Become the Shadow Lord", 3],
        ])
      );
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
  allowedIds?: readonly string[],
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
    if (allowedIds && !allowedIds.includes(example.id)) return false;
    if (example.review !== "approved" || !matches(example.id, state, decisions))
      return false;
    const run = runScriptFromState(state, example.script);
    if (example.id === "spare-shard-descendancy") {
      const pitched = run.trace
        .slice(state.events.length)
        .filter((event) => event.type === "pitched");
      const spare = state.zones.hand.find(
        (instance) => instance.card.name === "Arknight Shard",
      )!;
      const keeper = state.zones.hand.find(
        (instance) => instance.card.name === "Become the Shadow Lord",
      )!;
      if (
        pitched.length !== 1 ||
        pitched[0]!.uid !== spare.uid ||
        run.state.zones.hand.length !== 1 ||
        run.state.zones.hand[0]!.uid !== keeper.uid ||
        run.state.lifeLost !== state.lifeLost
      )
        return false;
    }
    if (
      example.id === "descendancy-first" &&
      (run.state.zones.hand.length !== state.zones.hand.length ||
        run.state.zones.hand.some(
          (instance, index) => instance.uid !== state.zones.hand[index]!.uid,
        ) ||
        run.trace
          .slice(state.events.length)
          .some((event) => event.type === "pitched") ||
        run.state.lifeLost !== state.lifeLost)
    )
      return false;
    return (
      run.failure === undefined &&
      run.steps.length === example.script.steps.length &&
      run.steps.every((step) => step.outcome === "done") &&
      (example.id !== "own-usurp-traverse-back" ||
        run.state.side === "forsaken")
    );
  });
}
