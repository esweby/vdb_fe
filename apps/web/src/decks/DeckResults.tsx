// The Results tab (docs/test-loop.md, step 2; the maintainer, 28 Oct 2026): Talishar stats
// CSVs parsed here and stored on the deck with an optional note, each tied to one of the
// deck's versions if the owner chooses one. The record sits on top, the upload under it,
// then a table of the games.
import { useEffect, useId, useState } from "react";
import { parseGameStats, type GameStats } from "@vdb/talishar";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { DeckGame, DeckVersion } from "./deckRepository.ts";
import { bestVersion, missingFrom, versionLabel } from "./gameUpload.ts";
import styles from "./DeckResults.module.css";

const NONE = "none";

/** "28 Oct, 22:19". */
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const won = (stats: GameStats) => stats.summary.result === "win";

/** A signed number with a real minus sign: −18. */
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** "Went second · 6 turns": the result has its own badge. */
function describeGame(stats: GameStats) {
  const { firstPlayer, turns } = stats.summary;
  return `Went ${firstPlayer ? "first" : "second"} · ${turns} turns`;
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

function ResultBadge({ stats }: { stats: GameStats }) {
  return (
    <span className={won(stats) ? styles.win : styles.loss}>
      {won(stats) ? "Won" : "Lost"}
    </span>
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

  return (
    <div className={styles.results}>
      <Record games={games} />
      <Upload
        deckId={deckId}
        versions={versions}
        onUploaded={(game) => setGames((rows) => [game, ...rows])}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {loaded && games.length === 0 && (
        <p className={styles.empty}>
          No games uploaded yet. Your first upload starts the record.
        </p>
      )}
      {games.length > 0 && (
        <div className={styles.scroll}>
          <table className={styles.table} aria-label="Games">
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col">Went</th>
                <th scope="col" className={styles.number}>
                  Turns
                </th>
                <th scope="col" className={styles.number}>
                  Threatened
                </th>
                <th scope="col" className={styles.number}>
                  Dealt
                </th>
                <th scope="col" className={styles.number}>
                  Self-lost
                </th>
                <th scope="col">Note</th>
                <th scope="col">Version</th>
                <th scope="col">Uploaded</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td>
                    <ResultBadge stats={game.stats} />
                  </td>
                  <td>{game.stats.summary.firstPlayer ? "First" : "Second"}</td>
                  <td className={styles.number}>{game.stats.summary.turns}</td>
                  <td className={styles.number}>
                    {game.stats.statistics.totalDamageThreatened}
                  </td>
                  <td className={styles.number}>
                    {game.stats.statistics.totalDamageDealt}
                  </td>
                  <td className={styles.number}>
                    {signed(game.stats.statistics.totalLifeSelfLost)}
                  </td>
                  <td className={styles.note}>{game.note ?? ""}</td>
                  <td>
                    <select
                      className={styles.select}
                      aria-label={`Version for the game uploaded ${when(game.uploadedAt)}`}
                      value={game.versionId ?? NONE}
                      onChange={(event) =>
                        void move(
                          game,
                          event.target.value === NONE
                            ? null
                            : event.target.value,
                        )
                      }
                    >
                      <VersionOptions versions={versions} />
                    </select>
                  </td>
                  <td className={styles.muted}>{when(game.uploadedAt)}</td>
                  <td>
                    <Button
                      variant="ghost"
                      className={styles.delete}
                      aria-label={`Delete the game uploaded ${when(game.uploadedAt)}`}
                      onClick={() => void remove(game)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Played, won, win rate, and the split by who went first. */
function Record({ games }: { games: DeckGame[] }) {
  const wins = games.filter((game) => won(game.stats)).length;
  const split = (first: boolean) => {
    const these = games.filter(
      (game) => game.stats.summary.firstPlayer === first,
    );
    return these.length === 0
      ? "–"
      : `${these.filter((game) => won(game.stats)).length} of ${these.length}`;
  };
  const figures: [string, string][] = [
    ["Played", String(games.length)],
    ["Won", String(wins)],
    [
      "Win rate",
      games.length === 0 ? "–" : `${Math.round((100 * wins) / games.length)}%`,
    ],
    ["Going first", split(true)],
    ["Going second", split(false)],
  ];
  return (
    <section aria-label="Record">
      <dl className={styles.record}>
        {figures.map(([label, value]) => (
          <div key={label} className={styles.figure}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
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

  function reset() {
    setPending(null);
    setNote("");
    setFileKey((n) => n + 1);
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
      reset();
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
    <section className={styles.upload} aria-label="Upload a game">
      <div className={styles.uploadHead}>
        <h3>Upload a game</h3>
        <p className={styles.muted}>
          Download the stats CSV from the game's stats screen on Talishar.
          Results are private to you.
        </p>
      </div>
      <div className={styles.pick}>
        <input
          key={fileKey}
          id={`${id}-file`}
          className={styles.visuallyHidden}
          aria-label="Talishar stats CSV"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        <label htmlFor={`${id}-file`} className={styles.pickButton}>
          {pending ? "Choose another file" : "Choose a CSV"}
        </label>
        {pending ? (
          <div className={styles.picked}>
            <span className={styles.fileName}>{pending.fileName}</span>
            <span>
              <ResultBadge stats={pending.stats} />{" "}
              <span className={styles.muted}>
                {describeGame(pending.stats)}
              </span>
            </span>
          </div>
        ) : (
          <span className={styles.muted}>No file chosen</span>
        )}
      </div>
      {pending && (
        <>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor={`${id}-version`}>Version</label>
              <select
                id={`${id}-version`}
                className={styles.select}
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
              >
                <VersionOptions versions={versions} />
              </select>
            </div>
            <div className={styles.noteField}>
              <TextField
                label="Note"
                value={note}
                maxLength={500}
                placeholder="Optional. Anything you want to remember."
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          {missing.length > 0 && chosen && (
            <p role="status" className={styles.warning}>
              Version {chosen.number} doesn't have: {missing.join(", ")}. You
              can still upload it there.
            </p>
          )}
          <div className={styles.actions}>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void upload()}
            >
              {busy ? "Uploading…" : "Upload game"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={reset}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {done && (
        <p role="status" className={styles.done}>
          Game uploaded.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}
