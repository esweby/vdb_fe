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
  selfLossBreakdown?: readonly SelfLossBreakdown[];
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

function validateBreakdownLoss(loss: Measure<number>, turn: number) {
  signedLoss(loss.value, `turn ${turn} breakdown loss`);
  if (
    !["Observed", "Assumed", "Extrapolated"].includes(loss.evidence) ||
    !loss.source.trim()
  )
    throw new TalisharReportError(
      `turn ${turn} breakdown needs evidence and a source`,
    );
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
      "Observed",
      "Sum of CSV Damage Taken - signed Total Life Self-Lost; gross losses, before healing.",
    ),
    selfLossShare: measure(
      totalLifeLost === 0 ? null : -recordedLoss / totalLifeLost,
      "Observed",
      "Magnitude of CSV Total Life Self-Lost / total gross life lost; null when no life was lost.",
    ),
  };
}
