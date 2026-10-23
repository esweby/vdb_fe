import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createGameReport, parseGameStats } from "../src/index.ts";

const csv = readFileSync(
  new URL("./fixtures/game-stats-2026-10-22T14-46-08.csv", import.meta.url),
  "utf8",
);
const game = parseGameStats(csv);

describe("single-game report", () => {
  it("recovers the real game's self-loss timing and reconciles the signed total", () => {
    expect(createGameReport(game, { startingLife: 40 })).toMatchObject({
      startingLife: { value: 40, evidence: "Assumed" },
      selfLoss: {
        recorded: { value: -18, evidence: "Observed" },
        recovered: { value: -18, evidence: "Assumed" },
        difference: 0,
      },
      turns: [
        { turn: 1, selfLost: { value: -2 }, life: { value: 38 } },
        { turn: 2, selfLost: { value: -3 }, life: { value: 25 } },
        { turn: 3, selfLost: { value: -4 }, life: { value: 17 } },
        { turn: 4, selfLost: { value: -4 }, life: { value: 12 } },
        { turn: 5, selfLost: { value: -3 }, life: { value: 2 } },
        { turn: 6, selfLost: { value: -2 }, life: { value: 0 } },
      ],
    });
  });

  it("reports observed blocking, damage per turn and cumulative damage", () => {
    expect(createGameReport(game, { startingLife: 40 })).toMatchObject({
      turns: [
        {
          cardsBlocked: { value: 0, evidence: "Observed" },
          damageDealt: { value: 0 },
          damageDealtSoFar: { value: 0 },
        },
        {
          cardsBlocked: { value: 1 },
          damageDealt: { value: 5 },
          damageDealtSoFar: { value: 5 },
        },
        {
          cardsBlocked: { value: 3 },
          damageDealt: { value: 4 },
          damageDealtSoFar: { value: 9 },
        },
        {
          cardsBlocked: { value: 1 },
          damageDealt: { value: 7 },
          damageDealtSoFar: { value: 16 },
        },
        {
          cardsBlocked: { value: 0 },
          damageDealt: { value: 1 },
          damageDealtSoFar: { value: 17 },
        },
        {
          cardsBlocked: { value: 2 },
          damageDealt: { value: 10 },
          damageDealtSoFar: { value: 27 },
        },
      ],
    });
  });

  it("uses gross life lost, with self-loss once and healing excluded from the denominator", () => {
    const healed = structuredClone(game);
    healed.turns[1]!.lifeGained = 5;
    healed.turns[1]!.totalValue += 5;
    healed.statistics.totalLifeGained = 5;
    expect(createGameReport(healed, { startingLife: 40 })).toMatchObject({
      totalLifeLost: { value: 40, evidence: "Observed" },
      selfLossShare: { value: 0.45, evidence: "Observed" },
      turns: [{ life: { value: 38 } }, { life: { value: 30 } }, {}, {}, {}, {}],
    });
  });

  it("takes starting life explicitly, without clamping a calculated negative balance", () => {
    expect(createGameReport(game, { startingLife: 35 })).toMatchObject({
      turns: [{ life: { value: 33 } }, {}, {}, {}, {}, { life: { value: -5 } }],
    });
  });

  it("does not call recovered self-loss blood debt without separate evidence", () => {
    expect(createGameReport(game, { startingLife: 40 })).toMatchObject({
      turns: Array.from({ length: 6 }, () => ({
        bloodDebt: null,
        otherSelfLost: null,
      })),
    });
  });

  it("keeps the evidence and sources on every measure without changing the parsed record", () => {
    const original = structuredClone(game);
    const report = createGameReport(game, {
      startingLife: 40,
      startingLifeSource: "Confirmed by the maintainer on 23 Oct 2026",
    });
    expect(report.startingLife.source).toContain("Confirmed by the maintainer");
    for (const turn of report.turns) {
      expect(turn.life.evidence).toBe("Assumed");
      expect(turn.selfLost.evidence).toBe("Assumed");
      expect(turn.damageDealt.evidence).toBe("Observed");
      expect(turn.damageDealtSoFar.evidence).toBe("Observed");
      expect(turn.cardsBlocked.evidence).toBe("Observed");
      expect(turn.damageTaken.evidence).toBe("Observed");
      expect(turn.lifeGained.evidence).toBe("Observed");
      for (const value of Object.values(turn)) {
        if (value && typeof value === "object")
          expect(value.source.length).toBeGreaterThan(0);
      }
    }
    expect(game).toEqual(original);
  });

  it("checks a supplied blood-debt and other-loss breakdown against the recovered turn", () => {
    expect(
      createGameReport(game, {
        startingLife: 40,
        selfLossBreakdown: [
          {
            turn: 1,
            bloodDebt: {
              value: -1,
              evidence: "Assumed",
              source:
                "Example tracked debt trigger; synthetic, not this game's history",
            },
            otherSelfLost: {
              value: -1,
              evidence: "Observed",
              source: "Example logged life payment",
            },
          },
        ],
      }),
    ).toMatchObject({
      turns: [
        {
          bloodDebt: { value: -1, evidence: "Assumed" },
          otherSelfLost: { value: -1, evidence: "Observed" },
        },
        {},
        {},
        {},
        {},
        {},
      ],
    });
  });

  it("returns an undefined share when no life was lost", () => {
    const untouched = structuredClone(game);
    untouched.statistics.totalLifeSelfLost = 0;
    untouched.turns.forEach((turn) => {
      turn.damageTaken = 0;
      turn.totalValue =
        turn.damageThreatened +
        turn.damageBlocked +
        turn.damagePrevented +
        turn.lifeGained;
    });
    expect(createGameReport(untouched, { startingLife: 40 })).toMatchObject({
      selfLossShare: { value: null, evidence: "Observed" },
    });
  });

  it.each([0, -1, 40.5, NaN, Infinity])(
    "rejects invalid starting life %s",
    (startingLife) => {
      expect(() => createGameReport(game, { startingLife })).toThrow(
        /starting life/i,
      );
    },
  );

  it("rejects a value formula that does not reconcile instead of inventing timing", () => {
    const changed = structuredClone(game);
    changed.turns[0]!.totalValue++;
    expect(() => createGameReport(changed, { startingLife: 40 })).toThrow(
      /self-loss.*-17.*-18/i,
    );
  });

  it("rejects positive self-loss even when the aggregate reconciles", () => {
    const changed = structuredClone(game);
    changed.turns[0]!.totalValue = 1;
    changed.turns[1]!.totalValue -= 3;
    expect(() => createGameReport(changed, { startingLife: 40 })).toThrow(
      /turn 1.*self-loss/i,
    );
  });

  it.each([
    {
      turn: 1,
      bloodDebt: { value: -1, evidence: "Assumed", source: "Tracked state" },
      otherSelfLost: { value: 0, evidence: "Observed", source: "Log" },
    },
    {
      turn: 1,
      bloodDebt: { value: 1, evidence: "Assumed", source: "Tracked state" },
      otherSelfLost: { value: -3, evidence: "Observed", source: "Log" },
    },
    {
      turn: 7,
      bloodDebt: { value: -1, evidence: "Assumed", source: "Tracked state" },
      otherSelfLost: { value: -1, evidence: "Observed", source: "Log" },
    },
    {
      turn: 1,
      bloodDebt: { value: -1, evidence: "Assumed", source: "" },
      otherSelfLost: { value: -1, evidence: "Observed", source: "Log" },
    },
  ] as const)(
    "rejects inconsistent or unsupported breakdowns: %j",
    (breakdown) => {
      expect(() =>
        createGameReport(game, {
          startingLife: 40,
          selfLossBreakdown: [breakdown],
        }),
      ).toThrow(/breakdown/i);
    },
  );

  it("rejects duplicate breakdown rows", () => {
    const breakdown = {
      turn: 1,
      bloodDebt: {
        value: -2,
        evidence: "Assumed" as const,
        source: "Tracked state",
      },
      otherSelfLost: { value: 0, evidence: "Observed" as const, source: "Log" },
    };
    expect(() =>
      createGameReport(game, {
        startingLife: 40,
        selfLossBreakdown: [breakdown, breakdown],
      }),
    ).toThrow(/duplicate.*breakdown/i);
  });

  it("rejects fractional self-loss totals accepted as numbers by the parser", () => {
    const changed = parseGameStats(
      csv.replace("Total Life Self-Lost,-18", "Total Life Self-Lost,-18.5"),
    );
    expect(() => createGameReport(changed, { startingLife: 40 })).toThrow(
      /self-loss/i,
    );
  });
});
