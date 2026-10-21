import type {
  CardStat,
  FablazingRepository,
  FablazingWindow,
  MatchupStat,
} from "../fablazing/fablazingRepository.ts";

/** An in-memory FablazingRepository; empty by default, as before the first run. */
export function fakeFablazingRepository(
  data: {
    windows?: FablazingWindow[];
    cards?: CardStat[];
    matchups?: MatchupStat[];
  } = {},
): FablazingRepository {
  return {
    listWindows: async () => [...(data.windows ?? [])],
    listCardStats: async (format, cardId) =>
      (data.cards ?? []).filter(
        (s) => s.format === format && (!cardId || s.cardId === cardId),
      ),
    listMatchups: async (format) =>
      (data.matchups ?? []).filter((m) => m.format === format),
  };
}

export const WINDOW: FablazingWindow = {
  format: 0,
  startsOn: "2026-10-01",
  latest: "2026-10-30",
};

/** A card stat in Classic Constructed over WINDOW, with Viserai's baseline at 45% of 145 games. */
export const cardStat = (over: Partial<CardStat> = {}): CardStat => ({
  format: 0,
  card: "become_the_shadow_lord_blue",
  variantId: "bsl3",
  cardId: "card-become-the-shadow-lord",
  startsOn: WINDOW.startsOn,
  latest: WINDOW.latest,
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

export const matchupStat = (over: Partial<MatchupStat> = {}): MatchupStat => ({
  format: 0,
  opponent: "example_hero",
  heroId: "h1",
  startsOn: WINDOW.startsOn,
  latest: WINDOW.latest,
  games: 100,
  wins: 34,
  abandoned: 4,
  totalGames: 400,
  ...over,
});
