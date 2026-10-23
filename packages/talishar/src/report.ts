import type { GameStats } from "./index.ts";

export type Evidence = "Observed" | "Assumed" | "Extrapolated";

export interface Measure<T> {
  value: T;
  evidence: Evidence;
  source: string;
}

export interface SelfLossBreakdown {
  turn: number;
  bloodDebt: Measure<number>;
  otherSelfLost: Measure<number>;
}

export interface ReportInputs {
  startingLife: number;
  startingLifeSource?: string;
  finalLife?: Measure<number>;
  selfLossBreakdown?: readonly SelfLossBreakdown[];
}

export interface ReportCheck {
  expected: Measure<number>;
  calculated: Measure<number | null>;
  matches: boolean | null;
}

export interface TurnReport {
  turn: number;
  damageTaken: Measure<number>;
  lifeGained: Measure<number>;
  selfLost: Measure<number>;
  life: Measure<number>;
  cardsBlocked: Measure<number>;
  damageDealt: Measure<number>;
  damageDealtSoFar: Measure<number>;
  bloodDebt: Measure<number> | null;
  otherSelfLost: Measure<number> | null;
}

export interface GameReport {
  startingLife: Measure<number>;
  turns: TurnReport[];
  selfLoss: {
    recorded: Measure<number>;
    recovered: Measure<number>;
    difference: number;
  };
  totalLifeLost: Measure<number>;
  selfLossShare: Measure<number | null>;
  checks: {
    averageValuePerTurn: ReportCheck;
    averageCombatValuePerTurn: ReportCheck;
    finalLife: ReportCheck | null;
  };
}

export class TalisharReportError extends Error {
  constructor(detail: string) {
    super(`Cannot report Talishar game: ${detail}`);
    this.name = "TalisharReportError";
  }
}

const formulaSource =
  "Total Value - Damage Threatened - Damage Blocked - Damage Prevented - Life Gained. " +
  "Assumes the export uses Talishar-FE getTurnValue at ed8ef58398545ed7cc2f34cd8ca1bef2fb1ae045; see report-example.md.";

function measure<T>(value: T, evidence: Evidence, source: string): Measure<T> {
  return { value, evidence, source };
}

function signedLoss(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value > 0)
    throw new TalisharReportError(`${label} must be a non-positive integer`);
  return value === 0 ? 0 : value;
}

function validateEvidence(value: Measure<number>, label: string) {
  if (
    !["Observed", "Assumed", "Extrapolated"].includes(value.evidence) ||
    !value.source.trim()
  )
    throw new TalisharReportError(`${label} needs evidence and a source`);
}

function validateBreakdownLoss(loss: Measure<number>, turn: number) {
  signedLoss(loss.value, `turn ${turn} breakdown loss`);
  validateEvidence(loss, `turn ${turn} breakdown`);
}

function averageCheck(
  total: number,
  rows: number,
  expected: number,
  label: string,
  source: string,
): ReportCheck {
  if (!Number.isSafeInteger(total))
    throw new TalisharReportError(
      "summary totals exceed safe integer precision",
    );
  const average = rows === 0 ? null : total / rows;
  const rounded =
    average === null
      ? null
      : ((average < 0 ? -1 : 1) * Math.round(Math.abs(average) * 100)) / 100;
  return {
    expected: measure(expected, "Observed", `CSV ${label}`),
    calculated: measure(
      rounded,
      "Assumed",
      `${source} / CSV row count, rounded to two decimal places; assumes the summary covers the same rows. No rows gives no comparison.`,
    ),
    matches: rounded === null ? null : rounded === expected,
  };
}

/**
 * UNVERIFIED: the inspected exporter formula matches this export's producer.
 * Recover timing from Total Value and check the observed total; see report-example.md.
 * Damage Taken and signed self-loss are separate in Talishar's life calculation.
 */
export function createGameReport(
  game: GameStats,
  inputs: ReportInputs,
): GameReport {
  if (!Number.isSafeInteger(inputs.startingLife) || inputs.startingLife <= 0)
    throw new TalisharReportError("starting life must be a positive integer");
  if (inputs.finalLife) {
    if (!Number.isSafeInteger(inputs.finalLife.value))
      throw new TalisharReportError("final life must be an integer");
    validateEvidence(inputs.finalLife, "final life");
  }

  const recordedLoss = signedLoss(
    game.statistics.totalLifeSelfLost,
    "total self-loss",
  );
  const breakdowns = new Map<number, SelfLossBreakdown>();
  for (const breakdown of inputs.selfLossBreakdown ?? []) {
    if (!game.turns.some((turn) => turn.turn === breakdown.turn))
      throw new TalisharReportError(
        `unknown turn ${breakdown.turn} in breakdown`,
      );
    if (breakdowns.has(breakdown.turn))
      throw new TalisharReportError(
        `duplicate turn ${breakdown.turn} breakdown`,
      );
    validateBreakdownLoss(breakdown.bloodDebt, breakdown.turn);
    validateBreakdownLoss(breakdown.otherSelfLost, breakdown.turn);
    breakdowns.set(breakdown.turn, breakdown);
  }

  let life = inputs.startingLife;
  let damageDealtSoFar = 0;
  let totalDamageTaken = 0;
  let recoveredLoss = 0;
  const turns = game.turns.map((turn): TurnReport => {
    const selfLost = signedLoss(
      turn.totalValue -
        turn.damageThreatened -
        turn.damageBlocked -
        turn.damagePrevented -
        turn.lifeGained,
      `turn ${turn.turn} recovered self-loss`,
    );
    const breakdown = breakdowns.get(turn.turn);
    if (
      breakdown &&
      breakdown.bloodDebt.value + breakdown.otherSelfLost.value !== selfLost
    )
      throw new TalisharReportError(
        `turn ${turn.turn} breakdown does not match recovered self-loss ${selfLost}`,
      );

    recoveredLoss += selfLost;
    totalDamageTaken += turn.damageTaken;
    damageDealtSoFar += turn.damageDealt;
    life = life - turn.damageTaken + turn.lifeGained + selfLost;
    if (
      ![recoveredLoss, totalDamageTaken, damageDealtSoFar, life].every(
        Number.isSafeInteger,
      )
    )
      throw new TalisharReportError(
        "calculated totals exceed safe integer precision",
      );
    const source = `CSV turn ${turn.turn}`;
    return {
      turn: turn.turn,
      damageTaken: measure(
        turn.damageTaken,
        "Observed",
        `${source}: Damage Taken`,
      ),
      lifeGained: measure(
        turn.lifeGained,
        "Observed",
        `${source}: Life Gained`,
      ),
      selfLost: measure(selfLost, "Assumed", `${source}: ${formulaSource}`),
      life: measure(
        life,
        "Assumed",
        "Starting life - cumulative Damage Taken + cumulative Life Gained + cumulative recovered signed self-loss; depends on the export formula.",
      ),
      cardsBlocked: measure(
        turn.cardsBlocked,
        "Observed",
        `${source}: Cards Blocked`,
      ),
      damageDealt: measure(
        turn.damageDealt,
        "Observed",
        `${source}: Damage Dealt`,
      ),
      damageDealtSoFar: measure(
        damageDealtSoFar,
        "Observed",
        `Sum of CSV Damage Dealt through turn ${turn.turn}`,
      ),
      bloodDebt: breakdown ? { ...breakdown.bloodDebt } : null,
      otherSelfLost: breakdown ? { ...breakdown.otherSelfLost } : null,
    };
  });

  if (recoveredLoss !== recordedLoss)
    throw new TalisharReportError(
      `recovered self-loss ${recoveredLoss} does not match observed total ${recordedLoss}; check the export formula`,
    );
  const totalLifeLost = totalDamageTaken - recordedLoss;
  if (!Number.isSafeInteger(totalLifeLost))
    throw new TalisharReportError(
      "total life lost exceeds safe integer precision",
    );
  if (inputs.finalLife && life !== inputs.finalLife.value)
    throw new TalisharReportError(
      `calculated final life ${life} does not match supplied final life ${inputs.finalLife.value}`,
    );
  return {
    startingLife: measure(
      inputs.startingLife,
      "Assumed",
      inputs.startingLifeSource ??
        "Caller-supplied starting life; absent from the CSV.",
    ),
    turns,
    selfLoss: {
      recorded: measure(
        recordedLoss,
        "Observed",
        "CSV Total Life Self-Lost; sign preserved",
      ),
      recovered: measure(
        recoveredLoss,
        "Assumed",
        `Sum of recovered turn self-loss. ${formulaSource}`,
      ),
      difference: recoveredLoss - recordedLoss,
    },
    totalLifeLost: measure(
      totalLifeLost,
      "Assumed",
      "Sum of CSV Damage Taken - signed Total Life Self-Lost; gross losses, before healing. Assumes damage taken excludes self-loss, as in the inspected Talishar source.",
    ),
    selfLossShare: measure(
      totalLifeLost === 0 ? null : -recordedLoss / totalLifeLost,
      "Assumed",
      "Magnitude of CSV Total Life Self-Lost / total gross life lost; assumes damage taken and self-loss do not overlap. Null when no life was lost.",
    ),
    checks: {
      averageValuePerTurn: averageCheck(
        game.turns.reduce((total, turn) => total + turn.totalValue, 0),
        game.turns.length,
        game.statistics.averageValuePerTurn,
        "Avg Value per Turn",
        "Sum of CSV Total Value",
      ),
      averageCombatValuePerTurn: averageCheck(
        game.turns.reduce(
          (total, turn) => total + turn.damageThreatened + turn.damageBlocked,
          0,
        ),
        game.turns.length,
        game.statistics.averageCombatValuePerTurn,
        "Avg Combat Value per Turn",
        "Sum of CSV Damage Threatened + Damage Blocked",
      ),
      finalLife: inputs.finalLife
        ? {
            expected: { ...inputs.finalLife },
            calculated: measure(
              life,
              "Assumed",
              "Final calculated life; depends on supplied starting life and the inspected Talishar formula.",
            ),
            matches: true,
          }
        : null,
    },
  };
}
