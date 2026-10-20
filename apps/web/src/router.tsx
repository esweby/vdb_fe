import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { authSettled } from "./auth/listenToAuth.ts";
import {
  selectCanScore,
  selectIsSignedIn,
  selectRole,
} from "./auth/authSlice.ts";
import { SignInPage } from "./auth/SignInPage.tsx";
import { CardScoringPage } from "./scoring/CardScoringPage.tsx";
import { QuickReviewPage } from "./scoring/QuickReviewPage.tsx";
import { NeedsReviewPage } from "./scoring/NeedsReviewPage.tsx";
import { AccountPage } from "./account/AccountPage.tsx";
import { SharedScenarioPage } from "./scenarios/SharedScenarioPage.tsx";
import { HomePage } from "./home/HomePage.tsx";
import { RankingPage } from "./ranking/RankingPage.tsx";
import { CardsPage } from "./cards/CardsPage.tsx";
import { DeckPage } from "./decks/DeckPage.tsx";
import { DecksPage } from "./decks/DecksPage.tsx";
import { SynergyWeightsPage } from "./synergy/SynergyWeightsPage.tsx";
import { SynergyQueuePage } from "./synergy/SynergyQueuePage.tsx";
import { SynergyExplorerPage } from "./synergy/SynergyExplorerPage.tsx";
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

/** Anyone but an admin goes home. */
async function requireAdmin(args: { context: RouterContext }) {
  await requireSignedIn(args);
  if (selectRole(args.context.store.getState()) !== "admin") {
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
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HomePage,
  }),
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
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/needs-review/quick",
    beforeLoad: requireScorer,
    component: QuickReviewPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/needs-review/synergies",
    beforeLoad: requireScorer,
    component: SynergyQueuePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/synergies",
    // Read by readExplorerSearch; kept as given so the core stays an object.
    validateSearch: (search: Record<string, unknown>) => search,
    component: SynergyExplorerPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/decks",
    // Public decks can be browsed signed out; "My decks" needs signing in.
    validateSearch: (search: Record<string, unknown>): { tab?: "public" } =>
      search.tab === "public" ? { tab: "public" } : {},
    component: DecksPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/decks/$deckId",
    validateSearch: (
      search: Record<string, unknown>,
    ): {
      tab?:
        "stats" | "gaps" | "synergies" | "scenarios" | "matchups" | "goldfish";
      view?: "list";
      /** Goldfish: the shuffle to start from. */
      seed?: number;
      /** Goldfish: the starting side and a shared session's log. */
      side?: "usurper";
      log?: string;
      /** Goldfish: cards a scenario fixed in hand or arsenal (base64url JSON). */
      fixed?: string;
    } => ({
      ...(search.tab === "stats" ||
      search.tab === "gaps" ||
      search.tab === "synergies" ||
      search.tab === "scenarios" ||
      search.tab === "matchups" ||
      search.tab === "goldfish"
        ? {
            tab: search.tab as
              "stats" | "gaps" | "synergies" | "scenarios" | "goldfish",
          }
        : {}),
      ...(search.view === "list" ? { view: "list" as const } : {}),
      ...(Number.isInteger(Number(search.seed)) && search.seed !== ""
        ? { seed: Number(search.seed) }
        : {}),
      ...(search.side === "usurper" ? { side: "usurper" as const } : {}),
      ...(typeof search.fixed === "string" && search.fixed
        ? { fixed: search.fixed }
        : {}),
      ...(typeof search.log === "string" && search.log
        ? { log: search.log }
        : {}),
    }),
    // A public deck opens signed out, read only; a private one is "not found" to anyone else.
    component: DeckPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/scenarios/$scenarioId",
    // Shared by link: anyone can view it, signed out too.
    component: SharedScenarioPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin/synergy",
    beforeLoad: requireAdmin,
    component: SynergyWeightsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/account",
    beforeLoad: requireSignedIn,
    component: AccountPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    // ?mode=signup opens on Create an account (the home page's link for a first visit).
    validateSearch: (search: Record<string, unknown>): { mode?: "signup" } =>
      search.mode === "signup" ? { mode: "signup" } : {},
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
