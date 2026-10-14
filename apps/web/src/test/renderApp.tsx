import { createMemoryHistory } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { App } from "../App.tsx";
import type { AuthService } from "../auth/authService.ts";
import { listenToAuth } from "../auth/listenToAuth.ts";
import { createAppRouter } from "../router.tsx";
import { createStore } from "../store.ts";
import type { CardRepository } from "../cards/cardRepository.ts";
import { fakeCardRepository } from "./fakeCardRepository.ts";

/** Renders the whole app at a path, with a fake auth service. */
export async function renderApp(options: {
  path: string;
  auth: AuthService;
  cards?: CardRepository;
}) {
  const cards = options.cards ?? fakeCardRepository();
  const store = createStore({ cards });
  listenToAuth(store, options.auth);
  const router = createAppRouter({
    store,
    history: createMemoryHistory({ initialEntries: [options.path] }),
  });
  render(
    <App store={store} services={{ auth: options.auth, cards }} router={router} />,
  );
  await act(() => router.load());
  return { router, store };
}
