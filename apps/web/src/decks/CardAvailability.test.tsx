// Condition availability in the Cards tab's card list (README "Deck builder"): worked out on
// demand, then shown on each card, and the deck sorted or filtered by it.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

async function open(view: "tiles" | "list") {
  await renderApp({
    path: `/decks/deck-1${view === "list" ? "?view=list" : ""}`,
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
  const deck = await screen.findByRole("region", { name: "Deck" });
  const names = () =>
    within(deck)
      .getAllByRole("listitem")
      .map((li) => within(li).getAllByRole("link")[0]!.textContent);
  return { deck: within(deck), names };
}

describe("condition availability in the card list", () => {
  it("isn't worked out until asked, then shows on a card with a condition", async () => {
    const { deck } = await open("list");
    expect(deck.queryByText(/available \d+%/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort the deck" })).toBeDisabled();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Work out availability" }));
    const shown = await deck.findByText(/^available \d+%$/);
    // Become the Shadow Lord has two conditions; the lowest is shown, each in the title.
    expect(shown.closest("li")).toHaveTextContent("Become the Shadow Lord");
    expect(shown).toHaveAttribute(
      "title",
      expect.stringMatching(/the banished card is Shadow: \d+%/),
    );
    // Hocus Pocus has no condition to measure.
    expect(deck.getAllByText(/^available \d+%$/)).toHaveLength(1);
  });

  it("sorts the deck by availability and filters it to rarely available cards", async () => {
    const { names } = await open("tiles");
    const user = userEvent.setup();
    // By pitch: Hocus Pocus (red) first.
    expect(names()).toEqual(["Hocus Pocus", "Become the Shadow Lord"]);

    await user.click(
      screen.getByRole("button", { name: "Work out availability" }),
    );
    const sort = screen.getByRole("combobox", { name: "Sort the deck" });
    await screen.findByText(/^available \d+%$/);
    await user.selectOptions(sort, "Availability, lowest first");
    expect(names()).toEqual(["Become the Shadow Lord", "Hocus Pocus"]);

    // Three copies in 60 cards: another Shadow card is rarely in hand with it.
    await user.click(
      screen.getByRole("checkbox", { name: /Only rarely available \(under 25%\)/ }),
    );
    expect(names()).toEqual(["Become the Shadow Lord"]);
  });
});
