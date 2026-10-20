// Phase two step 8 (README "Failed hands" and "Compare decks"): a failed run opens in goldfish
// on its exact shuffle, and saved scenarios run on two decks side by side.
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
// 60 cards, so no blanks: Hocus Pocus in each pitch, and Nebula Blade.
const FULL = [card("hp1", 20), card("hp2", 20), card("hp3", 20), card("nb", 1)];
const SMALL = [card("hp1", 3), card("bsl3", 2)];
const ALL_BLUE = [card("bsl3", 60)];

async function open(
  cards: DeckCard[],
  scenarios = fakeScenarioRepository(),
  path = "/decks/deck-1?tab=scenarios&mode=create",
) {
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
        cards,
        pitchTargets: {},
      },
      {
        id: "deck-2",
        name: "All blue",
        updatedAt: "2026-10-13T10:00:00Z",
        cards: ALL_BLUE,
        pitchTargets: {},
      },
    ]).repository,
    scenarios: scenarios.repository,
  });
  return { router, user: userEvent.setup() };
}
const builder = () =>
  within(screen.getByRole("region", { name: "Build a scenario" }));
const result = () =>
  within(screen.getByRole("region", { name: "Scenario result" }));

async function runFailing(user: ReturnType<typeof userEvent.setup>) {
  const block = within(builder().getByRole("group", { name: "Block 1" }));
  // Filters show only once added.
  await user.selectOptions(block.getByLabelText("Add a filter"), "Type");
  await user.selectOptions(block.getByLabelText("Type"), "instant");
  await user.click(
    builder().getByRole("button", { name: "Run this scenario" }),
  );
}

describe("failed hands", () => {
  it("opens a failed run in goldfish on its exact shuffle, fixed cards and all", async () => {
    const { router, user } = await open(FULL);
    await user.click(
      builder().getByRole("button", { name: "Add a fixed card" }),
    );
    await runFailing(user);
    const hands = within(
      await result().findByRole("list", { name: "Failed hands" }),
    );
    const first = hands.getAllByRole("link", { name: /Open in goldfish/ })[0]!;
    await user.click(first);
    expect(router.state.location.search).toMatchObject({
      tab: "goldfish",
      seed: expect.any(Number),
      fixed: expect.any(String),
    });
    const goldfish = within(
      (await screen.findAllByRole("region", { name: "Goldfish" })).at(-1)!,
    );
    // 60, one fixed in hand and three drawn.
    expect(
      goldfish.getByRole("heading", { name: "Deck · 56" }),
    ).toBeInTheDocument();
    expect(
      within(goldfish.getByRole("region", { name: "Hand" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(4);
  });

  it("opens failed hands for a main deck of any size: runs use the deck as built", async () => {
    const { user } = await open(SMALL);
    await runFailing(user);
    expect(
      await result().findByRole("list", { name: "Failed hands" }),
    ).toBeInTheDocument();
    expect(result().queryByText(/Fill the deck/)).toBeNull();
  });
});

const blue = (name: string): ScenarioDefinition => ({
  version: 1,
  name,
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition: {
    all: [{ label: "at least 1 blue card", filter: { pitch: 3 }, min: 1 }],
  },
});

describe("compare decks", () => {
  it("runs saved scenarios on another deck too, side by side with the same seed", async () => {
    const scenarios = fakeScenarioRepository({
      scenarios: [
        {
          id: "s1",
          userId: "u1",
          definition: blue("Blue"),
          visibility: "private",
        },
      ],
    });
    const { user } = await open(FULL, scenarios, "/decks/deck-1?tab=scenarios");
    const yours = within(
      await screen.findByRole("region", { name: "Your scenarios" }),
    );
    await user.selectOptions(
      await yours.findByLabelText("Compare with"),
      "deck-2",
    );
    await user.click(yours.getByRole("button", { name: "Run all" }));
    expect(
      await yours.findByRole("columnheader", { name: "On All blue" }),
    ).toBeInTheDocument();
    const row = yours.getByRole("row", { name: /Blue/ });
    expect(await within(row).findByText("100.0%")).toBeInTheDocument();
    expect(row).toHaveTextContent(/\+\d+\.\d pts/);
    expect(scenarios.results.map((r) => r.deckId).sort()).toEqual([
      "deck-1",
      "deck-2",
    ]);
  });
});
