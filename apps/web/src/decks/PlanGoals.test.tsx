// Plan goals (task 7c): a scenario and a target success rate on a saved sideboard plan, checked on
// the same seeds as the main deck or another plan.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ScenarioDefinition } from "@vdb/engine";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";
import { fakeScenarioRepository } from "../test/fakeScenarioRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckCard, Matchup, PlanGoal } from "./deckRepository.ts";

const card = (
  variantId: string,
  quantity: number,
  sideboard = false,
): DeckCard => ({ variantId, quantity, sideboard });
// Main: Hocus Pocus (red) ×3, Become the Shadow Lord ×2. Sideboard: Fate Foreseen (red) ×2.
const CARDS = [card("hp1", 3), card("bsl3", 2), card("ff1", 2, true)];
// "Race" boards both Fate Foreseen in; "Same" is the main deck as it is.
const RACE: Matchup = {
  id: "m1",
  deckId: "deck-1",
  name: "Race",
  heroId: null,
  cards: [
    { variantId: "hp1", quantity: 3 },
    { variantId: "bsl3", quantity: 2 },
    { variantId: "ff1", quantity: 2 },
  ],
};
const SAME: Matchup = {
  ...RACE,
  id: "m2",
  name: "Same",
  cards: RACE.cards.filter((c) => c.variantId !== "ff1"),
};
const fateForeseen: ScenarioDefinition = {
  version: 1,
  name: "Fate Foreseen in the opening hand",
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition: {
    all: [
      { label: "a Fate Foreseen", filter: { name: "Fate Foreseen" }, min: 1 },
    ],
  },
};

async function open(matchups: Matchup[], goals: PlanGoal[] = []) {
  const fake = fakeDeckRepository(
    [
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: CARDS,
        pitchTargets: {},
      },
    ],
    { matchups, goals },
  );
  await renderApp({
    path: "/decks/deck-1?tab=matchups",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fake.repository,
    cards: fakeCardRepository(sampleCards),
    scenarios: fakeScenarioRepository({
      scenarios: [
        {
          id: "s1",
          userId: "u1",
          definition: fateForeseen,
          visibility: "private",
        },
      ],
    }).repository,
  });
  const goalsRegion = within(
    await screen.findByRole("region", { name: "Goals" }),
  );
  return { goals: goalsRegion, fake, user: userEvent.setup() };
}

describe("plan goals", () => {
  it("adds a goal naming a scenario and a target", async () => {
    const { goals, fake, user } = await open([RACE]);
    await goals.findByRole("option", {
      name: "Fate Foreseen in the opening hand",
    });
    await user.selectOptions(
      goals.getByLabelText("Scenario"),
      "Fate Foreseen in the opening hand",
    );
    await user.type(goals.getByLabelText("Target (%)"), "40");
    await user.click(goals.getByRole("button", { name: "Add goal" }));
    const list = within(
      await goals.findByRole("list", { name: "This plan's goals" }),
    );
    expect(list.getByText("Fate Foreseen in the opening hand")).toBeTruthy();
    expect(list.getByText("at least 40%")).toBeTruthy();
    expect(fake.saved).toContain("goal m1 s1 40");
  });

  it("asks for a target between 1 and 99", async () => {
    const { goals, fake, user } = await open([RACE]);
    await goals.findByRole("option", {
      name: "Fate Foreseen in the opening hand",
    });
    await user.selectOptions(
      goals.getByLabelText("Scenario"),
      "Fate Foreseen in the opening hand",
    );
    await user.type(goals.getByLabelText("Target (%)"), "100");
    await user.click(goals.getByRole("button", { name: "Add goal" }));
    expect(goals.getByText("Give a target from 1% to 99%.")).toBeTruthy();
    expect(fake.saved.some((line) => line.startsWith("goal"))).toBe(false);
  });

  it("checks a goal against its target and the main deck, in words", async () => {
    const { goals, user } = await open(
      [RACE],
      [{ id: "g1", planId: "m1", scenarioId: "s1", builtIn: null, target: 40 }],
    );
    await goals.findByText("at least 40%");
    await user.click(goals.getByRole("button", { name: "Check goals" }));
    const table = within(
      await goals.findByRole("table", { name: "Goal results" }),
    );
    const row = within(
      table.getByRole("row", { name: /Fate Foreseen in the opening hand/ }),
    );
    // 1 − C(5,4)/C(7,4) ≈ 86% for the plan; the main deck has no Fate Foreseen.
    expect(row.getByText("Met")).toBeTruthy();
    expect(row.getByText(/^Higher by 8\d\.\d points/)).toBeTruthy();
  });

  it("says there's no clear difference when the plan matches what it's compared with", async () => {
    const { goals, user } = await open(
      [SAME],
      [{ id: "g1", planId: "m2", scenarioId: "s1", builtIn: null, target: 40 }],
    );
    await goals.findByText("at least 40%");
    await user.click(goals.getByRole("button", { name: "Check goals" }));
    const table = within(
      await goals.findByRole("table", { name: "Goal results" }),
    );
    expect(table.getByText("Not met")).toBeTruthy();
    expect(
      table.getByText("No clear difference: the same result in every run"),
    ).toBeTruthy();
  });

  it("compares with another plan on the same seeds", async () => {
    const { goals, user } = await open(
      [RACE, SAME],
      [{ id: "g1", planId: "m1", scenarioId: "s1", builtIn: null, target: 40 }],
    );
    await goals.findByText("at least 40%");
    await user.selectOptions(goals.getByLabelText("Compare with"), "Same");
    await user.click(goals.getByRole("button", { name: "Check goals" }));
    const table = within(
      await goals.findByRole("table", { name: "Goal results" }),
    );
    expect(table.getByRole("columnheader", { name: "vs Same" })).toBeTruthy();
    expect(table.getByText(/^Higher by/)).toBeTruthy();
  });

  it("removes a goal", async () => {
    const { goals, fake, user } = await open(
      [RACE],
      [{ id: "g1", planId: "m1", scenarioId: "s1", builtIn: null, target: 40 }],
    );
    await goals.findByText("at least 40%");
    await user.click(
      goals.getByRole("button", {
        name: "Remove goal: Fate Foreseen in the opening hand",
      }),
    );
    expect(goals.queryByText("at least 40%")).toBeNull();
    expect(fake.saved).toContain("delete goal g1");
  });

  it("names a goal whose scenario has gone", async () => {
    const { goals } = await open(
      [RACE],
      [
        {
          id: "g1",
          planId: "m1",
          scenarioId: "gone",
          builtIn: null,
          target: 40,
        },
      ],
    );
    expect(
      await goals.findByText("A scenario that's no longer available"),
    ).toBeTruthy();
  });
});

describe("plan goals on a new plan", () => {
  it("asks for the plan to be saved first", async () => {
    await open([]);
    // A deck with no plans opens on a new one.
    expect(await screen.findByText("Save the plan to add goals.")).toBeTruthy();
  });
});
