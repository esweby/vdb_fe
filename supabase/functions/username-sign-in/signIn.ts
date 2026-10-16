// Signing in with a username: the server finds the account's email and signs in with it, so
// emails never reach the browser. No imports, so it's unit-testable outside Deno.

const USERNAME = /^[A-Za-z0-9_-]{3,24}$/;

export interface Session {
  access_token: string;
  refresh_token: string;
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; status: 400 | 401 | 429; error: string };

/** Wrong passwords allowed per username and address within the window (see the migration). */
export const MAX_FAILURES = 5;

export async function signInWithUsername(
  body: unknown,
  deps: {
    /** The caller's address, for limiting guesses. */
    ip: string;
    /** Wrong passwords for this username (any case) from this address in the last 15 minutes. */
    recentFailures: (username: string, ip: string) => Promise<number>;
    recordFailure: (username: string, ip: string) => Promise<void>;
    /** The email of the account with this username (any case), or null. */
    findEmail: (username: string) => Promise<string | null>;
    /** Signs in with Supabase Auth; null when the password is wrong. */
    signIn: (email: string, password: string) => Promise<Session | null>;
  },
): Promise<SignInResult> {
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof username !== "string" ||
    !USERNAME.test(username) ||
    typeof password !== "string" ||
    password === ""
  )
    return {
      ok: false,
      status: 400,
      error: "Enter your username and password.",
    };

  // The same answer whether the username or the password is wrong.
  const wrong = {
    ok: false,
    status: 401,
    error: "Wrong username or password.",
  } as const;
  // Sign-ins all reach Supabase from this function, so its per-address limit can't tell
  // guessers apart: limit them here, per username and caller address.
  if ((await deps.recentFailures(username, deps.ip)) >= MAX_FAILURES)
    return {
      ok: false,
      status: 429,
      error: "Too many attempts. Wait 15 minutes, or sign in with your email.",
    };
  const email = await deps.findEmail(username);
  const session = email ? await deps.signIn(email, password) : null;
  if (session) return { ok: true, session };
  await deps.recordFailure(username, deps.ip);
  return wrong;
}
