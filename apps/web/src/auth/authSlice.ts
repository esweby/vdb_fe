import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppRole, SessionUser } from "./authService.ts";

export interface AuthState {
  status: "loading" | "signedIn" | "signedOut";
  user: SessionUser | null;
  /** Loaded after sign-in; null until then. */
  role: AppRole | null;
}

const initialState: AuthState = { status: "loading", user: null, role: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionChanged(state, action: PayloadAction<SessionUser | null>) {
      if (!action.payload)
        return { status: "signedOut", user: null, role: null };
      const sameUser = state.user?.id === action.payload.id;
      return {
        status: "signedIn",
        user: action.payload,
        role: sameUser ? state.role : null,
      };
    },
    roleLoaded: {
      reducer(
        state,
        action: PayloadAction<{ role: AppRole; userId?: string }>,
      ) {
        const { role, userId } = action.payload;
        if (userId && state.user?.id !== userId) return;
        state.role = role;
      },
      prepare(role: AppRole, userId?: string) {
        return { payload: { role, userId } };
      },
    },
  },
});

export const { sessionChanged, roleLoaded } = authSlice.actions;
export const authReducer = authSlice.reducer;

const SCORING_ROLES: AppRole[] = ["scorer", "curator", "admin"];
type WithAuth = { auth: AuthState };

export const selectAuth = (s: WithAuth) => s.auth;
export const selectIsSignedIn = (s: WithAuth) => s.auth.status === "signedIn";
export const selectRole = (s: WithAuth) => s.auth.role;
export const selectCanScore = (s: WithAuth) =>
  s.auth.role !== null && SCORING_ROLES.includes(s.auth.role);
