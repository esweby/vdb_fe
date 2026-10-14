import { useEffect, useState } from "react";
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
  const { scores } = useServices();
  const { user, role } = useAppSelector((s) => s.auth);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);

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
