// Sign in with a username (maintainer, 16 Oct 2026). Looks up the account's email with the
// service role, signs in with Supabase Auth, and returns the session; the email stays here.
// The platform JWT check is off (config.toml): people call this before they have a session.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { signInWithUsername } from "./signIn.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return Response.json(
      { error: "POST only" },
      { status: 405, headers: cors },
    );

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A separate client for the sign-in itself, so it never carries the service role.
  const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The address supplied by the gateway. The independent account budget still applies
  // if this header is missing or an attacker manages to vary it.
  const ip =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim()
      .slice(0, 64) || "unknown";

  const result = await signInWithUsername(
    await request.json().catch(() => null),
    {
      ip,
      reserveAttempt: async (username, from) => {
        const { data, error } = await admin.rpc("reserve_sign_in_attempt", {
          p_username: username,
          p_ip: from,
        });
        if (error || typeof data !== "boolean")
          throw new Error("Cannot reserve a sign-in attempt");
        return data;
      },
      findEmail: async (username) => {
        const { data } = await admin
          .from("profiles")
          .select("id")
          .ilike("username", username.replace(/[\\%_]/g, "\\$&"))
          .maybeSingle();
        if (!data) return null;
        const { data: user } = await admin.auth.admin.getUserById(data.id);
        return user.user?.email ?? null;
      },
      signIn: async (email, password) => {
        const { data, error } = await auth.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.session) return null;
        return {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        };
      },
    },
  );

  return result.ok
    ? Response.json(result.session, { headers: cors })
    : Response.json(
        { error: result.error },
        { status: result.status, headers: cors },
      );
});
