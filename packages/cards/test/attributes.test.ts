import { describe, expect, it } from "vitest";
import { authoredAttributesSchema } from "../src/attributes.ts";

describe("authoredAttributesSchema", () => {
  it("accepts Become the Shadow Lord", () => {
    const result = authoredAttributesSchema.safeParse({
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      tokens: [
        { token: "runechant", amount: 1, trigger: "on_play", conditions: ["banished_card_is_runeblade"] },
        { token: "gate", amount: 1, trigger: "on_play", conditions: ["banished_card_is_shadow"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a variable amount", () => {
    expect(
      authoredAttributesSchema.safeParse({ tokens: [{ token: "runechant", amount: "X", trigger: "on_hit" }] }).success,
    ).toBe(true);
  });

  it.each([
    ["an unknown key", { canBanishFromHand: true }],
    ["an unknown token", { tokens: [{ token: "aura", amount: 1, trigger: "on_play" }] }],
    ["an unknown trigger", { tokens: [{ token: "runechant", amount: 1, trigger: "whenever" }] }],
    ["an unknown condition", { tokens: [{ token: "runechant", amount: 1, trigger: "on_play", conditions: ["maybe"] }] }],
    ["a zero amount", { tokens: [{ token: "runechant", amount: 0, trigger: "on_play" }] }],
    ["a fractional amount", { arcaneDamage: [{ amount: 1.5, trigger: "on_attack" }] }],
    ["an unknown banish zone", { banishesOwn: [{ from: "soul", trigger: "on_play" }] }],
    ["an unknown key inside an effect", { tokens: [{ token: "runechant", amount: 1, trigger: "on_play", extra: 1 }] }],
  ])("rejects %s", (_label, value) => {
    expect(authoredAttributesSchema.safeParse(value).success).toBe(false);
  });
});
