// FaBlazing evidence in the app (docs/fablazing-plan.md, step 3): what happened in real games,
// kept apart from the scoring group's opinions. Every number needs MIN_GAMES games and carries a
// Wilson interval and its matchup context; the words describe associations, never causes.
import { useEffect, useState } from "react";
import type { Hero } from "../decks/deckRepository.ts";
import { useServices } from "../servicesContext.ts";
import { Button, LoadError, Loading } from "../ui/index.ts";
import {
  FORMAT_LABELS,
  type CardStat,
  type FablazingWindow,
  type Format,
  type MatchupStat,
} from "./fablazingRepository.ts";
import {
  cardEvidence,
  formatDay,
  formatInterval,
  formatRate,
  formatWindow,
  heroFromSlug,
  matchupEvidence,
} from "./stats.ts";
import styles from "./RealGames.module.css";

const percent = (x: number) => `${Math.round(x * 100)}%`;
const notEnough = (n: number) => `Not enough games yet (n = ${n})`;

/** The window for each format, or null while loading; failed is true if it couldn't load. */
export function useFablazingWindows() {
  const { fablazing } = useServices();
  const [windows, setWindows] = useState<FablazingWindow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    fablazing.listWindows().then(
      (rows) => live && setWindows(rows),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [fablazing, attempt]);
  return { windows, failed, retry: () => setAttempt((n) => n + 1) };
}

/** Where the numbers come from and how fresh they are. */
export function FreshnessNote(props: { window: FablazingWindow }) {
  const { startsOn, latest } = props.window;
  return (
    <p className={styles.note}>
      {`From FaBlazing's public Talishar games, ${formatWindow(startsOn, latest)} (latest day ${formatDay(latest)}).`}
    </p>
  );
}

function FormatSwitch(props: {
  formats: Format[];
  value: Format;
  onChange: (f: Format) => void;
}) {
  if (props.formats.length < 2) return null;
  return (
    <div className={styles.formats} role="group" aria-label="Format">
      {props.formats.map((f) => (
        <Button
          key={f}
          variant={f === props.value ? "secondary" : "ghost"}
          aria-pressed={f === props.value}
          onClick={() => props.onChange(f)}
        >
          {FORMAT_LABELS[f]}
        </Button>
      ))}
    </div>
  );
}

/**
 * The shared frame: heading, format switch, and the states before there's data. children gets
 * the chosen format's window.
 */
function Evidence(props: {
  label: string;
  heading: "h2" | "h3";
  intro?: string;
  children: (window: FablazingWindow) => React.ReactNode;
}) {
  const { windows, failed, retry } = useFablazingWindows();
  const [format, setFormat] = useState<Format>(0);
  const Heading = props.heading;
  const window =
    windows?.find((w) => w.format === format) ?? windows?.[0] ?? null;
  return (
    <section aria-label={props.label} className={styles.panel}>
      <div className={styles.head}>
        <Heading>{props.label}</Heading>
        {windows && window && (
          <FormatSwitch
            formats={windows.map((w) => w.format)}
            value={window.format}
            onChange={setFormat}
          />
        )}
      </div>
      {props.intro && <p className={styles.muted}>{props.intro}</p>}
      {failed ? (
        <LoadError what="the real games" onRetry={retry} />
      ) : !windows ? (
        <Loading label="Loading the real games" />
      ) : !window ? (
        <p className={styles.muted}>No real games loaded yet.</p>
      ) : (
        <>
          {props.children(window)}
          <FreshnessNote window={window} />
        </>
      )}
    </section>
  );
}

function useRows<T>(
  load: () => Promise<T[]>,
  deps: unknown[],
): { rows: T[] | null; failed: boolean } {
  const [rows, setRows] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setRows(null);
    setFailed(false);
    load().then(
      (r) => live && setRows(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, deps);
  return { rows, failed };
}

function CardNumbers(props: {
  window: FablazingWindow;
  cardId: string;
  variantId: string | undefined;
}) {
  const { fablazing } = useServices();
  const { format } = props.window;
  const { rows, failed } = useRows<CardStat>(
    () => fablazing.listCardStats(format, props.cardId),
    [fablazing, format, props.cardId],
  );
  if (failed) return <p role="alert">Couldn&apos;t load the real games.</p>;
  if (!rows) return <Loading label="Loading the real games" />;
  const stat = rows.find((s) => s.variantId === props.variantId);
  if (!stat) return <p>{notEnough(0)}</p>;
  const e = cardEvidence(stat);
  if (!e.enough) return <p>{notEnough(e.games)}</p>;
  return (
    <>
      <p>
        {`In ${percent(e.inclusion)} of Viserai's decks, ${e.averageCopies.toFixed(1)} copies on average`}
      </p>
      <table className={styles.table}>
        <tbody>
          <tr>
            <th scope="row">Plays per game</th>
            <td>{e.playsPerGame.toFixed(1)}</td>
          </tr>
          <tr>
            <th scope="row">Pitches per game</th>
            <td>{e.pitchesPerGame.toFixed(1)}</td>
          </tr>
          <tr>
            <th scope="row">Blocks per game</th>
            <td>{e.blocksPerGame.toFixed(1)}</td>
          </tr>
          <tr>
            <th scope="row">Hits per play</th>
            <td>{e.hitsPerPlay === null ? "–" : e.hitsPerPlay.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <p
        className={styles.rate}
        title={`95% interval ${formatInterval(e.winRate.wins, e.winRate.games)}`}
      >
        {`Decks with this card won ${formatRate(e.winRate.wins, e.winRate.games)}`}
      </p>
      {e.baseline.games > 0 && (
        <p
          title={`95% interval ${formatInterval(e.baseline.wins, e.baseline.games)}`}
        >
          {`All of Viserai's decks won ${formatRate(e.baseline.wins, e.baseline.games)}`}
        </p>
      )}
      <p className={styles.muted}>
        {`n = ${e.games} games with this card. Across every hero Viserai faced, in the proportions it faced them; a deck's Matchups tab shows that mix. These are associations: decks that include a card differ in other ways too.`}
      </p>
    </>
  );
}

/** "In real games" on a card's page, for the chosen pitch. */
export function RealGamesPanel(props: {
  cardId: string;
  variantId: string | undefined;
}) {
  return (
    <Evidence label="In real games" heading="h2">
      {(w) => (
        <CardNumbers
          window={w}
          cardId={props.cardId}
          variantId={props.variantId}
        />
      )}
    </Evidence>
  );
}

function MatchupTable(props: { window: FablazingWindow }) {
  const { fablazing, decks } = useServices();
  const { format } = props.window;
  const { rows, failed } = useRows<MatchupStat>(
    () => fablazing.listMatchups(format),
    [fablazing, format],
  );
  const [heroes, setHeroes] = useState<Hero[]>([]);
  useEffect(() => {
    let live = true;
    decks.listHeroes().then(
      (h) => live && setHeroes(h),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks]);
  if (failed) return <p role="alert">Couldn&apos;t load the real games.</p>;
  if (!rows) return <Loading label="Loading the real games" />;
  if (rows.length === 0)
    return <p className={styles.muted}>No Viserai games in this window.</p>;
  const name = (m: MatchupStat) =>
    heroes.find((h) => h.id === m.heroId)?.name ?? heroFromSlug(m.opponent);
  const sorted = [...rows].sort(
    (a, b) => b.games - a.games || name(a).localeCompare(name(b)),
  );
  return (
    <>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Opponent</th>
              <th scope="col">Viserai won</th>
              <th scope="col">Meta share</th>
              <th scope="col">Games</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const e = matchupEvidence(m);
              return (
                <tr key={m.opponent}>
                  <th scope="row">{name(m)}</th>
                  <td
                    title={
                      e.enough
                        ? `95% interval ${formatInterval(m.wins, m.games)}`
                        : undefined
                    }
                    className={e.enough ? undefined : styles.mutedCell}
                  >
                    {e.enough
                      ? formatRate(m.wins, m.games)
                      : notEnough(m.games)}
                  </td>
                  <td>{percent(e.metaShare)}</td>
                  <td>{m.games}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.muted}>
        {`Meta share is how often Viserai faced each hero, out of its ${rows[0]!.totalGames} games. Abandoned early concessions are left out.`}
      </p>
    </>
  );
}

/** Viserai's real win rate against each hero, and how often it meets them. */
export function RealMatchups() {
  return (
    <Evidence
      label="Viserai in real games"
      heading="h3"
      intro="Every Viserai deck, not this one: how Viserai did against each hero, and how often it faced them."
    >
      {(w) => <MatchupTable window={w} />}
    </Evidence>
  );
}
