// UNVERIFIED target order and funding strategy; the caller explicitly chooses whether to return.
import {
  effectiveCost,
  type RulesInstance,
  type RulesState,
  type Script,
  type Selector,
} from "@vdb/engine/rules";

export const TRAVERSE_TRIGGER = "viserai-usurper-traverse";

export function returnAlreadyEnabled(state: RulesState): boolean {
  return (
    (state.createdThisTurn.gate ?? 0) > 0 ||
    (state.activatedThisTurn.gate ?? 0) > 0
  );
}

const fits = (instance: RulesInstance, selector: Selector) =>
  (selector.name === undefined || instance.card.name === selector.name) &&
  (selector.pitch === undefined || instance.card.pitch === selector.pitch) &&
  (selector.type === undefined || instance.card.type === selector.type) &&
  (selector.trait === undefined ||
    instance.card.traits.includes(selector.trait));

export function selectTraverseBackPlan(
  state: RulesState,
  traverseBack: boolean | undefined,
  choices: Script["choices"],
): Script | undefined {
  if (
    traverseBack !== true ||
    state.side !== "usurper" ||
    state.phase !== "action" ||
    state.actionPoints < 1 ||
    (state.tokens.gate ?? 0) < 1 ||
    returnAlreadyEnabled(state)
  )
    return;
  const available = state.zones.hand
    .filter(
      (instance) =>
        !choices?.keep?.some((selector) => fits(instance, selector)) &&
        (instance.card.pitch ?? 0) > 0,
    )
    .sort((left, right) => right.card.pitch! - left.card.pitch!);
  for (const target of state.zones.banished) {
    const card = target.card;
    if (
      state.faceDown.includes(target.uid) ||
      !card.usurp ||
      card.effects === undefined ||
      card.type !== "attack_action" ||
      !card.traits.includes("blood_debt") ||
      !(card.playableFromBanish || state.playableThisTurn.includes(target.uid))
    )
      continue;
    const steps: Script["steps"] = [];
    let projected = state;
    for (const instance of available) {
      if (projected.resources >= 1 + effectiveCost(projected, target.uid))
        break;
      steps.push({
        do: "pitch",
        card: { name: instance.card.name, pitch: instance.card.pitch! },
      });
      projected = {
        ...projected,
        resources: projected.resources + instance.card.pitch!,
        tokens: {
          ...projected.tokens,
          runechant:
            (projected.tokens.runechant ?? 0) +
            (instance.card.name === "Arknight Shard" ? 1 : 0),
        },
      };
    }
    if (projected.resources < 1 + effectiveCost(projected, target.uid))
      continue;
    const selector: Selector = {
      name: card.name,
      pitch: card.pitch ?? undefined,
    };
    return {
      version: 1,
      choices,
      steps: [
        ...steps,
        { do: "activateGate", target: selector },
        { do: "play", from: "banished", card: selector },
      ],
    };
  }
}
