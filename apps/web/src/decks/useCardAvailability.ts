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
import { sectionOf, type DeckEntry } from "./deckRules.ts";

/**
 * A deck still being built is measured as a full one: the cards not chosen yet are blanks.
 *
 * UNVERIFIED: 60 cards is the usual Classic Constructed deck; for the maintainer to confirm.
 */
const FULL_DECK = 60;

export function useCardAvailability(entries: DeckEntry[]) {
  const drawn = entries.filter(
    (e) => !e.sideboard && sectionOf(e.card) === "deck",
  );
  const signature = JSON.stringify(
    drawn.map((e) => [e.variant.id, e.quantity]).sort(),
  );
  const { scenarios } = useMemo(
    () => availabilityScenarios(entries),
    // The signature covers what's drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const [run, setRun] = useState<{
    byCard: Map<string, CardAvailability>;
    signature: string;
  } | null>(null);
  const [running, setRunning] = useState(false);

  function start() {
    setRunning(true);
    const used = signature;
    runScenarioBatch({
      definitions: scenarios.map((s) => s.definition),
      core: drawn.map((e) => ({
        card: engineCardOf(e.card, e.variant),
        copies: e.quantity,
      })),
      gear: [],
      deckSize: Math.max(
        FULL_DECK,
        drawn.reduce((n, e) => n + e.quantity, 0),
      ),
      runs: RUNS,
      seed: 1,
    }).then(
      (outputs) => {
        setRun({
          byCard: availabilityByCard(scenarios, outputs),
          signature: used,
        });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }

  return {
    /** Null until worked out, and again once the deck has changed since. */
    byCard: run && run.signature === signature ? run.byCard : null,
    running,
    canRun: scenarios.length > 0,
    start,
  };
}
