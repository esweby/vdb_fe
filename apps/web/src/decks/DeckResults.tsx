// The Results tab (docs/test-loop.md, step 2; the maintainer, 28 Oct 2026): Talishar stats
// CSVs parsed here and stored on the deck with an optional note, each tied to one of the
// deck's versions if the owner chooses one.
import { useEffect, useId, useState } from "react";
import { parseGameStats, type GameStats } from "@vdb/talishar";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { DeckGame, DeckVersion } from "./deckRepository.ts";
import { bestVersion, missingFrom, versionLabel } from "./gameUpload.ts";
import styles from "./Decks.module.css";

const NONE = "none";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB");

function describeGame(stats: GameStats) {
  const { result, firstPlayer, turns } = stats.summary;
  return `${result === "win" ? "Won" : "Lost"} · went ${firstPlayer ? "first" : "second"} · ${turns} turns`;
}

function VersionOptions({ versions }: { versions: DeckVersion[] }) {
  return (
    <>
      <option value={NONE}>No version</option>
      {versions.map((version) => (
        <option key={version.id} value={version.id}>
          {versionLabel(version)}
        </option>
      ))}
    </>
  );
}

export function DeckResults({ deckId }: { deckId: string }) {
  const { decks } = useServices();
  const [versions, setVersions] = useState<DeckVersion[]>([]);
  const [games, setGames] = useState<DeckGame[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([decks.listVersions(deckId), decks.listGames(deckId)]).then(
      ([versionRows, gameRows]) => {
        if (!live) return;
        setVersions(versionRows);
        setGames(gameRows);
        setLoaded(true);
      },
      () => live && setError("Couldn't load this deck's results."),
    );
    return () => {
      live = false;
    };
  }, [decks, deckId]);

  async function move(game: DeckGame, versionId: string | null) {
    setError(null);
    try {
      await decks.setGameVersion(game.id, versionId);
      setGames((rows) =>
        rows.map((row) => (row.id === game.id ? { ...row, versionId } : row)),
      );
    } catch {
      setError("Couldn't change the game's version. Try again.");
    }
  }

  async function remove(game: DeckGame) {
    setError(null);
    try {
      await decks.deleteGame(game.id);
      setGames((rows) => rows.filter((row) => row.id !== game.id));
    } catch {
      setError("Couldn't delete the game. Try again.");
    }
  }

  const won = games.filter((game) => game.stats.summary.result === "win");
  return (
    <section className={styles.results} aria-label="Results">
      <p>
        Upload the stats CSV from a game's stats screen on Talishar. Results are
        private to you.
      </p>
      <Upload
        deckId={deckId}
        versions={versions}
        onUploaded={(game) => setGames((rows) => [game, ...rows])}
      />
      <section aria-label="Games">
        <h3>Games</h3>
        {loaded && games.length === 0 && (
          <p className={styles.versionsEmpty}>No games uploaded yet.</p>
        )}
        {games.length > 0 && (
          <>
            <p>
              Won {won.length} of {games.length}.
            </p>
            <ul className={styles.resultsList}>
              {games.map((game) => (
                <li key={game.id}>
                  <span>
                    {describeGame(game.stats)} · uploaded{" "}
                    {when(game.uploadedAt)}
                    {game.note && <> · {game.note}</>}
                  </span>
                  <select
                    aria-label={`Version for the game uploaded ${when(game.uploadedAt)}`}
                    value={game.versionId ?? NONE}
                    onChange={(event) =>
                      void move(
                        game,
                        event.target.value === NONE ? null : event.target.value,
                      )
                    }
                  >
                    <VersionOptions versions={versions} />
                  </select>
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
          </>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function Upload({
  deckId,
  versions,
  onUploaded,
}: {
  deckId: string;
  versions: DeckVersion[];
  onUploaded: (game: DeckGame) => void;
}) {
  const { decks } = useServices();
  const id = useId();
  const [pending, setPending] = useState<{
    stats: GameStats;
    fileName: string;
  } | null>(null);
  const [versionId, setVersionId] = useState(NONE);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  async function choose(file: File | undefined) {
    setPending(null);
    setError(null);
    setDone(false);
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
    setPending({ stats, fileName: file.name });
    setVersionId(bestVersion(stats.cardPlays, versions)?.id ?? NONE);
  }

  async function upload() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const game = await decks.addGame(deckId, {
        versionId: versionId === NONE ? null : versionId,
        fileName: pending.fileName,
        note: note.trim() || null,
        stats: pending.stats,
      });
      onUploaded(game);
      setDone(true);
      setPending(null);
      setNote("");
      setFileKey((n) => n + 1);
    } catch {
      setError("Couldn't upload the game. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const chosen = versions.find((version) => version.id === versionId);
  const missing =
    pending && chosen ? missingFrom(pending.stats.cardPlays, chosen) : [];
  return (
    <section className={styles.resultsUpload} aria-label="Upload a game">
      <h3>Upload a game</h3>
      <div className={styles.versionGameForm}>
        <div>
          <label htmlFor={`${id}-file`}>Talishar stats CSV</label>
          <input
            key={fileKey}
            id={`${id}-file`}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
        </div>
        {pending && (
          <div>
            <label htmlFor={`${id}-version`}>Version</label>
            <select
              id={`${id}-version`}
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
            >
              <VersionOptions versions={versions} />
            </select>
          </div>
        )}
        <TextField
          label="Note"
          value={note}
          maxLength={500}
          hint="Optional. Anything you want to remember about the game."
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {pending && missing.length > 0 && chosen && (
        <p role="status">
          Version {chosen.number} doesn't have: {missing.join(", ")}. You can
          still upload it there.
        </p>
      )}
      {pending && (
        <Button disabled={busy} onClick={() => void upload()}>
          {busy ? "Uploading…" : "Upload game"}
        </Button>
      )}
      {done && <p role="status">Game uploaded.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
