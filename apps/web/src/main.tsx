import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { listenToAuth } from "./auth/listenToAuth.ts";
import { supabaseAuthService } from "./auth/authService.ts";
import { supabaseCardRepository } from "./cards/cardRepository.ts";
import { supabase } from "./lib/supabase.ts";
import { createAppRouter } from "./router.tsx";
import { createStore } from "./store.ts";
import "./styles/global.css";

const auth = supabaseAuthService(supabase);
const cards = supabaseCardRepository(supabase);
const store = createStore({ cards });
listenToAuth(store, auth);
const router = createAppRouter({ store });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App store={store} services={{ auth, cards }} router={router} />
  </StrictMode>,
);
