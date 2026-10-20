import { useEffect, useState, type FormEvent } from "react";
import { USERNAME_PATTERN } from "../auth/authService.ts";
import { Button, TextField } from "../ui/index.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import type { Preferences } from "../scoring/scoreRepository.ts";
import styles from "./AccountPage.module.css";

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
    await setPreference({ scoreSidesTogether: value });
  }

  async function setPreference(change: Partial<Preferences>) {
    if (!user || !preferences) return;
    const next = { ...preferences, ...change };
    setPreferences(next);
    try {
      await scores.savePreferences(user.id, next);
    } catch (e) {
      setPreferences(preferences);
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className={styles.page}>
      <h1>Account</h1>
      <section className={styles.panel} aria-label="Profile">
        <dl className={styles.details}>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Username</dt>
          <dd>
            {/* Set once, then fixed (the maintainer, 20 Oct 2026). */}
            {hadUsername || usernameSaved ? (
              <>
                <strong>{username}</strong>
                {usernameSaved && (
                  <span role="status" className={styles.note}>
                    {" "}
                    Username saved
                  </span>
                )}
                <p className={styles.note}>
                  You sign in with it, and it's shown on decks you share.
                  Usernames can't be changed.
                </p>
              </>
            ) : hadUsername === false ? (
              <form
                className={styles.usernameForm}
                onSubmit={(e) => void saveUsername(e)}
              >
                <TextField
                  label="Username"
                  hideLabel
                  autoComplete="username"
                  maxLength={24}
                  value={username}
                  error={usernameError}
                  hint="Choose a username: you'll be able to sign in with it instead of your email. Choose carefully: it can't be changed once it's set."
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(null);
                    setUsernameSaved(false);
                  }}
                />
                <Button type="submit">Save username</Button>
              </form>
            ) : (
              "…"
            )}
          </dd>
          <dt>Role</dt>
          <dd>{role ? ROLE_LABEL[role] : "…"}</dd>
        </dl>
      </section>
      {preferences && (
        <section className={styles.panel}>
          <h2>Preferences</h2>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={preferences.scoreSidesTogether ?? true}
              onChange={(e) => void setSidesTogether(e.target.checked)}
            />
            Score both sides together by default
          </label>
        </section>
      )}
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
    </div>
  );
}
