import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import { USERNAME_PATTERN, USERNAME_TAKEN } from "./authService.ts";
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
  // Sign-in takes a username (the main way) or an email.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitting = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setBusy(true);
    try {
      if (mode === "signIn") await auth.signIn(identifier.trim(), password);
      else {
        // Required, as it's how people sign in; checked before the account is made.
        const name = username.trim();
        if (!name) {
          setError("Choose a username: it's how you sign in.");
          return;
        }
        if (!USERNAME_PATTERN.test(name)) {
          setError("A username is 3 to 24 letters, numbers, _ or -.");
          return;
        }
        if (!(await auth.usernameAvailable(name))) {
          setError(USERNAME_TAKEN);
          return;
        }
        const { needsConfirmation } = await auth.signUp(email, password, name);
        if (needsConfirmation) {
          setConfirmSent(email);
          return;
        }
      }
      await navigate({ to: "/cards" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      submitting.current = false;
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
        {mode === "signIn" ? (
          <TextField
            label="Username or email"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        ) : (
          <>
            <TextField
              label="Username"
              autoComplete="username"
              maxLength={24}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              hint="You sign in with it, and it's shown on decks you share. 3 to 24 letters, numbers, _ or -."
            />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="For confirming your account and resetting your password. Not shown to anyone."
            />
          </>
        )}
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
        disabled={busy}
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
