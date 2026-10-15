// Strategy questions, asked once per person rather than per card, behind an interface so
// tests can use a fake. Each person's answers are their own; the scoring group's are averaged
// on the server and only the averages come back.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StrategyQuestion {
  key: string;
  prompt: string;
  lowLabel: string;
  highLabel: string;
}

export interface CommunityAnswer {
  average: number;
  /** People in the scoring group who answered. */
  answers: number;
}

export interface StrategyRepository {
  listQuestions(): Promise<StrategyQuestion[]>;
  listMyAnswers(userId: string): Promise<Record<string, number>>;
  setAnswer(userId: string, key: string, answer: number): Promise<void>;
  listCommunityAnswers(): Promise<Record<string, CommunityAnswer>>;
}

export function supabaseStrategyRepository(
  client: SupabaseClient,
): StrategyRepository {
  return {
    async listQuestions() {
      const { data, error } = await client
        .from("strategy_questions")
        .select("key, prompt, lowLabel:low_label, highLabel:high_label")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    async listMyAnswers(userId) {
      const { data, error } = await client
        .from("strategy_answers")
        .select("question_key, answer")
        .eq("user_id", userId);
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.question_key, r.answer]));
    },
    async setAnswer(userId, key, answer) {
      const { error } = await client.from("strategy_answers").upsert({
        user_id: userId,
        question_key: key,
        answer,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    async listCommunityAnswers() {
      const { data, error } = await client.rpc("strategy_community_answers");
      if (error) throw error;
      return Object.fromEntries(
        (
          data as { question_key: string; average: number; answers: number }[]
        ).map((r) => [
          r.question_key,
          { average: Number(r.average), answers: Number(r.answers) },
        ]),
      );
    },
  };
}
