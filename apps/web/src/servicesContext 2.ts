// Kept apart from services.tsx so that file only exports a component (React Fast Refresh).
import { createContext, useContext } from "react";
import type { AuthService } from "./auth/authService.ts";
import type { CardRepository } from "./cards/cardRepository.ts";
import type { ScoreRepository } from "./scoring/scoreRepository.ts";

export interface Services {
  auth: AuthService;
  cards: CardRepository;
  scores: ScoreRepository;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services)
    throw new Error("useServices must be used inside ServicesProvider");
  return services;
}
