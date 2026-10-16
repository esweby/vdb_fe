import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import styles from "./SignInPage.module.css";

const route = getRouteApi("/sign-in");

export function SignInPage() {
  const { auth } = useServices();
  const navigate = useNavigate();
  const search = route.useSearch();
  const [mode, setMode] = useState<"signIn" | "signUp">(
    search.mode === "signup" ? "signUp" : "signIn",
  );
  const [confirmSent, setConfirmSent] = useState<string | null>(null);
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
      else {
        const { needsConfirmation } = await auth.signUp(email, password);
        if (needsConfirmation) {
          setConfirmSent(email);
          return;
        }
      }
      await navigate({ to: "/cards" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1>{mode === "signIn" ? "Sign in" : "Create an account"}</h1>
      {mode === "signUp" && (
        <p className={styles.intro}>
          An account lets you score cards with the scoring group, and save and
          share your decks.
        </p>
      )}
      <form onSubmit={submit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {confirmSent && (
          <p role="status" className={styles.notice}>
            Check your email: we've sent a link to {confirmSent}. Open it to
            finish creating your account, then sign in.
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {mode === "signIn" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <Button
        variant="ghost"
        className={styles.switch}
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setConfirmSent(null);
          setError(null);
        }}
      >
        {mode === "signIn" ? "Create an account instead" : "Sign in instead"}
      </Button>
    </div>
  );
}
