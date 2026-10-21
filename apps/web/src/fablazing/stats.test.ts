import { describe, expect, it } from "vitest";
import {
  MIN_GAMES,
  cardEvidence,
  formatRate,
  formatWindow,
  matchupEvidence,
  playsPerViseraiGame,
  wilson,
} from "./stats.ts";
import type { CardStat, MatchupStat } from "./fablazingRepository.ts";

const stat = (over: Partial<CardStat> = {}): CardStat => ({
  format: 0,
  card: "view_card_red",
  variantId: "v-red",
  cardId: "c-1",
  startsOn: "2026-10-01",
  latest: "2026-10-30",
  decks: 60,
  copies: 170,
  resultDecks: 58,
  played: 98,
  pitched: 20,
  blocked: 8,
  hits: 31,
  wins: 29,
  baseDecks: 150,
  baseResultDecks: 145,
  baseWins: 65,
  ...over,
});

describe("wilson", () => {
  it("matches the textbook interval at 95%", () => {
    const { low, high } = wilson(34, 100);
    expect(low).toBeCloseTo(0.2547, 3);
    expect(high).toBeCloseTo(0.4372, 3);
  });

  it("stays within 0 and 1 at the edges", () => {
    expect(wilson(0, 50).low).toBe(0);
    expect(wilson(50, 50).high).toBeCloseTo(1, 10);
  });

  it("knows nothing without games", () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe("formatRate", () => {
  it("shows a rate with the interval's half-width", () => {
    expect(formatRate(34, 100)).toBe("34% (±9)");
  });
});

describe("cardEvidence", () => {
  it("works out the per-game numbers over the games that count", () => {
    const e = cardEvidence(stat());
    expect(e.games).toBe(58);
    expect(e.enough).toBe(true);
    expect(e.inclusion).toBeCloseTo(60 / 150);
    expect(e.averageCopies).toBeCloseTo(170 / 60);
    expect(e.playsPerGame).toBeCloseTo(98 / 58);
    expect(e.pitchesPerGame).toBeCloseTo(20 / 58);
    expect(e.blocksPerGame).toBeCloseTo(8 / 58);
    expect(e.hitsPerPlay).toBeCloseTo(31 / 98);
    expect(e.winRate).toEqual({ wins: 29, games: 58 });
    expect(e.baseline).toEqual({ wins: 65, games: 145 });
  });

  it(`needs ${MIN_GAMES} games`, () => {
    expect(cardEvidence(stat({ resultDecks: 49, wins: 20 })).enough).toBe(
      false,
    );
    expect(cardEvidence(stat({ resultDecks: 50, wins: 20 })).enough).toBe(true);
  });

  it("has no hits per play when the card was never played", () => {
    expect(cardEvidence(stat({ played: 0, hits: 0 })).hitsPerPlay).toBeNull();
  });
});

describe("matchupEvidence", () => {
  const m: MatchupStat = {
    format: 0,
    opponent: "view_hero",
    heroId: "h-1",
    startsOn: "2026-10-01",
    latest: "2026-10-30",
    games: 60,
    wins: 30,
    abandoned: 4,
    totalGames: 240,
  };

  it("works out the win rate and meta share", () => {
    const e = matchupEvidence(m);
    expect(e.enough).toBe(true);
    expect(e.winRate).toEqual({ wins: 30, games: 60 });
    expect(e.metaShare).toBeCloseTo(0.25);
  });

  it(`needs ${MIN_GAMES} games for a win rate`, () => {
    expect(matchupEvidence({ ...m, games: 49, wins: 10 }).enough).toBe(false);
  });
});

describe("playsPerViseraiGame", () => {
  it("adds every pitch of a card over all of Viserai's games", () => {
    const stats = [
      stat(),
      stat({ card: "view_card_blue", variantId: "v-blue", played: 47 }),
      stat({ card: "other_red", variantId: "v-o", cardId: "c-2", played: 5 }),
    ];
    const plays = playsPerViseraiGame(stats);
    expect(plays.get("c-1")).toBeCloseTo((98 + 47) / 145);
    expect(plays.get("c-2")).toBeCloseTo(5 / 145);
  });

  it("leaves out cards the map doesn't know", () => {
    expect(playsPerViseraiGame([stat({ cardId: null })]).size).toBe(0);
  });
});

describe("formatWindow", () => {
  it("names the days in the window", () => {
    expect(formatWindow("2026-10-01", "2026-10-30")).toBe("1–30 Oct 2026");
    expect(formatWindow("2026-09-25", "2026-10-21")).toBe(
      "25 Sep – 21 Oct 2026",
    );
  });
});
