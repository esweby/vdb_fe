import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckCard } from "./deckRepository.ts";

const auth = () =>
  fakeAuthService({
    users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
    signedIn: { id: "u1", email: "u@test.local" },
  }).service;

const withDeck = (cards: DeckCard[] = []) =>
  fakeDeckRepository([
    {
      id: "deck-1",
      name: "Gate tempo",
      updatedAt: "2026-10-14T10:00:00Z",
      cards,
    },
  ]);

const region = (name: string) => within(screen.getByRole("region", { name }));

describe("decks list", () => {
  it("lists my decks and creates a new one", async () => {
    const fake = withDeck();
    const { router } = await renderApp({
      path: "/decks",
      auth: auth(),
      decks: fake.repository,
    });
    expect(
      await screen.findByRole("link", { name: "Gate tempo" }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New deck name"), "Runechant aggro");
    await user.click(screen.getByRole("button", { name: "Create deck" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/decks/deck-2"),
    );
    expect(fake.saved).toEqual(["create Runechant aggro"]);
  });
});

describe("deck page", () => {
  it("adds cards by searching, and changes quantities", async () => {
    const fake = withDeck();
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    expect(
      await screen.findByRole("heading", { name: "Gate tempo" }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Find cards"), "hocus");
    await user.click(
      screen.getByRole("button", { name: "Add Hocus Pocus (red)" }),
    );
    expect(region("Deck").getByText("Hocus Pocus")).toBeInTheDocument();
    await user.click(
      region("Deck").getByRole("button", {
        name: "One more Hocus Pocus (red)",
      }),
    );
    expect(
      region("Deck").getByLabelText("Copies of Hocus Pocus (red)"),
    ).toHaveTextContent("2");
    await user.click(
      region("Deck").getByRole("button", {
        name: "One fewer Hocus Pocus (red)",
      }),
    );
    await user.click(
      region("Deck").getByRole("button", {
        name: "One fewer Hocus Pocus (red)",
      }),
    );
    expect(region("Deck").queryByText("Hocus Pocus")).not.toBeInTheDocument();
    expect(fake.saved).toEqual([
      "set deck-1 hp1 1 main",
      "set deck-1 hp1 2 main",
      "set deck-1 hp1 1 main",
      "set deck-1 hp1 0 main",
    ]);
  });

  it("moves cards to the sideboard and back", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 2, sideboard: false },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Sideboard: Hocus Pocus (red)",
      }),
    );
    expect(region("Sideboard").getByText("Hocus Pocus")).toBeInTheDocument();
    expect(region("Deck").queryByText("Hocus Pocus")).not.toBeInTheDocument();
    expect(fake.saved).toEqual(["set deck-1 hp1 2 side"]);
  });

  it("shows weapons apart from the deck, and what makes the deck illegal", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 3, sideboard: false },
      { variantId: "nb", quantity: 1, sideboard: false },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    expect(
      await region("Weapons").findByText("Nebula Blade"),
    ).toBeInTheDocument();
    expect(region("Deck").queryByText("Nebula Blade")).not.toBeInTheDocument();
    expect(
      screen.getByText("3 deck cards · 0 sideboard · 4 in the pool"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The deck has 3 cards; it needs at least 60."),
    ).toBeInTheDocument();
  });

  it("says when a deck doesn't exist", async () => {
    await renderApp({
      path: "/decks/nope",
      auth: auth(),
      decks: withDeck().repository,
    });
    expect(
      await screen.findByRole("heading", { name: "Deck not found" }),
    ).toBeInTheDocument();
  });
});
