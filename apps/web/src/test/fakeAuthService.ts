import type { AppRole, AuthService, SessionUser } from "../auth/authService.ts";

/** An in-memory AuthService for tests. */
export function fakeAuthService(
  options: {
    users?: Record<string, { password: string; role: AppRole; id: string }>;
    signedIn?: SessionUser | null;
  } = {},
) {
  const users = { ...options.users };
  let listener: ((user: SessionUser | null) => void) | null = null;
  let current = options.signedIn ?? null;
  const calls: string[] = [];

  const emit = (user: SessionUser | null) => {
    current = user;
    listener?.(user);
  };

  const service: AuthService = {
    onSessionChange(callback) {
      listener = callback;
      callback(current);
      return () => {
        listener = null;
      };
    },
    async signIn(email, password) {
      calls.push(`signIn:${email}`);
      const user = users[email];
      if (!user || user.password !== password) {
        throw new Error("Invalid login credentials");
      }
      emit({ id: user.id, email });
    },
    async signUp(email, password) {
      calls.push(`signUp:${email}`);
      users[email] = { id: `id-${email}`, password, role: "user" };
      emit({ id: `id-${email}`, email });
    },
    async signOut() {
      calls.push("signOut");
      emit(null);
    },
    async getRole(userId) {
      return Object.values(users).find((u) => u.id === userId)?.role ?? "user";
    },
  };
  return { service, calls, emit };
}
