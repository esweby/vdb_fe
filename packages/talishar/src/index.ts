export { createGameReport, TalisharReportError } from "./report.ts";
export type {
  Evidence,
  Measure,
  SelfLossBreakdown,
  ReportInputs,
  ReportCheck,
  TurnReport,
  GameReport,
} from "./report.ts";

/** The single-player layout observed in the maintainer's 22 Oct 2026 export. */
export interface GameStats {
  player: 1;
  /** Exported text, without inferring the hero's starting or finishing side. */
  hero: string;
  summary: {
    firstPlayer: boolean;
    result: "win" | "loss";
    turns: number;
    yourTimeSeconds: number;
    totalGameTimeSeconds: number;
  };
  statistics: GameStatistics;
  cardPlays: CardPlayStats[];
  cardActivations: CardActivationStats[];
  /** One row per turn going first. Going second, the first row is the opponent's first turn. */
  turns: TurnStats[];
  opponentStats: "unavailable";
}

const statisticFields = {
  "Avg Value per Turn": "averageValuePerTurn",
  "Avg Damage Threatened per Turn": "averageDamageThreatenedPerTurn",
  "Avg Damage Dealt per Turn": "averageDamageDealtPerTurn",
  "Avg Damage Threatened per Card": "averageDamageThreatenedPerCard",
  "Avg Resources Used per Turn": "averageResourcesUsedPerTurn",
  "Avg Cards Left Over per Turn": "averageCardsLeftOverPerTurn",
  "Avg Combat Value per Turn": "averageCombatValuePerTurn",
  "Total Damage Threatened": "totalDamageThreatened",
  "Total Damage Dealt": "totalDamageDealt",
  "Total Damage Blocked": "totalDamageBlocked",
  "Total Damage Prevented": "totalDamagePrevented",
  "Total Life Gained": "totalLifeGained",
  "Total Life Self-Lost": "totalLifeSelfLost",
} as const;

/** Self-loss keeps the export's sign (−18 in the real fixture). */
export type GameStatistics = Record<
  (typeof statisticFields)[keyof typeof statisticFields],
  number
>;

export interface CardPlayStats {
  name: string;
  pitch: 1 | 2 | 3;
  played: number;
  blocked: number;
  pitched: number;
  discarded: number;
  timesHit: number;
}

export interface CardActivationStats {
  name: string;
  activated: number;
  passiveTriggers: number;
  blocked: number;
  timesHit: number;
}

const turnFields = {
  Turn: "turn",
  "Cards Played": "cardsPlayed",
  "Cards Blocked": "cardsBlocked",
  "Cards Pitched": "cardsPitched",
  "Cards Discarded": "cardsDiscarded",
  "Cards Left": "cardsLeft",
  "Resources Used": "resourcesUsed",
  "Resources Left": "resourcesLeft",
  "Damage Threatened": "damageThreatened",
  "Damage Dealt": "damageDealt",
  "Damage Blocked": "damageBlocked",
  "Damage Prevented": "damagePrevented",
  "Damage Taken": "damageTaken",
  "Life Gained": "lifeGained",
  "Total Value": "totalValue",
} as const;

export type TurnStats = Record<
  (typeof turnFields)[keyof typeof turnFields],
  number
>;

export class TalisharParseError extends Error {
  constructor(detail: string) {
    super(`Unrecognised Talishar stats export: ${detail}`);
    this.name = "TalisharParseError";
  }
}

function reject(detail: string): never {
  throw new TalisharParseError(detail);
}

// A row reader for this observed layout. Embedded newlines are deliberately unsupported.
function cells(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (true) {
    let value = "";
    if (line[i] === '"') {
      i++;
      let closed = false;
      while (i < line.length) {
        const char = line[i++];
        if (char !== '"') value += char;
        else if (line[i] === '"') {
          value += '"';
          i++;
        } else {
          closed = true;
          break;
        }
      }
      if (!closed) reject("unfinished quoted field");
    } else {
      while (i < line.length && line[i] !== ",") {
        if (line[i] === '"') reject("quote inside an unquoted field");
        value += line[i++];
      }
    }
    result.push(value);
    if (i === line.length) return result;
    if (line[i++] !== ",") reject("text after a quoted field");
  }
}

function numeric(value: string, label: string, integer = false): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) reject(`invalid ${label}`);
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER)
    reject(`invalid ${label}`);
  if (integer && (!Number.isSafeInteger(n) || n < 0))
    reject(`invalid ${label}`);
  return n;
}

function duration(value: string): number {
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (!match) reject("invalid duration");
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  if (!Number.isSafeInteger(seconds)) reject("invalid duration");
  return seconds;
}

/**
 * Pure parsing: no card lookup, inferred life, copies or reconciliation of totals.
 * New layouts (including exports with an opponent) need a real fixture before support.
 */
export function parseGameStats(csv: string): GameStats {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line !== "");
  let cursor = 0;
  function next(): string {
    return lines[cursor++] ?? reject("unexpected end of file");
  }
  function expectLine(expected: string) {
    if (next() !== expected) reject(`expected ${expected}`);
  }
  function pair(label: string): string {
    const row = cells(next());
    if (row.length !== 2 || row[0] !== label) reject(`expected ${label}`);
    return row[1]!;
  }
  function table<T>(
    header: string,
    end: string,
    parse: (row: string[]) => T,
  ): T[] {
    expectLine(header);
    const width = cells(header).length;
    const rows: T[] = [];
    while (lines[cursor] !== end) {
      const row = cells(next());
      if (row.length !== width) reject(`wrong column count under ${header}`);
      rows.push(parse(row));
    }
    return rows;
  }

  expectLine("========== STATS PROVIDED BY TALISHAR ==========");
  expectLine("Support our work on Metafy!");
  expectLine("https://metafy.gg/@Talishar");
  expectLine("========== PLAYER 1 ==========");
  const heroLine = next();
  if (!heroLine.startsWith("Hero: ") || !heroLine.slice(6).trim())
    reject("missing hero");
  expectLine("GAME SUMMARY");
  const first = pair("First Player");
  if (first !== "Yes" && first !== "No") reject("unknown first-player value");
  const result = pair("Result");
  if (result !== "Winner" && result !== "Loser") reject("unknown result");
  const turnCount = numeric(pair("Turns"), "turn count", true);
  const yourTimeSeconds = duration(pair("Your Time"));
  const totalGameTimeSeconds = duration(pair("Total Game Time"));
  expectLine("GAME STATISTICS");
  const statistics = Object.fromEntries(
    Object.entries(statisticFields).map(([label, field]) => [
      field,
      numeric(
        pair(label),
        label,
        label.startsWith("Total ") && field !== "totalLifeSelfLost",
      ),
    ]),
  ) as GameStatistics;

  expectLine("CARD PLAY STATS");
  const cardPlays = table(
    "Card Name,Played,Blocked,Pitched,Discarded,Times Hit",
    "CARD ACTIVATED STATS",
    (row): CardPlayStats => {
      const match = /^(.+) \(([123])\)$/.exec(row[0]!);
      if (!match) reject("missing or unknown card pitch");
      return {
        name: match[1]!,
        pitch: Number(match[2]) as 1 | 2 | 3,
        played: numeric(row[1]!, "played", true),
        blocked: numeric(row[2]!, "blocked", true),
        pitched: numeric(row[3]!, "pitched", true),
        discarded: numeric(row[4]!, "discarded", true),
        timesHit: numeric(row[5]!, "times hit", true),
      };
    },
  );
  expectLine("CARD ACTIVATED STATS");
  const cardActivations = table(
    "Card Name,Activated,Passive Triggers,Blocked,Times Hit",
    "TURN BY TURN BREAKDOWN",
    (row): CardActivationStats => {
      if (!row[0]?.trim()) reject("empty activated card name");
      return {
        name: row[0],
        activated: numeric(row[1]!, "activated", true),
        passiveTriggers: numeric(row[2]!, "passive triggers", true),
        blocked: numeric(row[3]!, "blocked", true),
        timesHit: numeric(row[4]!, "times hit", true),
      };
    },
  );
  expectLine("TURN BY TURN BREAKDOWN");
  const footer =
    'Note: Opponent stats not available. Click "Switch player stats" to load them first.';
  const turns = table(
    Object.keys(turnFields).join(","),
    footer,
    (row) =>
      Object.fromEntries(
        Object.values(turnFields).map((field, i) => [
          field,
          numeric(row[i]!, field, field !== "totalValue"),
        ]),
      ) as TurnStats,
  );
  // Going second, the first row is the opponent's first turn (Talishar's "turn 0"), so
  // there is one more row than the summary's turns. Seen in the 28 Oct 2026 export.
  const expectedRows = first === "Yes" ? turnCount : turnCount + 1;
  if (
    turns.length !== expectedRows ||
    turns.some((turn, i) => turn.turn !== i + 1)
  )
    reject("turn rows do not match the summary");
  expectLine(footer);
  if (cursor !== lines.length) reject("unexpected content after footer");
  return {
    player: 1,
    hero: heroLine.slice(6),
    summary: {
      firstPlayer: first === "Yes",
      result: result === "Winner" ? "win" : "loss",
      turns: turnCount,
      yourTimeSeconds,
      totalGameTimeSeconds,
    },
    statistics,
    cardPlays,
    cardActivations,
    turns,
    opponentStats: "unavailable",
  };
}
