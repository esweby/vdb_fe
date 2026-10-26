import {
  effectiveCost,
  type RulesInstance,
  type RulesState,
  type Script,
  type Selector,
} from "@vdb/engine/rules";

export const REVIEWED_DELAYED_HAND_IDS = [
  "keep-bsl-delayed-descendancy",
  "keep-gate-delayed-murmuring",
] as const;

const sameCards = (
  cards: readonly RulesInstance[],
  expected: readonly (readonly [string, number])[],
) =>
  JSON.stringify(cards.map(({ card }) => [card.name, card.pitch]).sort()) ===
  JSON.stringify([...expected].sort());

const fits = (instance: RulesInstance, selector: Selector) =>
  (selector.name === undefined || instance.card.name === selector.name) &&
  (selector.pitch === undefined || instance.card.pitch === selector.pitch) &&
  (selector.type === undefined || instance.card.type === selector.type) &&
  (selector.trait === undefined ||
    instance.card.traits.includes(selector.trait));

export function selectReviewedDelayedHand(
  state: RulesState,
  currentLife: number | undefined,
  choices: Script["choices"],
):
  | { id: (typeof REVIEWED_DELAYED_HAND_IDS)[number]; script: Script }
  | undefined {
  if (
    state.phase !== "action" ||
    state.actionPoints !== 1 ||
    state.resources !== 0 ||
    state.tokens.gate !== 1 ||
    Object.entries(state.tokens).some(
      ([token, amount]) =>
        token !== "gate" && token !== "runechant" && amount > 0,
    )
  )
    return;
  const hand = state.zones.hand;
  const pitchAvailable = (name: string, pitch: number) =>
    hand.some(
      (instance) =>
        instance.card.name === name &&
        instance.card.pitch === pitch &&
        !choices?.keep?.some((selector) => fits(instance, selector)),
    );
  const target = (name: string, pitch: number) =>
    state.zones.banished.find(
      (instance) =>
        instance.card.name === name &&
        instance.card.pitch === pitch &&
        instance.card.effects !== undefined &&
        !state.faceDown.includes(instance.uid),
    );
  const cards = Object.values(state.zones).flat();
  const turnEvents = state.events.slice(
    state.events.findLastIndex((event) => event.type === "turnStarted") + 1,
  );
  if (
    turnEvents.some((event) => {
      if (event.type !== "attackPlayed") return false;
      const card = cards.find((instance) => instance.uid === event.uid)?.card;
      return !card || card.traits.includes("blood_debt");
    })
  )
    return;

  const descendancy = target("Arknight Descendancy", 3);
  const demonbound = target("Demonbound Gloomblade", 3);
  if (
    currentLife === 38 &&
    state.side === "usurper" &&
    state.tokens.runechant === 5 &&
    sameCards(hand, [
      ["Sinspeaker Gloomblade", 1],
      ["Bloodfrenzy Gloomblade", 1],
      ["Become the Shadow Lord", 3],
      ["Demonbound Gloomblade", 1],
    ]) &&
    sameCards(state.zones.arena, [
      ["Malefic Incantation", 1],
      ["Malefic Incantation", 1],
    ]) &&
    state.zones.arena.every((instance) => state.counters[instance.uid] === 1) &&
    state.zones.weapons.some(
      (instance) =>
        instance.card.name === "Seven Sin Nebula" &&
        !state.usedThisTurn.includes(instance.uid),
    ) &&
    pitchAvailable("Sinspeaker Gloomblade", 1) &&
    descendancy &&
    demonbound?.card.playableFromBanish &&
    effectiveCost(state, descendancy.uid) === 0 &&
    effectiveCost(state, demonbound.uid) === 0
  )
    return {
      id: "keep-bsl-delayed-descendancy",
      script: {
        version: 1,
        choices: {
          ...choices,
          keep: [
            ...(choices?.keep ?? []),
            { name: "Become the Shadow Lord", pitch: 3 },
          ],
        },
        steps: [
          { do: "pitch", card: { name: "Sinspeaker Gloomblade", pitch: 1 } },
          {
            do: "activateGate",
            target: { name: "Arknight Descendancy", pitch: 3 },
          },
          {
            do: "play",
            from: "banished",
            card: { name: "Arknight Descendancy", pitch: 3 },
          },
          {
            do: "play",
            from: "banished",
            card: { name: "Demonbound Gloomblade", pitch: 3 },
          },
        ],
      },
    };

  const murmuring = target("Murmuring Gloomblade", 3);
  if (
    currentLife === 30 &&
    state.side === "forsaken" &&
    state.tokens.runechant === 1 &&
    (state.createdThisTurn.runechant ?? 0) === 0 &&
    state.zones.arena.length === 0 &&
    sameCards(hand, [
      ["Usurp the Shadow Throne", 3],
      ["Demonbound Gloomblade", 1],
      ["Murmuring Gloomblade", 2],
      ["Bloodfrenzy Gloomblade", 3],
    ]) &&
    pitchAvailable("Murmuring Gloomblade", 2) &&
    descendancy &&
    murmuring?.card.playableFromBanish &&
    effectiveCost(state, murmuring.uid) === 2 &&
    (choices?.lifePayment === undefined || choices.lifePayment === 0)
  )
    return {
      id: "keep-gate-delayed-murmuring",
      script: {
        version: 1,
        choices: {
          ...choices,
          keep: [
            ...(choices?.keep ?? []),
            { name: "Usurp the Shadow Throne", pitch: 3 },
            { name: "Bloodfrenzy Gloomblade", pitch: 3 },
          ],
        },
        steps: [
          { do: "pitch", card: { name: "Murmuring Gloomblade", pitch: 2 } },
          {
            do: "play",
            from: "banished",
            card: { name: "Murmuring Gloomblade", pitch: 3 },
          },
        ],
      },
    };
}
