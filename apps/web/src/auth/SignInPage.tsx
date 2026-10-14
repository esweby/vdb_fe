import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServices } from "../services.tsx";
import { Button, TextField } from "../ui/index.ts";
import styles from "./SignInPage.module.css";

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
    <div className={styles.page}>
      <h1>{mode === "signIn" ? "Sign in" : "Create an account"}</h1>
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
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? "Create an account instead" : "Sign in instead"}
      </Button>
    </div>
  );
}
