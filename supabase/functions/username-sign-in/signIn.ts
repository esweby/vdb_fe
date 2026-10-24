// Signing in with a username: the server finds the account's email and signs in with it, so
// emails never reach the browser. No imports, so it's unit-testable outside Deno.

const USERNAME = /^[A-Za-z0-9_-]{3,24}$/;

export interface Session {
  access_token: string;
  refresh_token: string;
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; status: 400 | 401 | 429 | 503; error: string };

export async function signInWithUsername(
  body: unknown,
  deps: {
    /** The caller's address, for limiting guesses. */
    ip: string;
    /** Atomically reserves an account and address attempt before any password check. */
    reserveAttempt: (username: string, ip: string) => Promise<boolean>;
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
  // Reserve first so concurrent requests cannot pass the same count. A storage failure
  // must not turn off the limit. Successful sign-ins consume an attempt too.
  let allowed: boolean;
  try {
    allowed = await deps.reserveAttempt(username.toLowerCase(), deps.ip);
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Sign-in is temporarily unavailable. Try again shortly.",
    };
  }
  if (!allowed)
    return {
      ok: false,
      status: 429,
      error: "Too many attempts. Wait 15 minutes, or sign in with your email.",
    };
  const email = await deps.findEmail(username);
  const session = email ? await deps.signIn(email, password) : null;
  if (session) return { ok: true, session };
  return wrong;
}
