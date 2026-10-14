// Worked example used in docs/attribute-vocabulary.md. Unverified.
import type { AuthoredAttributes } from "../map.ts";

export const examples: AuthoredAttributes = {
  "Become the Shadow Lord": {
    verified: true,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_runeblade"],
        },
        {
          token: "gate",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_shadow"],
        },
      ],
    },
  },
};
