// Everything the app needs from Supabase Auth, behind an interface so tests can use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "user" | "scorer" | "curator" | "admin";

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface AuthService {
  /** Calls back now with the current session, then on every change. Returns an unsubscribe. */
  onSessionChange(callback: (user: SessionUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** Creates an account. Some projects need the email confirmed before the first sign-in. */
  signUp(
    email: string,
    password: string,
  ): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  getRole(userId: string): Promise<AppRole>;
}

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
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
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
  };
}
