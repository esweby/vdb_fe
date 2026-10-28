import { parseScript } from "@vdb/engine/rules";

/**
 * The baseline script: each turn, play every card the rules allow (the scripted policy's order:
 * lowest pitch first), then end the turn. A policy, not the best play.
 */
export function baselineScript(turns: number) {
  return parseScript({
    version: 1,
    steps: [
      {
        do: "repeat",
        times: turns,
        steps: [
          { do: "repeat", times: 10, steps: [{ do: "play", card: {} }] },
          { do: "endTurn" },
        ],
      },
    ],
  });
}
