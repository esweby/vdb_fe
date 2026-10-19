// The Stats tab's Condition availability panel (phase two step 7).
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

async function open() {
  await renderApp({
    path: "/decks/deck-1?tab=stats",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: [
          { variantId: "hp1", quantity: 3, sideboard: false },
          { variantId: "bsl3", quantity: 3, sideboard: false },
        ],
        pitchTargets: {},
      },
    ]).repository,
  });
  return within(
    await screen.findByRole("region", { name: "Condition availability" }),
  );
}

describe("condition availability", () => {
  it("works out how often each condition's need is in hand, with its assumptions", async () => {
    const panel = await open();
    expect(panel.getByText(/Opening hand of 4, hand only/)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(panel.getByRole("button", { name: "Work out availability" }));
    const row = await panel.findByRole("row", {
      name: /Become the Shadow Lord the banished card is Shadow/,
    });
    expect(row).toHaveTextContent("another Shadow card in hand to banish");
    // BSL ×3 and no other Shadow cards: with one in hand, another BSL is the only way.
    expect(within(row).getByText(/^\d+%$/)).toBeInTheDocument();
  });
});
