// Talishar games uploaded onto a version (docs/test-loop.md, step 2): the stats CSV is
// parsed here, checked against the version's list, and stored with an optional note.
import { useEffect, useId, useState } from "react";
import { parseGameStats, type GameStats } from "@vdb/talishar";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { DeckVersion, VersionGame } from "./deckRepository.ts";
import { checkGame } from "./gameUpload.ts";
import styles from "./Decks.module.css";

interface Pending {
  stats: GameStats;
  fileName: string;
  missing: string[];
  fits: DeckVersion | null;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB");

function describeGame(stats: GameStats) {
  const { result, firstPlayer, turns } = stats.summary;
  return `${result === "win" ? "Won" : "Lost"} · went ${firstPlayer ? "first" : "second"} · ${turns} turns`;
}

export function VersionGames({
  version,
  versions,
  uploads,
  onUploaded,
}: {
  version: DeckVersion;
  /** Every version of the deck, to suggest one the game fits. */
  versions: DeckVersion[];
  /** Counts uploads onto any version, so each list reloads after one. */
  uploads: number;
  onUploaded: () => void;
}) {
  const { decks } = useServices();
  const headingId = useId();
  const [games, setGames] = useState<VersionGame[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    let live = true;
    decks.listGames(version.id).then(
      (rows) => {
        if (!live) return;
        setGames(rows);
        setLoaded(true);
      },
      () => live && setError("Couldn't load this version's games."),
    );
    return () => {
      live = false;
    };
  }, [decks, version.id, uploads]);

  async function choose(file: File | undefined) {
    setPending(null);
    setError(null);
    setDone(null);
    if (!file) return;
    let stats: GameStats;
    try {
      stats = parseGameStats(await file.text());
    } catch {
      setError(
        "That file isn't a Talishar stats export. Download it from the game's stats screen on Talishar.",
      );
      return;
    }
    setPending({
      stats,
      fileName: file.name,
      ...checkGame(stats.cardPlays, version, versions),
    });
  }

  async function upload(target: DeckVersion) {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await decks.addGame(target.id, {
        fileName: pending.fileName,
        note: note.trim() || null,
        stats: pending.stats,
      });
      onUploaded();
      setDone(
        target.id === version.id
          ? "Game uploaded."
          : `Uploaded to version ${target.number}.`,
      );
      setPending(null);
      setNote("");
      setFileKey((n) => n + 1);
    } catch {
      setError("Couldn't upload the game. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(game: VersionGame) {
    setError(null);
    try {
      await decks.deleteGame(game.id);
      setGames((rows) => rows.filter((row) => row.id !== game.id));
    } catch {
      setError("Couldn't delete the game. Try again.");
    }
  }

  return (
    <section
      className={styles.versionGames}
      aria-label={`Games on version ${version.number}`}
    >
      <h3 id={headingId}>Games</h3>
      {loaded && games.length === 0 && (
        <p className={styles.versionsEmpty}>No games uploaded yet.</p>
      )}
      {games.length > 0 && (
        <ul aria-labelledby={headingId}>
          {games.map((game) => (
            <li key={game.id}>
              {describeGame(game.stats)} · uploaded {when(game.uploadedAt)}
              {game.note && <> · {game.note}</>}{" "}
              <Button
                variant="ghost"
                aria-label={`Delete the game uploaded ${when(game.uploadedAt)}`}
                onClick={() => void remove(game)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.versionGameForm}>
        <div>
          <label htmlFor={`${headingId}-file`}>Talishar stats CSV</label>
          <input
            key={fileKey}
            id={`${headingId}-file`}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
        </div>
        <TextField
          label="Note"
          value={note}
          maxLength={500}
          hint="Optional. Anything you want to remember about the game."
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {pending && pending.missing.length === 0 && (
        <Button disabled={busy} onClick={() => void upload(version)}>
          {busy ? "Uploading…" : "Upload game"}
        </Button>
      )}
      {pending && pending.missing.length > 0 && (
        <div role="status">
          <p>
            Version {version.number} doesn't have: {pending.missing.join(", ")}.{" "}
            {pending.fits
              ? `Version ${pending.fits.number} has every card in this game.`
              : "No version has every card in this game."}
          </p>
          {pending.fits && (
            <Button disabled={busy} onClick={() => void upload(pending.fits!)}>
              Upload to version {pending.fits.number}
            </Button>
          )}{" "}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void upload(version)}
          >
            Upload to version {version.number} anyway
          </Button>
        </div>
      )}
      {done && <p role="status">{done}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
