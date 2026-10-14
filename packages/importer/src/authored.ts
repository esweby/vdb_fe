// Hand-authored Viserai-specific attributes, keyed by card name.
// Everything here is unverified until a player has checked it; set verified: true only then.
// Card-level attributes apply to every pitch; `variants` overrides a specific pitch.
import type { AuthoredAttributes } from "./map.ts";

export const authored: AuthoredAttributes = {
  "Become the Shadow Lord": {
    verified: false,
    card: {
      canBanishFromHand: true,
      tokens: {
        runechant: { numCreated: 1, conditions: ["banish_runeblade_card"] },
        gate: { numCreated: 1, conditions: ["banish_shadow_card"] },
      },
      whileInBanish: { canPlay: false, conditions: [] },
    },
  },
};
