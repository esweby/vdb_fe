// UNVERIFIED strategy: prioritise BSL setup and fund Descendancy from non-kept cards.
import {
  effectiveCost,
  type RulesInstance,
  type RulesState,
  type Script,
  type Selector,
} from "@vdb/engine/rules";

const descendancy = {
  name: "Arknight Descendancy",
  pitch: 3,
} satisfies Selector;
const bsl: Selector = { name: "Become the Shadow Lord", pitch: 3 };
const fits = (instance: RulesInstance, selector: Selector) =>
  (selector.name === undefined || instance.card.name === selector.name) &&
  (selector.pitch === undefined || instance.card.pitch === selector.pitch) &&
  (selector.type === undefined || instance.card.type === selector.type) &&
  (selector.trait === undefined ||
    instance.card.traits.includes(selector.trait));

export function selectDescendancyPlan(
  state: RulesState,
  startingLife: number | undefined,
  choices: Script["choices"],
  nebula: boolean,
):
  | { id: "descendancy-setup" | "funded-descendancy"; script: Script }
  | undefined {
  if (
    startingLife === undefined ||
    startingLife - state.lifeLost <= 17 ||
    state.phase !== "action" ||
    state.actionPoints < 1
  )
    return;
  const kept = (instance: RulesInstance) =>
    choices?.keep?.some((selector) => fits(instance, selector));
  const available = state.zones.hand.filter((instance) => !kept(instance));
  const target = state.zones.banished.find(
    (instance) =>
      fits(instance, descendancy) && !state.faceDown.includes(instance.uid),
  );
  const events = state.events.slice(
    state.events.findLastIndex((event) => event.type === "turnStarted") + 1,
  );
  const cards = Object.values(state.zones).flat();
  const firstBloodDebt = !events.some(
    (event) =>
      event.type === "attackPlayed" &&
      (!cards.find((instance) => instance.uid === event.uid) ||
        cards
          .find((instance) => instance.uid === event.uid)!
          .card.traits.includes("blood_debt")),
  );
  if (
    target &&
    state.side === "usurper" &&
    (state.tokens.gate ?? 0) >= 1 &&
    firstBloodDebt
  ) {
    const steps: Script["steps"] = [];
    let projected = state;
    for (const instance of [...available]
      .filter((instance) => (instance.card.pitch ?? 0) > 0)
      .sort((left, right) => right.card.pitch! - left.card.pitch!)) {
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
    if (projected.resources >= 1 + effectiveCost(projected, target.uid)) {
      steps.push(
        { do: "activateGate", target: descendancy },
        { do: "play", card: descendancy, from: "banished" },
      );
      if (nebula)
        steps.push({
          do: "attackWithWeapon",
          weapon: { name: "Seven Sin Nebula" },
        });
      return {
        id: "funded-descendancy",
        script: { version: 1, choices, steps },
      };
    }
  }
  if (
    available.some((instance) => fits(instance, descendancy)) &&
    available.some((instance) => fits(instance, bsl))
  ) {
    return {
      id: "descendancy-setup",
      script: {
        version: 1,
        choices: {
          ...choices,
          banish: [descendancy, ...(choices?.banish ?? [])],
          lifePayment: choices?.lifePayment ?? {
            card: descendancy,
            startingLife,
            minimumRemainingLife: 18,
          },
        },
        steps: [{ do: "play", card: bsl, from: "hand" }],
      },
    };
  }
}
