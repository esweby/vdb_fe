import type {
  CommunityAnswer,
  StrategyQuestion,
  StrategyRepository,
} from "../strategy/strategyRepository.ts";

export const sampleQuestions: StrategyQuestion[] = [
  {
    key: "traverse_to_usurper",
    prompt: "How important is traversing to Usurper?",
    lowLabel: "Stay Forsaken",
    highLabel: "Get there fast",
  },
  {
    key: "flip_back_to_forsaken",
    prompt: "Once on Usurper, how keen are you to flip back to Forsaken?",
    lowLabel: "Stay Usurper",
    highLabel: "Flip back often",
  },
];

/** An in-memory StrategyRepository; `saved` records every answer. */
export function fakeStrategyRepository(
  options: {
    mine?: Record<string, number>;
    community?: Record<string, CommunityAnswer>;
    /** Answer as the only scorer: the average follows your own answers. */
    onlyScorer?: boolean;
  } = {},
) {
  const mine = { ...options.mine };
  const saved: string[] = [];
  const repository: StrategyRepository = {
    listQuestions: async () => sampleQuestions,
    listMyAnswers: async () => ({ ...mine }),
    async setAnswer(_userId, key, answer) {
      saved.push(`${key} ${answer}`);
      mine[key] = answer;
    },
    listCommunityAnswers: async () =>
      options.onlyScorer
        ? Object.fromEntries(
            Object.entries(mine).map(([k, n]) => [
              k,
              { average: n, answers: 1 },
            ]),
          )
        : { ...options.community },
  };
  return { repository, saved };
}
