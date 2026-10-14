import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "./auth/authSlice.ts";
import type { CardRepository } from "./cards/cardRepository.ts";
import { cardsReducer } from "./cards/cardsSlice.ts";

export interface StoreDependencies {
  cards: CardRepository;
}

const notConfigured: CardRepository = {
  listCards: () => Promise.reject(new Error("Card repository not configured")),
};

export function createStore(deps: Partial<StoreDependencies> = {}) {
  return configureStore({
    reducer: { auth: authReducer, cards: cardsReducer },
    middleware: (getDefault) =>
      getDefault({
        thunk: { extraArgument: { cards: deps.cards ?? notConfigured } },
      }),
  });
}

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
