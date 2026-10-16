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

  // The caller's address, as the platform passes it on (the first entry is the client).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const since = () => new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const result = await signInWithUsername(
    await request.json().catch(() => null),
    {
      ip,
      recentFailures: async (username, from) => {
        const { count } = await admin
          .from("sign_in_failures")
          .select("id", { count: "exact", head: true })
          .eq("username", username.toLowerCase())
          .eq("ip", from)
          .gte("failed_at", since());
        return count ?? 0;
      },
      recordFailure: async (username, from) => {
        await admin
          .from("sign_in_failures")
          .insert({ username: username.toLowerCase(), ip: from });
        // Keep the table small: nothing older than a day matters.
        await admin
          .from("sign_in_failures")
          .delete()
          .lt("failed_at", new Date(Date.now() - 86_400_000).toISOString());
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
