// Every way a card can be played from your banished zone.
import type { CardAttributes } from "./attributes.ts";

export type BanishPlayRoute = "own_text" | "gate" | "rune_gate";

export function banishPlayRoutes(
  attributes: CardAttributes,
): BanishPlayRoute[] {
  const routes: BanishPlayRoute[] = [];
  if (attributes.playableFromBanish) routes.push("own_text");
  if (attributes.isGateTarget) routes.push("gate");
  // Rune Gate: free from banish if you control at least as many Runechants as its cost.
  if (attributes.hasRuneGate) routes.push("rune_gate");
  return routes;
}
