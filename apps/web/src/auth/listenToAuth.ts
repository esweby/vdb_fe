// Keeps the store in step with Supabase Auth: session changes, then the user's role.
import type { AppStore } from "../store.ts";
import type { AuthService } from "./authService.ts";
import { roleLoaded, sessionChanged } from "./authSlice.ts";

export function listenToAuth(store: AppStore, auth: AuthService): () => void {
  return auth.onSessionChange((user) => {
    store.dispatch(sessionChanged(user));
    if (user) {
      auth
        .getRole(user.id)
        .then((role) => store.dispatch(roleLoaded(role, user.id)))
        .catch(() => store.dispatch(roleLoaded("user", user.id)));
    }
  });
}

/** Resolves once auth has settled: signed out, or signed in with a role. */
export function authSettled(store: AppStore): Promise<void> {
  const settled = () => {
    const { status, role } = store.getState().auth;
    return status === "signedOut" || (status === "signedIn" && role !== null);
  };
  if (settled()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (settled()) {
        unsubscribe();
        resolve();
      }
    });
  });
}
