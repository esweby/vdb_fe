// Gaps on the deck's own Gaps tab, each gap a card (README "Deck analysis", phase two step 3;
// moved off Stats at the maintainer's request, 19 Oct 2026).
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
const withDeck = (cards: DeckCard[]) =>
  fakeDeckRepository([
    {
      id: "deck-1",
      name: "Gate tempo",
      updatedAt: "2026-10-14T10:00:00Z",
      cards,
      pitchTargets: {},
    },
  ]);
const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});
const gaps = async () =>
  within(await screen.findByRole("region", { name: "Gaps" }));

describe("gaps", () => {
  it("names a role the deck relies on that's missing from a pitch it plays", async () => {
    // Red: Hocus Pocus and Fate Foreseen; blue: Become the Shadow Lord (the only Gate maker).
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: withDeck([
        card("hp1", 3),
        card("bsl3", 3),
        card("ff1", 2),
        card("ff3", 2),
      ]).repository,
    });
    const gap = within(
      (await gaps()).getByRole("article", { name: "No red Gate makers" }),
    );
    expect(
      gap.getByText("You play 5 red cards and 3 Gate makers."),
    ).toBeInTheDocument();
    expect(
      gap.getByText("Nothing in the card pool fills this yet."),
    ).toBeInTheDocument();
  });

  it("offers cards that would fill it, and adds one", async () => {
    // Blue Hocus Pocus is the only Runechant maker; yellow has 5 cards.
    const fake = withDeck([card("hp3", 3), card("ff2", 5), card("ff3", 2)]);
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: fake.repository,
    });
    const gap = within(
      (await gaps()).getByRole("article", {
        name: "No yellow Runechant makers",
      }),
    );
    expect(
      gap.getByText("You play 5 yellow cards and 3 Runechant makers."),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(gap.getByRole("button", { name: "Add Hocus Pocus (yellow)" }));
    await waitFor(() => expect(fake.saved).toContain("set deck-1 hp2 1 main"));
  });

  it("says when there are none", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: withDeck([card("hp1", 3), card("hp3", 3)]).repository,
    });
    expect(
      (await gaps()).getByText(
        "No gaps: every pitch you play has the makers your deck relies on.",
      ),
    ).toBeInTheDocument();
  });

  it("has its own tab, and isn't on Stats any more", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=stats",
      auth: auth(),
      decks: withDeck([card("hp1", 3), card("bsl3", 3)]).repository,
    });
    expect(
      await screen.findByRole("tab", { name: "Gaps" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Gaps" })).toBeNull();
  });
});
