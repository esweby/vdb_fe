import {
  USERNAME_PATTERN,
  USERNAME_TAKEN,
  type AppRole,
  type AuthService,
  type SessionUser,
} from "../auth/authService.ts";

/** An in-memory AuthService for tests. */
export function fakeAuthService(
  options: {
    users?: Record<
      string,
      { password: string; role: AppRole; id: string; username?: string }
    >;
    signedIn?: SessionUser | null;
    /** Sign-up sends a confirmation email instead of signing in. */
    confirmEmail?: boolean;
    /** Usernames already taken (compared ignoring case). */
    takenUsernames?: string[];
  } = {},
) {
  const users = { ...options.users };
  let listener: ((user: SessionUser | null) => void) | null = null;
  let current = options.signedIn ?? null;
  const calls: string[] = [];
  const taken = options.takenUsernames ?? [];
  const usernames = new Map<string, string>();

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
    async signIn(usernameOrEmail, password) {
      calls.push(`signIn:${usernameOrEmail}`);
      const email = usernameOrEmail.includes("@")
        ? usernameOrEmail
        : Object.keys(users).find(
            (e) =>
              users[e]!.username?.toLowerCase() ===
              usernameOrEmail.toLowerCase(),
          );
      const user = email ? users[email] : undefined;
      if (!user || user.password !== password) {
        throw new Error("Invalid login credentials");
      }
      emit({ id: user.id, email: email ?? null });
    },
    async signUp(email, password, username) {
      calls.push(`signUp:${email}${username ? `:${username}` : ""}`);
      users[email] = { id: `id-${email}`, password, role: "user" };
      if (options.confirmEmail) return { needsConfirmation: true };
      emit({ id: `id-${email}`, email });
      return { needsConfirmation: false };
    },
    async signOut() {
      calls.push("signOut");
      emit(null);
    },
    async usernameAvailable(name) {
      return (
        USERNAME_PATTERN.test(name) &&
        !taken.some((t) => t.toLowerCase() === name.toLowerCase())
      );
    },
    async getUsername(userId) {
      return (
        usernames.get(userId) ??
        Object.values(users).find((u) => u.id === userId)?.username ??
        null
      );
    },
    async setUsername(userId, name) {
      if (taken.some((t) => t.toLowerCase() === name.toLowerCase()))
        throw new Error(USERNAME_TAKEN);
      calls.push(`setUsername:${name}`);
      usernames.set(userId, name);
    },
    async getRole(userId) {
      return Object.values(users).find((u) => u.id === userId)?.role ?? "user";
    },
  };
  return { service, calls, emit };
}
