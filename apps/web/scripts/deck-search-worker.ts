// Plays a share of one deck's goldfish games for deck-search.ts, off the main thread.
import { parentPort, workerData } from "node:worker_threads";
import {
  BLOOD_DEBT,
  RUNECHANT,
  VISERAI,
  type RulesCard,
} from "@esweby/fab-engine/rules";
import { playHoldingBack } from "../src/calibration/deckSearch.ts";

const { weapons, equipment } = workerData as {
  weapons: RulesCard[];
  equipment: RulesCard[];
};
const triggers = [...VISERAI, RUNECHANT, BLOOD_DEBT];

parentPort!.on(
  "message",
  (job: {
    id: number;
    deck: RulesCard[];
    seeds: number[];
    turns: number;
    holdBack: number;
  }) => {
    const games = job.seeds.map((seed) =>
      playHoldingBack(
        { deck: job.deck, weapons, equipment, side: "forsaken", triggers },
        seed,
        { turns: job.turns, holdBack: job.holdBack },
      ),
    );
    parentPort!.postMessage({ id: job.id, games });
  },
);
