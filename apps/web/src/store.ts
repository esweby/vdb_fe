import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "./auth/authSlice.ts";

export function createStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore["getState"]>;
