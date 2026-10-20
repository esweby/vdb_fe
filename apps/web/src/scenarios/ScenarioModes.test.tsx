// The maintainer, 20 Oct 2026: "Scenarios should be split into creating and running a scenario
// with a clear way to toggle between the two. Like an add a new scenario button with clear
// guidelines of what's expected/when/where."
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScenarioDefinition } from "@vdb/engine";
import { describe, expect, it } from "vitest";
import type { DeckCard } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeScenarioRepository } from "../test/fakeScenarioRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});
const blue: ScenarioDefinition = {
  version: 1,
  name: "Blue",
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition: {
    all: [{ label: "at least 1 blue card", filter: { pitch: 3 }, min: 1 }],
  },
};

async function open(path = "/decks/deck-1?tab=scenarios") {
  const { router } = await renderApp({
    path,
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: [card("hp1", 3), card("bsl3", 2)],
        pitchTargets: {},
      },
    ]).repository,
    scenarios: fakeScenarioRepository({
      scenarios: [
        { id: "s1", userId: "u1", definition: blue, visibility: "private" },
      ],
    }).repository,
  });
  return { router, user: userEvent.setup() };
}
const modes = () =>
  within(screen.getByRole("group", { name: "Scenarios: run or create" }));

describe("running and creating scenarios", () => {
  it("opens on running, with a clear way to add a new scenario", async () => {
    const { router, user } = await open();
    expect(
      await screen.findByRole("region", { name: "Your scenarios" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Build a scenario" }),
    ).toBeNull();
    expect(modes().getByRole("button", { name: "Run" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(
      screen.getByRole("button", { name: "Add a new scenario" }),
    );
    expect(
      screen.getByRole("region", { name: "Build a scenario" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your scenarios" })).toBeNull();
    expect(router.state.location.search).toMatchObject({
      tab: "scenarios",
      mode: "create",
    });
  });

  it("explains what each part of a scenario expects", async () => {
    await open("/decks/deck-1?tab=scenarios&mode=create");
    const guide = within(
      await screen.findByRole("complementary", {
        name: "How a scenario works",
      }),
    );
    for (const part of [
      "When",
      "Starting with",
      "Each turn",
      "Look at",
      "Succeeds if",
    ])
      expect(guide.getByText(part)).toBeInTheDocument();
  });

  it("toggles between the two", async () => {
    const { user } = await open("/decks/deck-1?tab=scenarios&mode=create");
    await user.click(await modes().findByRole("button", { name: "Run" }));
    expect(
      await screen.findByRole("region", { name: "Your scenarios" }),
    ).toBeInTheDocument();
    await user.click(modes().getByRole("button", { name: "Create" }));
    expect(
      screen.getByRole("region", { name: "Build a scenario" }),
    ).toBeInTheDocument();
  });

  it("edits a saved scenario in create mode", async () => {
    const { user } = await open();
    await user.click(
      within(
        await screen.findByRole("region", { name: "Your scenarios" }),
      ).getByRole("button", { name: "Edit Blue" }),
    );
    expect(
      within(
        screen.getByRole("region", { name: "Build a scenario" }),
      ).getByRole("textbox", { name: "Name" }),
    ).toHaveValue("Blue");
  });
});
