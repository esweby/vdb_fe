// Step 7b (docs/rules-engine.md): the rules engine's reports on a deck's Scenarios tab, with
// coverage beside them.
import {
  fakeCardRepository,
  sampleCards,
  TEST_POCUS,
} from "../test/fakeCardRepository.ts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DeckCard } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});

async function open() {
  await renderApp({
    path: "/decks/deck-1?tab=scenarios",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        // Test Pocus: an unverified copy of Hocus Pocus, which is verified now (20 Oct 2026).
        cards: [card("bsl3", 3), card("tp1", 3), card("nb", 1)],
        pitchTargets: {},
      },
    ]).repository,
    cards: fakeCardRepository([...sampleCards, TEST_POCUS]),
  });
  return within(
    await screen.findByRole("region", { name: "Play by the rules" }),
  );
}

describe("play by the rules", () => {
  it("shows coverage before anything runs", async () => {
    const panel = await open();
    expect(
      panel.getByText("3 of 6 deck cards modelled (50%)."),
    ).toBeInTheDocument();
    expect(panel.getByText(/Not modelled yet: Test Pocus/)).toBeInTheDocument();
  });

  it("runs the baseline script and reports by turn, over completed runs", async () => {
    const panel = await open();
    await userEvent
      .setup()
      .click(panel.getByRole("button", { name: "Run by the rules" }));
    expect(
      await panel.findByText(
        /^\d[\d,]* runs · \d[\d,]* completed · 0 failed · seed 1 · rules data [0-9a-f]{8}$/,
      ),
    ).toBeInTheDocument();
    const table = within(panel.getByRole("table", { name: "By turn" }));
    expect(table.getAllByRole("row")).toHaveLength(4);
    expect(table.getByRole("row", { name: /^Turn 1/ })).toHaveTextContent(/%/);
  }, 20_000); // A batch of rules games: slow on a busy CI machine.
});
