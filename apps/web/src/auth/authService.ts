// Everything the app needs from Supabase Auth, behind an interface so tests can use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "user" | "scorer" | "curator" | "admin";

/** A username's rules, the same as the database's: 3 to 24 letters, numbers, _ or -. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface AuthService {
  /** Calls back now with the current session, then on every change. Returns an unsubscribe. */
  onSessionChange(callback: (user: SessionUser | null) => void): () => void;
  /** Signs in with a username (the main way) or an email. */
  signIn(usernameOrEmail: string, password: string): Promise<void>;
  /** Creates an account. Some projects need the email confirmed before the first sign-in. */
  signUp(
    email: string,
    password: string,
    username?: string,
  ): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  getRole(userId: string): Promise<AppRole>;
  /** Whether a username is valid and nobody has it (in any case). */
  usernameAvailable(name: string): Promise<boolean>;
  getUsername(userId: string): Promise<string | null>;
  /** Sets the signed-in user's username; throws "That username is taken…" if it is. */
  setUsername(userId: string, name: string): Promise<void>;
}

export const USERNAME_TAKEN = "That username is taken. Try another.";

export function supabaseAuthService(client: SupabaseClient): AuthService {
  const toUser = (u: { id: string; email?: string } | null | undefined) =>
    u ? { id: u.id, email: u.email ?? null } : null;

  return {
    onSessionChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        callback(toUser(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },
    async signIn(usernameOrEmail, password) {
      if (usernameOrEmail.includes("@")) {
        const { error } = await client.auth.signInWithPassword({
          email: usernameOrEmail,
          password,
        });
        if (error) throw error;
        return;
      }
      // The username-sign-in function finds the email on the server and returns a session,
      // so emails never reach the browser.
      const { data, error } = await client.functions.invoke(
        "username-sign-in",
        {
          body: { username: usernameOrEmail, password },
        },
      );
      if (error) {
        const body = await (error as { context?: Response }).context
          ?.json()
          .catch(() => null);
        throw new Error(body?.error ?? "Couldn't sign in. Try again.");
      }
      const { error: sessionError } = await client.auth.setSession(data);
      if (sessionError) throw sessionError;
    },
    async signUp(email, password, username) {
      // The new-user trigger copies the username to the profile (if it's valid and free).
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: username ? { data: { username } } : undefined,
      });
      if (error) throw error;
      // No session yet means Supabase sent a confirmation email first.
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async getRole(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data.role as AppRole;
    },
    async usernameAvailable(name) {
      const { data, error } = await client.rpc("username_available", { name });
      if (error) throw error;
      return data === true;
    },
    async getUsername(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return (data.username as string | null) ?? null;
    },
    async setUsername(userId, name) {
      const { error } = await client
        .from("profiles")
        .update({ username: name })
        .eq("id", userId);
      if (error?.code === "23505") throw new Error(USERNAME_TAKEN);
      if (error) throw error;
    },
  };
}
