import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { listenToAuth } from "./auth/listenToAuth.ts";
import { supabaseAuthService } from "./auth/authService.ts";
import { supabaseCardRepository } from "./cards/cardRepository.ts";
import { supabaseScoreRepository } from "./scoring/scoreRepository.ts";
import { supabaseDeckRepository } from "./decks/deckRepository.ts";
import { supabaseStrategyRepository } from "./strategy/strategyRepository.ts";
import { supabaseSynergyRepository } from "./synergy/synergyRepository.ts";
import { supabaseScenarioRepository } from "./scenarios/scenarioRepository.ts";
import { supabaseDraftReviewRepository } from "./rules/draftReviewRepository.ts";
import { supabaseEngagementRepository } from "./analytics/engagementRepository.ts";
import { supabaseFablazingRepository } from "./fablazing/fablazingRepository.ts";
import { supabase } from "./lib/supabase.ts";
import { createAppRouter } from "./router.tsx";
import { createStore } from "./store.ts";
import "./styles/global.css";

const auth = supabaseAuthService(supabase);
const cards = supabaseCardRepository(supabase);
const scores = supabaseScoreRepository(supabase);
const decks = supabaseDeckRepository(supabase);
const strategy = supabaseStrategyRepository(supabase);
const synergy = supabaseSynergyRepository(supabase);
const scenarios = supabaseScenarioRepository(supabase);
const draftReviews = supabaseDraftReviewRepository(supabase);
const fablazing = supabaseFablazingRepository(supabase);
const engagement = supabaseEngagementRepository(supabase);
const store = createStore({ cards });
listenToAuth(store, auth);
const router = createAppRouter({ store });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App
      store={store}
      services={{
        auth,
        cards,
        scores,
        decks,
        strategy,
        synergy,
        scenarios,
        draftReviews,
        fablazing,
        engagement,
      }}
      router={router}
    />
  </StrictMode>,
);
