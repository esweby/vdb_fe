// How a card is drawn in the explorer: a ring in its engine colour around a plain centre, the
// selected card filled in, and your core's cards with a thicker ring in the text colour.
import type { Engine } from "@vdb/cards";
import { ENGINE_COLOURS } from "./colours.ts";

export interface NodeStyle {
  /** The centre. */
  color: string;
  ringColor: string;
  /** The ring's share of the node's radius. */
  ringSize: number;
}

export function nodeStyle(
  node: { engine: Engine | null; inCore: boolean; selected: boolean },
  theme: { surface: string; fg: string },
): NodeStyle {
  const engine = ENGINE_COLOURS[node.engine ?? "none"]!;
  return {
    color: node.selected ? engine : theme.surface,
    ringColor: node.inCore ? theme.fg : engine,
    ringSize: node.inCore ? 0.45 : 0.3,
  };
}
