// Who may run the community score job. No imports, so it's unit-testable outside Deno.
//
// The platform's automatic JWT check is turned off for this function (config.toml),
// because newer Supabase secret keys aren't JWTs. This check replaces it.

const SCORING_ROLES = new Set(["scorer", "curator", "admin"]);

export type JobAuthorization =
  { ok: true; caller: "server" | "user" } | { ok: false; status: 401 | 403 };

export async function authorizeJobCaller(input: {
  /** The request's Authorization header. */
  authorization: string | null;
  /** The project's server keys (service role / secret key). Empty values are ignored. */
  serverKeys: (string | undefined)[];
  /** Verifies a user token with Supabase Auth and returns their app role, or null. */
  getUserRole: (token: string) => Promise<string | null>;
}): Promise<JobAuthorization> {
  const token = input.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { ok: false, status: 401 };

  if (input.serverKeys.some((key) => key && key === token)) {
    return { ok: true, caller: "server" };
  }

  const role = await input.getUserRole(token);
  if (role === null) return { ok: false, status: 401 };
  return SCORING_ROLES.has(role)
    ? { ok: true, caller: "user" }
    : { ok: false, status: 403 };
}
