import { describe, expect, it } from "vitest";
import { balance, engineOrder, inLane, partners, sortLane } from "./engines.ts";

describe("engineOrder", () => {
  it("puts the chosen side's engine first", () => {
    expect(engineOrder("both").map((e) => e.id)).toEqual([
      "runechant",
      "gate",
      "banish",
      "aura",
      "tempo",
      "usurp",
    ]);
    expect(engineOrder("usurper")[0]!.id).toBe("gate");
    expect(engineOrder("forsaken")[0]!.id).toBe("runechant");
  });
});

describe("inLane", () => {
  it("places a card by its generator or payoff roles in an engine", () => {
    expect(inLane(["gate_generator"], "gate", "generator")).toBe(true);
    expect(inLane(["gate_target"], "gate", "payoff")).toBe(true);
    expect(inLane(["gate_target"], "gate", "generator")).toBe(false);
  });

  it("leaves out roles that aren't linked", () => {
    expect(inLane(["runechant_trigger"], "runechant", "generator")).toBe(false);
    expect(inLane(["runechant_trigger"], "runechant", "payoff")).toBe(false);
  });
});

describe("partners", () => {
  const core = [
    {
      name: "Become the Shadow Lord",
      roles: ["gate_generator" as const],
      quantity: 3,
    },
    { name: "Breach Flesh", roles: ["gate_generator" as const], quantity: 2 },
    { name: "Arcanic Spike", roles: ["arcane_payoff" as const], quantity: 3 },
  ];

  it("names the cards in the core that a card fits with", () => {
    expect(partners("Hocus Pocus", ["gate_target"], core)).toEqual([
      "Become the Shadow Lord",
      "Breach Flesh",
    ]);
  });

  it("doesn't count the card itself (another pitch of it, say)", () => {
    expect(
      partners(
        "Breach Flesh",
        ["gate_generator", "gate_target"],
        [{ name: "Breach Flesh", roles: ["gate_target"], quantity: 3 }],
      ),
    ).toEqual([]);
  });
});

describe("balance", () => {
  it("counts copies of generators and payoffs in an engine", () => {
    const core = [
      { name: "A", roles: ["gate_generator" as const], quantity: 3 },
      { name: "B", roles: ["gate_target" as const], quantity: 2 },
      {
        name: "C",
        roles: ["gate_target" as const, "gate_generator" as const],
        quantity: 1,
      },
      { name: "D", roles: ["rune_gate" as const], quantity: 3 },
    ];
    expect(balance(core, "gate")).toEqual({ generators: 4, payoffs: 3 });
    // Rune Gate is recorded but not linked, so it weighs nothing.
    expect(balance(core, "runechant")).toEqual({ generators: 0, payoffs: 0 });
  });
});

describe("sortLane", () => {
  const cards = [
    { name: "A", value: 90, fits: 0 },
    { name: "B", value: 70, fits: 2 },
    { name: "C", value: 80, fits: 2 },
  ];
  it("orders by value, or by fits then value", () => {
    expect(sortLane(cards, "score").map((c) => c.name)).toEqual([
      "A",
      "C",
      "B",
    ]);
    expect(sortLane(cards, "fits").map((c) => c.name)).toEqual(["C", "B", "A"]);
  });
});
