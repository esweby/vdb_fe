// FaBlazing game data (docs/fablazing-plan.md, step 3): sums over a rolling 30-day window, read
// from the fablazing_* views. Behind an interface so tests use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";

/** FaBlazing's format codes: 0 Classic Constructed, 1 Competitive CC. */
export type Format = 0 | 1;

export const FORMAT_LABELS: Record<Format, string> = {
  0: "Classic Constructed",
  1: "Competitive CC",
};

export interface FablazingWindow {
  format: Format;
  startsOn: string;
  /** The latest day with a succeeded run: how fresh the data is. */
  latest: string;
}

/** One FaBlazing card (one pitch of one of our cards) in Viserai's decks over the window. */
export interface CardStat {
  format: Format;
  card: string;
  variantId: string | null;
  cardId: string | null;
  startsOn: string;
  latest: string;
  /** Decks with the card, including abandoned games. */
  decks: number;
  copies: number;
  /** Decks with the card in games that count as results. */
  resultDecks: number;
  played: number;
  pitched: number;
  blocked: number;
  hits: number;
  wins: number;
  /** All of Viserai's detailed decks over the window. */
  baseDecks: number;
  baseResultDecks: number;
  baseWins: number;
}

/** Viserai against one opposing hero over the window. */
export interface MatchupStat {
  format: Format;
  /** FaBlazing's hero id. */
  opponent: string;
  heroId: string | null;
  startsOn: string;
  latest: string;
  games: number;
  wins: number;
  abandoned: number;
  /** Every Viserai result in the window, for meta share. */
  totalGames: number;
}

export interface FablazingRepository {
  listWindows(): Promise<FablazingWindow[]>;
  /** One card's pitches, or every card when cardId is left out. */
  listCardStats(format: Format, cardId?: string): Promise<CardStat[]>;
  listMatchups(format: Format): Promise<MatchupStat[]>;
}

const CARD_COLUMNS =
  "format, card, variantId:variant_id, cardId:card_id, startsOn:starts_on, latest, decks, copies, resultDecks:result_decks, played, pitched, blocked, hits, wins, baseDecks:base_decks, baseResultDecks:base_result_decks, baseWins:base_wins";
const MATCHUP_COLUMNS =
  "format, opponent, heroId:hero_id, startsOn:starts_on, latest, games, wins, abandoned, totalGames:total_games";

export function supabaseFablazingRepository(
  client: SupabaseClient,
): FablazingRepository {
  return {
    async listWindows() {
      const { data, error } = await client
        .from("fablazing_window")
        .select("format, startsOn:starts_on, latest")
        .order("format");
      if (error) throw error;
      return data as FablazingWindow[];
    },
    async listCardStats(format, cardId) {
      const rows: CardStat[] = [];
      // PostgREST returns at most 1,000 rows per request.
      for (let from = 0; ; from += 1000) {
        let query = client
          .from("fablazing_card_stats")
          .select(CARD_COLUMNS)
          .eq("format", format);
        if (cardId) query = query.eq("card_id", cardId);
        const { data, error } = await query
          .order("card")
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data as unknown as CardStat[]));
        if (data.length < 1000) return rows;
      }
    },
    async listMatchups(format) {
      const { data, error } = await client
        .from("fablazing_viserai_matchups")
        .select(MATCHUP_COLUMNS)
        .eq("format", format)
        .order("games", { ascending: false });
      if (error) throw error;
      return data as unknown as MatchupStat[];
    },
  };
}
