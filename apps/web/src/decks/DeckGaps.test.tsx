// Gaps on the deck's own Gaps tab, each gap a card (README "Deck analysis", phase two step 3;
// moved off Stats at the maintainer's request, 19 Oct 2026).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
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
  beforeEach(() => localStorage.clear());
  it("waits for goals and runs only the selected checks", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: withDeck([card("hp3", 3), card("ff2", 5)]).repository,
    });
    const panel = await gaps();
    expect(panel.queryByRole("article")).toBeNull();
    const user = userEvent.setup();
    await user.click(
      panel.getByRole("button", { name: "Runechant generation" }),
    );
    await user.click(panel.getByRole("button", { name: "Run analysis" }));
    expect(
      panel.getByRole("article", { name: "Runechant generation" }),
    ).toBeInTheDocument();
    expect(
      panel.queryByRole("article", { name: "Gate generation" }),
    ).toBeNull();
    await user.click(panel.getByRole("button", { name: "Gate generation" }));
    expect(panel.queryByRole("article")).toBeNull();
  });

  it("shows sideboard support separately and offers additions from the pool", async () => {
    const fake = withDeck([{ ...card("hp3", 3), sideboard: true }]);
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: fake.repository,
    });
    const panel = await gaps();
    const user = userEvent.setup();
    await user.click(
      panel.getByRole("button", { name: "Runechant generation" }),
    );
    await user.click(panel.getByRole("button", { name: "Run analysis" }));
    const result = within(
      panel.getByRole("article", { name: "Runechant generation" }),
    );
    expect(
      result.getByText("Main deck: 0 copies. Sideboard: 3 copies."),
    ).toBeInTheDocument();
    expect(result.getByText("Available in your sideboard")).toBeInTheDocument();
    await user.click(
      result.getByRole("button", { name: "Add Hocus Pocus (yellow)" }),
    );
    await waitFor(() => expect(fake.saved).toContain("set deck-1 hp2 1 main"));
  });

  it("remembers goals for this deck and tolerates invalid stored preferences", async () => {
    localStorage.setItem(
      "vdb:gap-goals:deck-1",
      JSON.stringify(["gate", "obsolete"]),
    );
    localStorage.setItem(
      "vdb:gap-goals:another-deck",
      JSON.stringify(["runechant"]),
    );
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: withDeck([]).repository,
    });
    const panel = await gaps();
    expect(
      panel.getByRole("button", { name: "Gate generation" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      panel.getByRole("button", { name: "Runechant generation" }),
    ).toHaveAttribute("aria-pressed", "false");
    await userEvent
      .setup()
      .click(panel.getByRole("button", { name: "Disruption" }));
    expect(JSON.parse(localStorage.getItem("vdb:gap-goals:deck-1")!)).toEqual([
      "gate",
      "disruption",
    ]);
  });

  it("shows an absent selected goal without declaring the whole deck gap-free", async () => {
    localStorage.setItem("vdb:gap-goals:deck-1", "invalid JSON");
    await renderApp({
      path: "/decks/deck-1?tab=gaps",
      auth: auth(),
      decks: withDeck([]).repository,
    });
    const panel = await gaps();
    expect(panel.getByRole("button", { name: "Run analysis" })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(panel.getByRole("button", { name: "Gate generation" }));
    await user.click(panel.getByRole("button", { name: "Run analysis" }));
    expect(
      panel.getByText("No recorded support in this deck or sideboard"),
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
