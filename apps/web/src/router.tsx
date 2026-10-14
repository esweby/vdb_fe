import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { authSettled } from "./auth/listenToAuth.ts";
import { selectCanScore, selectIsSignedIn } from "./auth/authSlice.ts";
import { SignInPage } from "./auth/SignInPage.tsx";
import { CardScoringPage } from "./scoring/CardScoringPage.tsx";
import { NeedsReviewPage } from "./scoring/NeedsReviewPage.tsx";
import { AccountPage } from "./account/AccountPage.tsx";
import { RankingPage } from "./ranking/RankingPage.tsx";
import { CardsPage } from "./cards/CardsPage.tsx";
import { Layout } from "./Layout.tsx";
import { validateListSearch } from "./filters/useUrlFilters.ts";
import { PlaceholderPage } from "./pages/PlaceholderPage.tsx";
import type { AppStore } from "./store.ts";

export interface RouterContext {
  store: AppStore;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
});

/** Signed-out visitors go to sign-in. */
async function requireSignedIn({ context }: { context: RouterContext }) {
  await authSettled(context.store);
  if (!selectIsSignedIn(context.store.getState())) {
    throw redirect({ to: "/sign-in" });
  }
}

/** Signed-in users without a scoring role go home. */
async function requireScorer(args: { context: RouterContext }) {
  await requireSignedIn(args);
  if (!selectCanScore(args.context.store.getState())) {
    throw redirect({ to: "/" });
  }
}

const page = (
  path: string,
  title: string,
  beforeLoad?: typeof requireSignedIn,
) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad,
    component: () => <PlaceholderPage title={title} />,
  });

const routeTree = rootRoute.addChildren([
  page("/", "Viserai Deck Builder"),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/cards",
    validateSearch: validateListSearch,
    component: CardsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/cards/$cardId",
    component: CardScoringPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/ranking",
    validateSearch: (search: Record<string, unknown>) => search,
    component: RankingPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/needs-review",
    validateSearch: validateListSearch,
    beforeLoad: requireScorer,
    component: NeedsReviewPage,
  }),
  page("/decks", "Decks", requireSignedIn),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/account",
    beforeLoad: requireSignedIn,
    component: AccountPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    component: SignInPage,
  }),
]);

export function createAppRouter(options: {
  store: AppStore;
  history?: RouterHistory;
}) {
  return createRouter({
    routeTree,
    context: { store: options.store },
    history: options.history,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
