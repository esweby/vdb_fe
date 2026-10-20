// Kept apart from services.tsx so that file only exports a component (React Fast Refresh).
import { createContext, useContext } from "react";
import type { AuthService } from "./auth/authService.ts";
import type { CardRepository } from "./cards/cardRepository.ts";
import type { DeckRepository } from "./decks/deckRepository.ts";
import type { ScoreRepository } from "./scoring/scoreRepository.ts";
import type { StrategyRepository } from "./strategy/strategyRepository.ts";
import type { ScenarioRepository } from "./scenarios/scenarioRepository.ts";
import type { SynergyRepository } from "./synergy/synergyRepository.ts";
import type { DraftReviewRepository } from "./rules/draftReviewRepository.ts";

export interface Services {
  auth: AuthService;
  cards: CardRepository;
  scores: ScoreRepository;
  decks: DeckRepository;
  strategy: StrategyRepository;
  synergy: SynergyRepository;
  scenarios: ScenarioRepository;
  draftReviews: DraftReviewRepository;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services)
    throw new Error("useServices must be used inside ServicesProvider");
  return services;
}
