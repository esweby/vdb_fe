import { useEffect, useId, useState } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { DeckVersion } from "./deckRepository.ts";
import type { DeckEntry } from "./deckRules.ts";
import {
  compareLists,
  entryCards,
  snapshotCards,
  type CardChange,
} from "./versionCompare.ts";
import styles from "./Decks.module.css";

export function DeckVersions({
  deckId,
  latest,
  entries,
}: {
  deckId: string;
  latest: DeckVersion | null;
  /** The deck as it is now, to compare a version with. */
  entries: DeckEntry[];
}) {
  const { decks } = useServices();
  const [versions, setVersions] = useState<DeckVersion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    decks.listVersions(deckId).then(
      (rows) => {
        if (!live) return;
        setVersions(rows);
        setLoaded(true);
      },
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
    <section className={styles.versions} aria-label="Versions">
      <p>
        Each opening in FaBrary saves a private copy of your list and loadouts.
      </p>
      {loaded && shown.length === 0 && (
        <p className={styles.versionsEmpty}>
          No versions yet. Open the deck in FaBrary to save the first one.
        </p>
      )}
      {failed && (
        <p role="alert">
          Couldn't load versions.{" "}
          <Button variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </p>
      )}
      {shown.length > 0 && <Compare versions={shown} entries={entries} />}
      {shown.map((version) => (
        <Version key={version.id} version={version} />
      ))}
    </section>
  );
}

const CURRENT = "current";
const KIND = (change: CardChange) =>
  change.from === 0 ? "Added" : change.to === 0 ? "Removed" : "Changed";

/** Two versions, or a version and the deck as it is now, newest first. */
function Compare({
  versions,
  entries,
}: {
  versions: DeckVersion[];
  entries: DeckEntry[];
}) {
  const id = useId();
  const [fromId, setFromId] = useState(versions[0]!.id);
  const [toId, setToId] = useState(CURRENT);
  const cardsOf = (key: string) => {
    if (key === CURRENT) return entryCards(entries);
    const version = versions.find((v) => v.id === key);
    return version ? snapshotCards(version.snapshot) : [];
  };
  const changes = compareLists(cardsOf(fromId), cardsOf(toId));
  const options = versions.map((version) => (
    <option key={version.id} value={version.id}>
      Version {version.number}
    </option>
  ));
  return (
    <section className={styles.versionCompare} aria-label="Compare">
      <div className={styles.versionCompareChoice}>
        <div>
          <label htmlFor={`${id}-from`}>Compare</label>
          <select
            id={`${id}-from`}
            value={fromId}
            onChange={(event) => setFromId(event.target.value)}
          >
            {options}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-to`}>With</label>
          <select
            id={`${id}-to`}
            value={toId}
            onChange={(event) => setToId(event.target.value)}
          >
            <option value={CURRENT}>Current deck</option>
            {options}
          </select>
        </div>
      </div>
      <div className={styles.versionCompareSides} aria-live="polite">
        <Changes title="Main deck" changes={changes.deck} />
        <Changes title="Sideboard" changes={changes.sideboard} />
      </div>
    </section>
  );
}

function Changes({ title, changes }: { title: string; changes: CardChange[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {changes.length === 0 ? (
        <p className={styles.versionsEmpty}>No changes.</p>
      ) : (
        <ul>
          {changes.map((change) => (
            <li key={change.variantId}>
              {KIND(change)}: {change.name} {change.from} → {change.to}
            </li>
          ))}
        </ul>
      )}
    </section>
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
