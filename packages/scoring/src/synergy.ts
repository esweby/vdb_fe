// Community synergy (docs/synergy-rules.md "Community feedback"): the scoring group's own edges,
// and their feedback on derived edges, weighted like scores. Runs in the community-scores job,
// which can read the hidden rating weights.

/** Roles whose edges and feedback count, as for scores. */
const SCORING_ROLES = new Set(["scorer", "curator", "admin"]);

/** Fewer than this many people and nothing is shown, so no single person's opinion is exposed. */
export const MIN_SYNERGY_VOTERS = 2;

export interface SynergyVoter {
  userId: string;
  /** Hidden rating_weight. */
  weight: number;
}

export interface SynergyEdgeVote {
  userId: string;
  fromCardId: string;
  toCardId: string;
  weight: number;
}

export interface SynergyFeedbackVote {
  userId: string;
  ruleId: string;
  fromCardId: string;
  toCardId: string;
  verdict: "confirm" | "reject" | "reweight";
  weight: number | null;
}

export interface CommunityEdgeRow {
  fromCardId: string;
  toCardId: string;
  weight: number;
  ratingCount: number;
  totalWeight: number;
}

/**
 * Feedback on one derived edge. A confirm vote means "the rule's weight", which admins can
 * change at any time, so it's kept as a share: the edge's weight is
 * confirmShare × the rule's weight + fixedPart (see feedbackWeight).
 */
export interface CommunityFeedbackRow {
  ruleId: string;
  fromCardId: string;
  toCardId: string;
  confirmShare: number;
  fixedPart: number;
  ratingCount: number;
  totalWeight: number;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items)
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return new Map([...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function computeCommunitySynergies(input: {
  voters: SynergyVoter[];
  edges: SynergyEdgeVote[];
  feedback: SynergyFeedbackVote[];
}): { edges: CommunityEdgeRow[]; feedback: CommunityFeedbackRow[] } {
  const weights = new Map(
    input.voters.filter((v) => v.weight > 0).map((v) => [v.userId, v.weight]),
  );
  const counted = <T extends { userId: string }>(votes: T[]) =>
    votes.filter((v) => weights.has(v.userId));

  const edges: CommunityEdgeRow[] = [];
  for (const votes of groupBy(
    counted(input.edges),
    (e) => `${e.fromCardId}\u0000${e.toCardId}`,
  ).values()) {
    if (votes.length < MIN_SYNERGY_VOTERS) continue;
    const total = votes.reduce((s, v) => s + weights.get(v.userId)!, 0);
    const sum = votes.reduce(
      (s, v) => s + v.weight * weights.get(v.userId)!,
      0,
    );
    edges.push({
      fromCardId: votes[0]!.fromCardId,
      toCardId: votes[0]!.toCardId,
      weight: round4(sum / total),
      ratingCount: votes.length,
      totalWeight: total,
    });
  }

  const feedback: CommunityFeedbackRow[] = [];
  for (const votes of groupBy(
    counted(input.feedback),
    (f) => `${f.ruleId}\u0000${f.fromCardId}\u0000${f.toCardId}`,
  ).values()) {
    if (votes.length < MIN_SYNERGY_VOTERS) continue;
    const total = votes.reduce((s, v) => s + weights.get(v.userId)!, 0);
    let confirm = 0;
    let fixed = 0;
    for (const v of votes) {
      const w = weights.get(v.userId)!;
      if (v.verdict === "confirm") confirm += w;
      else if (v.verdict === "reweight") fixed += w * (v.weight ?? 0);
    }
    feedback.push({
      ruleId: votes[0]!.ruleId,
      fromCardId: votes[0]!.fromCardId,
      toCardId: votes[0]!.toCardId,
      confirmShare: round4(confirm / total),
      fixedPart: round4(fixed / total),
      ratingCount: votes.length,
      totalWeight: total,
    });
  }

  return { edges, feedback };
}

/** A derived edge's weight after the scoring group's feedback, at the rule's current weight. */
export function feedbackWeight(
  row: Pick<CommunityFeedbackRow, "confirmShare" | "fixedPart">,
  ruleWeight: number,
): number {
  return round4(row.confirmShare * ruleWeight + row.fixedPart);
}

export interface SynergyDbRows {
  profiles: { id: string; role: string }[];
  raterWeights: { user_id: string; rating_weight: string | number }[];
  cardSynergies: {
    user_id: string;
    from_card_id: string;
    to_card_id: string;
    weight: string | number;
  }[];
  synergyFeedback: {
    user_id: string;
    rule_id: string;
    from_card_id: string;
    to_card_id: string;
    verdict: string;
    weight: string | number | null;
  }[];
}

/** Turns raw database rows into input for computeCommunitySynergies. */
export function buildSynergyInput(db: SynergyDbRows) {
  const weights = new Map(
    db.raterWeights.map((w) => [w.user_id, Number(w.rating_weight)]),
  );
  return {
    voters: db.profiles
      .filter((p) => SCORING_ROLES.has(p.role))
      .map((p): SynergyVoter => ({
        userId: p.id,
        weight: weights.get(p.id) ?? 1,
      })),
    edges: db.cardSynergies.map((e): SynergyEdgeVote => ({
      userId: e.user_id,
      fromCardId: e.from_card_id,
      toCardId: e.to_card_id,
      weight: Number(e.weight),
    })),
    feedback: db.synergyFeedback.map((f): SynergyFeedbackVote => ({
      userId: f.user_id,
      ruleId: f.rule_id,
      fromCardId: f.from_card_id,
      toCardId: f.to_card_id,
      verdict: f.verdict as SynergyFeedbackVote["verdict"],
      weight: f.weight === null ? null : Number(f.weight),
    })),
  };
}
