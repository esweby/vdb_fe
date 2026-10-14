import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServices } from "../services.tsx";

export function SignInPage() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signIn") await auth.signIn(email, password);
      else await auth.signUp(email, password);
      await navigate({ to: "/cards" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{mode === "signIn" ? "Sign in" : "Create an account"}</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "signIn" ? "current-password" : "new-password"
            }
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? "Create an account instead" : "Sign in instead"}
      </button>
    </>
  );
}
