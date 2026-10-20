import { createMemoryHistory } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { App } from "../App.tsx";
import type { AuthService } from "../auth/authService.ts";
import { listenToAuth } from "../auth/listenToAuth.ts";
import { createAppRouter } from "../router.tsx";
import { createStore } from "../store.ts";
import type { CardRepository } from "../cards/cardRepository.ts";
import { fakeCardRepository } from "./fakeCardRepository.ts";
import type { ScoreRepository } from "../scoring/scoreRepository.ts";
import { fakeScoreRepository } from "./fakeScoreRepository.ts";
import type { DeckRepository } from "../decks/deckRepository.ts";
import { fakeDeckRepository } from "./fakeDeckRepository.ts";
import type { StrategyRepository } from "../strategy/strategyRepository.ts";
import { fakeStrategyRepository } from "./fakeStrategyRepository.ts";
import type { SynergyRepository } from "../synergy/synergyRepository.ts";
import { fakeSynergyRepository } from "./fakeSynergyRepository.ts";
import type { ScenarioRepository } from "../scenarios/scenarioRepository.ts";
import { fakeScenarioRepository } from "./fakeScenarioRepository.ts";
import type { DraftReviewRepository } from "../rules/draftReviewRepository.ts";
import { fakeDraftReviewRepository } from "./fakeDraftReviewRepository.ts";

/** Renders the whole app at a path, with a fake auth service. */
export async function renderApp(options: {
  path: string;
  auth: AuthService;
  cards?: CardRepository;
  scores?: ScoreRepository;
  decks?: DeckRepository;
  strategy?: StrategyRepository;
  synergy?: SynergyRepository;
  scenarios?: ScenarioRepository;
  draftReviews?: DraftReviewRepository;
}) {
  const scores = options.scores ?? fakeScoreRepository().repository;
  const cards = options.cards ?? fakeCardRepository();
  const decks = options.decks ?? fakeDeckRepository().repository;
  const strategy = options.strategy ?? fakeStrategyRepository().repository;
  const synergy = options.synergy ?? fakeSynergyRepository().repository;
  const scenarios = options.scenarios ?? fakeScenarioRepository().repository;
  const draftReviews =
    options.draftReviews ?? fakeDraftReviewRepository().repository;
  const store = createStore({ cards });
  listenToAuth(store, options.auth);
  const router = createAppRouter({
    store,
    history: createMemoryHistory({ initialEntries: [options.path] }),
  });
  render(
    <App
      store={store}
      services={{
        auth: options.auth,
        cards,
        scores,
        decks,
        strategy,
        synergy,
        scenarios,
        draftReviews,
      }}
      router={router}
    />,
  );
  await act(() => router.load());
  return { router, store };
}
