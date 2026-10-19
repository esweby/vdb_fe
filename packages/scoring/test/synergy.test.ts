// Community synergy: the scoring group's edges and their feedback on derived edges
// (docs/synergy-rules.md "Community feedback"), without the database.
import { describe, expect, it } from "vitest";
import {
  buildSynergyInput,
  computeCommunitySynergies,
  feedbackWeight,
} from "../src/synergy.ts";

const voters = [
  { userId: "alice", weight: 1 },
  { userId: "bob", weight: 1 },
  { userId: "carol", weight: 2 },
];
const edge = (userId: string, weight: number, from = "a", to = "b") => ({
  userId,
  fromCardId: from,
  toCardId: to,
  weight,
});
const vote = (
  userId: string,
  verdict: "confirm" | "reject" | "reweight",
  weight: number | null = null,
) => ({
  userId,
  ruleId: "gate-feeds-gate-target",
  fromCardId: "a",
  toCardId: "b",
  verdict,
  weight,
});

describe("computeCommunitySynergies: community edges", () => {
  it("averages people's weights for an edge, weighted by their rating weight", () => {
    const { edges } = computeCommunitySynergies({
      voters,
      edges: [edge("alice", 0.4), edge("carol", 0.7)],
      feedback: [],
    });
    expect(edges).toEqual([
      {
        fromCardId: "a",
        toCardId: "b",
        weight: 0.6, // (0.4 × 1 + 0.7 × 2) / 3
        ratingCount: 2,
        totalWeight: 3,
      },
    ]);
  });

  it("keeps directions apart: a → b and b → a are different edges", () => {
    const { edges } = computeCommunitySynergies({
      voters,
      edges: [
        edge("alice", 0.4),
        edge("bob", 0.6),
        edge("alice", 0.9, "b", "a"),
        edge("bob", 0.9, "b", "a"),
      ],
      feedback: [],
    });
    expect(
      edges.map((e) => `${e.fromCardId}→${e.toCardId} ${e.weight}`),
    ).toEqual(["a→b 0.5", "b→a 0.9"]);
  });

  it("needs at least 2 people, so no single person's edge is shown", () => {
    const { edges } = computeCommunitySynergies({
      voters,
      edges: [edge("alice", 0.4)],
      feedback: [],
    });
    expect(edges).toEqual([]);
  });

  it("counts only the scoring group: anyone not in voters is left out", () => {
    const { edges } = computeCommunitySynergies({
      voters,
      edges: [edge("alice", 0.4), edge("mallory", 1)],
      feedback: [],
    });
    expect(edges).toEqual([]);
  });

  it("leaves out people whose rating weight is 0", () => {
    const { edges } = computeCommunitySynergies({
      voters: [...voters, { userId: "dave", weight: 0 }],
      edges: [edge("alice", 0.4), edge("dave", 1)],
      feedback: [],
    });
    expect(edges).toEqual([]);
  });
});

describe("computeCommunitySynergies: feedback on derived edges", () => {
  it("splits votes into the share that confirmed and a fixed part (reject 0, reweight its weight)", () => {
    const { feedback } = computeCommunitySynergies({
      voters,
      edges: [],
      feedback: [
        vote("alice", "confirm"),
        vote("bob", "reject"),
        vote("carol", "reweight", 0.5),
      ],
    });
    expect(feedback).toEqual([
      {
        ruleId: "gate-feeds-gate-target",
        fromCardId: "a",
        toCardId: "b",
        confirmShare: 0.25, // alice 1 of 4
        fixedPart: 0.25, // (bob 0 × 1 + carol 0.5 × 2) / 4
        ratingCount: 3,
        totalWeight: 4,
      },
    ]);
  });

  it("needs at least 2 people too", () => {
    const { feedback } = computeCommunitySynergies({
      voters,
      edges: [],
      feedback: [vote("bob", "reject")],
    });
    expect(feedback).toEqual([]);
  });
});

describe("feedbackWeight", () => {
  it("is the confirm share of the rule's current weight plus the fixed part", () => {
    expect(feedbackWeight({ confirmShare: 0.25, fixedPart: 0.25 }, 0.8)).toBe(
      0.45,
    );
  });

  it("follows an admin's change to the rule weight without re-running the job", () => {
    const row = { confirmShare: 1, fixedPart: 0 };
    expect(feedbackWeight(row, 0.8)).toBe(0.8);
    expect(feedbackWeight(row, 0.5)).toBe(0.5);
  });

  it("everyone rejecting gives 0", () => {
    expect(feedbackWeight({ confirmShare: 0, fixedPart: 0 }, 0.8)).toBe(0);
  });
});

describe("buildSynergyInput", () => {
  it("takes the scoring group from roles, with their rating weights (1 when unset)", () => {
    const input = buildSynergyInput({
      profiles: [
        { id: "alice", role: "scorer" },
        { id: "bob", role: "admin" },
        { id: "uma", role: "user" },
      ],
      raterWeights: [{ user_id: "bob", rating_weight: "2.5" }],
      cardSynergies: [
        {
          user_id: "alice",
          from_card_id: "a",
          to_card_id: "b",
          weight: "0.40",
        },
      ],
      synergyFeedback: [
        {
          user_id: "bob",
          rule_id: "gate-feeds-gate-target",
          from_card_id: "a",
          to_card_id: "b",
          verdict: "reweight",
          weight: "0.90",
        },
      ],
    });
    expect(input.voters).toEqual([
      { userId: "alice", weight: 1 },
      { userId: "bob", weight: 2.5 },
    ]);
    expect(input.edges).toEqual([edge("alice", 0.4)]);
    expect(input.feedback).toEqual([
      {
        userId: "bob",
        ruleId: "gate-feeds-gate-target",
        fromCardId: "a",
        toCardId: "b",
        verdict: "reweight",
        weight: 0.9,
      },
    ]);
  });
});
