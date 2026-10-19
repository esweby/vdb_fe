// The explorer's colours. WebGL can't read CSS variables, so the graph and its legend share
// these fixed values.
import type { WeightedEdge } from "../ranking/synergyCore.ts";

export const ENGINE_COLOURS: Record<string, string> = {
  gate: "#7c3aed",
  banish: "#0f766e",
  runechant: "#c2410c",
  aura: "#2563eb",
  tempo: "#ca8a04",
  usurp: "#be185d",
  none: "#6b7280",
};
/**
 * Link colours by how sure we are (maintainer, 19 Oct 2026): suggestions pale, confirmed
 * dark, the scoring group's own orange, disputed grey.
 */
export const STATUS_COLOURS: Record<WeightedEdge["status"], string> = {
  suggested: "#c4b5fd",
  confirmed: "#5b21b6",
  community: "#f59e0b",
  disputed: "#9ca3af",
};

export const KIND_COLOURS: Record<WeightedEdge["kind"], string> = {
  rule: "#a78bfa",
  community: "#f59e0b",
  both: "#4c1d95",
};
