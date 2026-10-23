import { useEffect, useState } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { DeckVersion } from "./deckRepository.ts";
import styles from "./Decks.module.css";

export function DeckVersions({
  deckId,
  latest,
}: {
  deckId: string;
  latest: DeckVersion | null;
}) {
  const { decks } = useServices();
  const [versions, setVersions] = useState<DeckVersion[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    decks.listVersions(deckId).then(
      (rows) => live && setVersions(rows),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [decks, deckId, latest, attempt]);
  const shown =
    latest && !versions.some((v) => v.id === latest.id)
      ? [latest, ...versions]
      : versions;
  return (
    <details className={styles.versions}>
      <summary>Versions ({shown.length})</summary>
      <p>
        Each opening in FaBrary saves a private copy of your list and loadouts.
      </p>
      {failed && (
        <p role="alert">
          Couldn't load versions.{" "}
          <Button variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </p>
      )}
      {shown.map((version) => (
        <Version key={version.id} version={version} />
      ))}
    </details>
  );
}

function Version({ version }: { version: DeckVersion }) {
  const { decks } = useServices();
  const [url, setUrl] = useState(version.fabraryUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save() {
    const next = url.trim();
    if (
      next &&
      !/^https:\/\/fabrary\.net\/decks\/[A-Za-z0-9_-]+\/?$/.test(next)
    ) {
      setError(
        "Use a FaBrary deck link: https://fabrary.net/decks/ followed by its id.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await decks.setVersionLink(version.id, next || null);
      setSaved(true);
    } catch {
      setError("Couldn't save the FaBrary link. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <details className={styles.version}>
      <summary>Version {version.number}</summary>
      <p>
        {version.snapshot.name} ·{" "}
        {new Date(version.createdAt).toLocaleString("en-GB")}
      </p>
      <ul>
        {version.snapshot.cards.map((card) => (
          <li key={`${card.variantId}-${card.sideboard}`}>
            {card.quantity} × {card.name}
            {card.pitch ? ` (${card.pitch})` : ""} ·{" "}
            {card.sideboard ? "Sideboard" : "Main deck"}
          </li>
        ))}
      </ul>
      <p>{version.snapshot.loadouts.length} saved loadouts</p>
      <form
        className={styles.versionLinkForm}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          label={`FaBrary link for version ${version.number}`}
          value={url}
          maxLength={500}
          hint="Optional. Paste the deck link after importing in FaBrary."
          error={error}
          onChange={(event) => {
            setUrl(event.target.value);
            setSaved(false);
          }}
        />
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save link"}
        </Button>
        {saved && <p role="status">Link saved.</p>}
      </form>
    </details>
  );
}
