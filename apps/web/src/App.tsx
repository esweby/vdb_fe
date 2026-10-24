import { RouterProvider } from "@tanstack/react-router";
import { Provider } from "react-redux";
import type { createAppRouter } from "./router.tsx";
import { ServicesProvider, type Services } from "./services.tsx";
import { CommunityRecalculationProvider } from "./scoring/CommunityRecalculationProvider.tsx";
import type { AppStore } from "./store.ts";

export function App(props: {
  store: AppStore;
  services: Services;
  router: ReturnType<typeof createAppRouter>;
}) {
  return (
    <Provider store={props.store}>
      <ServicesProvider services={props.services}>
        <CommunityRecalculationProvider>
          <RouterProvider router={props.router} />
        </CommunityRecalculationProvider>
      </ServicesProvider>
    </Provider>
  );
}
