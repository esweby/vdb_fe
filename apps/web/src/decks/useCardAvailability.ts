// Runs the condition scenarios for the deck on demand and keeps each card's availability while
// the deck is unchanged (README "Deck builder").
import { useMemo, useState } from "react";
import { runScenarioBatch } from "../ranking/runScenarios.ts";
import { RUNS } from "../ranking/scenarioRuns.ts";
import { engineCardOf } from "../ranking/scenarios.ts";
import {
  availabilityByCard,
  type CardAvailability,
} from "./cardAvailability.ts";
import { availabilityScenarios } from "./conditionAvailability.ts";
import { type DeckEntry, type FormatRules } from "./deckRules.ts";
import { measuredDeck, type MeasuredDeck } from "./sideboardFill.ts";

export function useCardAvailability(
  entries: DeckEntry[],
  rules: FormatRules | null,
) {
  const measured = measuredDeck(entries, rules);
  const signature = JSON.stringify(
    measured.core.map((c) => [c.variant.id, c.copies]).sort(),
  );
  const { scenarios } = useMemo(
    () => availabilityScenarios(entries),
    // The signature covers what's drawn and the fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const [run, setRun] = useState<{
    byCard: Map<string, CardAvailability>;
    fill: Pick<MeasuredDeck, "filled" | "blanks">;
    signature: string;
  } | null>(null);
  const [running, setRunning] = useState(false);

  function start() {
    setRunning(true);
    const used = signature;
    const { filled, blanks } = measured;
    runScenarioBatch({
      definitions: scenarios.map((s) => s.definition),
      core: measured.core.map((c) => ({
        card: engineCardOf(c.card, c.variant),
        copies: c.copies,
      })),
      gear: [],
      deckSize: measured.deckSize,
      runs: RUNS,
      seed: 1,
    }).then(
      (outputs) => {
        setRun({
          byCard: availabilityByCard(scenarios, outputs),
          fill: { filled, blanks },
          signature: used,
        });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }

  const current = run && run.signature === signature ? run : null;
  return {
    /** Null until worked out, and again once the deck has changed since. */
    byCard: current?.byCard ?? null,
    /** How the deck was made up to 60 for the measurement, while it's current. */
    fill: current?.fill ?? null,
    running,
    canRun: scenarios.length > 0,
    start,
  };
}
