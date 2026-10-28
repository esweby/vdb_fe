// Keep the Cards tab focused on building the deck.
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

type Row = { variantId: string; quantity: number; sideboard: boolean };
const UNFINISHED: Row[] = [
  { variantId: "hp1", quantity: 3, sideboard: false },
  { variantId: "bsl3", quantity: 3, sideboard: false },
];

async function open(view: "tiles" | "list", cards: Row[] = UNFINISHED) {
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
        cards,
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

describe("Cards tab", () => {
  it.each(["tiles", "list"] as const)(
    "keeps %s focused on the deck without opening-hand analysis",
    async (view) => {
      const { deck, names } = await open(view);
      expect(names()).toEqual(["Hocus Pocus", "Become the Shadow Lord"]);
      expect(
        screen.getByRole("button", { name: "Card view" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "List view" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Support in opening hands" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /Check support|Work out availability/,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: "Sort the deck" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("checkbox", { name: /Only rarely/ }),
      ).not.toBeInTheDocument();
      expect(deck.queryByText(/available \d+%/)).not.toBeInTheDocument();
    },
  );
});
