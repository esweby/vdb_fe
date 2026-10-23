import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGameStats } from "../src/index.ts";

const csv = readFileSync(
  new URL("./fixtures/game-stats-2026-10-22T14-46-08.csv", import.meta.url),
  "utf8",
);

describe("Talishar stats export (22 Oct 2026)", () => {
  it("reads the hero, summary and durations without inferring a hero side or opponent", () => {
    expect(parseGameStats(csv)).toMatchObject({
      player: 1,
      hero: "Viserai The Forsaken",
      summary: {
        firstPlayer: true,
        result: "loss",
        turns: 6,
        yourTimeSeconds: 501,
        totalGameTimeSeconds: 862,
      },
      opponentStats: "unavailable",
    });
  });

  it("preserves statistics, including the signed self-loss total", () => {
    expect(parseGameStats(csv).statistics).toEqual({
      averageValuePerTurn: 10.67,
      averageDamageThreatenedPerTurn: 8.17,
      averageDamageDealtPerTurn: 4.5,
      averageDamageThreatenedPerCard: 3.5,
      averageResourcesUsedPerTurn: 1.17,
      averageCardsLeftOverPerTurn: 0.17,
      averageCombatValuePerTurn: 13.67,
      totalDamageThreatened: 49,
      totalDamageDealt: 27,
      totalDamageBlocked: 33,
      totalDamagePrevented: 0,
      totalLifeGained: 0,
      totalLifeSelfLost: -18,
    });
  });

  it("reads names and pitches separately and keeps unused cards", () => {
    const { cardPlays } = parseGameStats(csv);
    expect(cardPlays).toHaveLength(24);
    expect(cardPlays[4]).toEqual({
      name: "Cull",
      pitch: 1,
      played: 2,
      blocked: 1,
      pitched: 0,
      discarded: 0,
      timesHit: 0,
    });
    expect(cardPlays[1]).toEqual({
      name: "Arknight Shard",
      pitch: 3,
      played: 0,
      blocked: 0,
      pitched: 0,
      discarded: 0,
      timesHit: 0,
    });
    expect(
      cardPlays
        .filter((card) => card.name === "Murmuring Gloomblade")
        .map((card) => card.pitch),
    ).toEqual([3, 1, 2]);
    expect(cardPlays[12]?.name).toBe("Open the Gate to i'Arathael");
    expect(cardPlays[0]).not.toHaveProperty("copies");
  });

  it("reads activations independently of pitched card plays", () => {
    expect(parseGameStats(csv).cardActivations).toEqual([
      {
        name: "Gate to i'Arathael",
        activated: 1,
        passiveTriggers: 0,
        blocked: 0,
        timesHit: 0,
      },
      {
        name: "Reach of the Abyss",
        activated: 0,
        passiveTriggers: 0,
        blocked: 1,
        timesHit: 0,
      },
      {
        name: "Snapdragon Scalers",
        activated: 1,
        passiveTriggers: 0,
        blocked: 0,
        timesHit: 0,
      },
    ]);
  });

  it("reads every turn column and preserves negative value", () => {
    const { turns } = parseGameStats(csv);
    expect(turns).toHaveLength(6);
    expect(turns[0]?.totalValue).toBe(-2);
    expect(turns[2]).toEqual({
      turn: 3,
      cardsPlayed: 3,
      cardsBlocked: 3,
      cardsPitched: 1,
      cardsDiscarded: 0,
      cardsLeft: 0,
      resourcesUsed: 2,
      resourcesLeft: 1,
      damageThreatened: 10,
      damageDealt: 4,
      damageBlocked: 8,
      damagePrevented: 0,
      damageTaken: 4,
      lifeGained: 0,
      totalValue: 14,
    });
    expect(turns[5]?.damageDealt).toBe(10);
  });

  it("accepts a BOM, CRLF and an absent final newline", () => {
    expect(
      parseGameStats("\uFEFF" + csv.trimEnd().replaceAll("\n", "\r\n")),
    ).toEqual(parseGameStats(csv));
  });

  it("decodes CSV commas and escaped quotes in card names", () => {
    expect(
      parseGameStats(csv.replace('"Cull (1)"', '"Cull, the ""Example"" (1)"'))
        .cardPlays[4]?.name,
    ).toBe('Cull, the "Example"');
  });

  it("reads the other known first-player and result values", () => {
    expect(
      parseGameStats(
        csv
          .replace("First Player,Yes", "First Player,No")
          .replace("Result,Loser", "Result,Winner"),
      ).summary,
    ).toMatchObject({ firstPlayer: false, result: "win" });
  });

  it.each([
    ["unrelated CSV", "a,b\n1,2"],
    ["unknown column", csv.replace("Cards Played,", "Cards Used,")],
    ["unknown statistic", csv.replace("Total Life Self-Lost", "Self Damage")],
    ["missing statistic", csv.replace("Total Damage Dealt,27\n", "")],
    [
      "extra statistic",
      csv.replace("Total Damage Dealt,27", "Total Damage Dealt,27\nExtra,1"),
    ],
    [
      "duplicate statistic",
      csv.replace(
        "Total Damage Dealt,27",
        "Total Damage Dealt,27\nTotal Damage Dealt,27",
      ),
    ],
    ["unknown result", csv.replace("Result,Loser", "Result,Draw")],
    ["unknown boolean", csv.replace("First Player,Yes", "First Player,Maybe")],
    ["bad duration", csv.replace("Your Time,8:21", "Your Time,8:99")],
    ["missing pitch", csv.replace('"Cull (1)"', '"Cull"')],
    ["unknown pitch", csv.replace('"Cull (1)"', '"Cull (4)"')],
    [
      "empty numeric value",
      csv.replace("Total Damage Dealt,27", "Total Damage Dealt,"),
    ],
    [
      "numeric suffix",
      csv.replace("Total Damage Dealt,27", "Total Damage Dealt,27x"),
    ],
    [
      "non-finite number",
      csv.replace("Total Damage Dealt,27", "Total Damage Dealt,Infinity"),
    ],
    ["negative count", csv.replace('"Cull (1)",2', '"Cull (1)",-2')],
    ["fractional count", csv.replace('"Cull (1)",2', '"Cull (1)",1.5')],
    [
      "extra column",
      csv.replace('"Cull (1)",2,1,0,0,0', '"Cull (1)",2,1,0,0,0,1'),
    ],
    ["broken quoting", csv.replace('"Cull (1)"', '"Cull (1)')],
    ["text after quote", csv.replace('"Cull (1)"', '"Cull (1)"x')],
    ["missing turn", csv.replace("1,1,0,0,0,1,0,0,0,0,0,0,0,0,-2\n", "")],
    ["duplicate turn", csv.replace("2,3,1,0,0,0", "1,3,1,0,0,0")],
    [
      "unknown footer",
      csv.replace("Note: Opponent stats not available.", "Something else."),
    ],
    [
      "additional player layout",
      csv + "\n========== PLAYER 2 ==========\nHero: Example\n",
    ],
  ])("rejects %s rather than guessing", (_name, input) => {
    expect(() => parseGameStats(input)).toThrow(/Talishar/);
  });
});
