import { useEffect, useState, type FormEvent } from "react";
import { USERNAME_PATTERN } from "../auth/authService.ts";
import { Button, TextField } from "../ui/index.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import type { Preferences } from "../scoring/scoreRepository.ts";

const ROLE_LABEL = {
  user: "User",
  scorer: "Scorer",
  curator: "Curator",
  admin: "Admin",
};

export function AccountPage() {
  const { scores, auth } = useServices();
  const { user, role } = useAppSelector((s) => s.auth);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);
  // Whether the account had a username when the page loaded (older accounts may not).
  const [hadUsername, setHadUsername] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    auth.getUsername(user.id).then(
      (name) => {
        if (!live) return;
        setUsername(name ?? "");
        setHadUsername(!!name);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [auth, user]);

  async function saveUsername(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = username.trim();
    setUsernameSaved(false);
    if (!USERNAME_PATTERN.test(name)) {
      setUsernameError("A username is 3 to 24 letters, numbers, _ or -.");
      return;
    }
    try {
      await auth.setUsername(user.id, name);
      setUsernameError(null);
      setUsernameSaved(true);
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (!user) return;
    let live = true;
    void scores.getPreferences(user.id).then((p) => live && setPreferences(p));
    return () => {
      live = false;
    };
  }, [scores, user]);

  async function setSidesTogether(value: boolean) {
    if (!user || !preferences) return;
    const next = { ...preferences, scoreSidesTogether: value };
    setPreferences(next);
    try {
      await scores.savePreferences(user.id, next);
    } catch (e) {
      setPreferences(preferences);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <h1>Account</h1>
      <dl>
        <dt>Email</dt>
        <dd>{user?.email}</dd>
        <dt>Role</dt>
        <dd>{role ? ROLE_LABEL[role] : "…"}</dd>
      </dl>
      <h2>Username</h2>
      {hadUsername === false && !usernameSaved && (
        <p role="note">
          Choose a username: you'll be able to sign in with it instead of your
          email.
        </p>
      )}
      <form onSubmit={(e) => void saveUsername(e)}>
        <TextField
          label="Username"
          autoComplete="username"
          maxLength={24}
          value={username}
          error={usernameError}
          hint="You sign in with it, and it's shown on decks you share."
          onChange={(e) => {
            setUsername(e.target.value);
            setUsernameError(null);
            setUsernameSaved(false);
          }}
        />
        <Button type="submit">Save username</Button>
        {usernameSaved && <p role="status">Username saved</p>}
      </form>
      <h2>Scoring</h2>
      {preferences && (
        <label>
          <input
            type="checkbox"
            checked={preferences.scoreSidesTogether ?? true}
            onChange={(e) => void setSidesTogether(e.target.checked)}
          />
          Score both sides together by default
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
