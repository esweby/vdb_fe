// Synergies tabs in Build a core and the deck page (maintainer, 19 Oct 2026): the explorer on
// your core or deck, with the cards that link to nothing else in it and the cards outside it
// that link to it most. The graph is swapped for a list (no WebGL in jsdom).
// Sample cards: Become the Shadow Lord → Hocus Pocus is the only rule link.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DeckCard } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { ExplorerNode } from "./explorer.ts";

vi.mock("./GraphCanvas.tsx", () => ({
  GraphCanvas: (props: {
    nodes: ExplorerNode[];
    onSelect: (id: string) => void;
  }) => (
    <ul aria-label="Graph">
      {props.nodes.map((n) => (
        <li key={n.id}>
          <button type="button" onClick={() => props.onSelect(n.id)}>
            {n.name}
            {n.inCore ? " (in scope)" : ""}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

const graph = () =>
  within(screen.getByRole("list", { name: "Graph" }))
    .queryAllByRole("button")
    .map((b) => b.textContent);
const panel = () =>
  within(screen.getByRole("complementary", { name: "Explore" }));
const items = (name: string) =>
  within(panel().getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("Synergies tab in Build a core", () => {
  const core = encodeURIComponent(JSON.stringify({ hp3: 3 }));

  it("shows your core and what links to it", async () => {
    await renderApp({
      path: `/ranking?tab=synergies&core=${core}`,
      auth: fakeAuthService().service,
    });
    expect(screen.getByRole("tab", { name: /Synergies/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() =>
      expect(graph()).toEqual([
        "Hocus Pocus (in scope)",
        "Become the Shadow Lord",
      ]),
    );
  });

  it("lists your core's cards that link to nothing else in it, and the cards that link to it most", async () => {
    await renderApp({
      path: `/ranking?tab=synergies&core=${core}`,
      auth: fakeAuthService().service,
    });
    await waitFor(() =>
      expect(items("Links to nothing else in your core")).toEqual([
        "Hocus Pocus",
      ]),
    );
    expect(items("Links most to your core")[0]).toMatch(
      /Become the Shadow Lord.*links to 1 of your cards/,
    );
  });

  it("selects a card and goes back, without leaving the tab", async () => {
    const { router } = await renderApp({
      path: `/ranking?tab=synergies&core=${core}`,
      auth: fakeAuthService().service,
    });
    const user = userEvent.setup();
    await user.click(
      await within(
        await screen.findByRole("list", { name: "Graph" }),
      ).findByRole("button", { name: "Become the Shadow Lord" }),
    );
    expect(
      await panel().findByRole("heading", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
    await user.click(panel().getByRole("button", { name: "Back" }));
    expect(
      panel().queryByRole("heading", { name: "Become the Shadow Lord" }),
    ).toBeNull();
    expect(router.state.location.search).toMatchObject({ tab: "synergies" });
  });

  it("asks for a core first", async () => {
    await renderApp({
      path: "/ranking?tab=synergies",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByText("Add cards to your core to see how they link."),
    ).toBeInTheDocument();
  });
});

describe("Synergies tab on a deck", () => {
  const deck = (cards: DeckCard[]) =>
    fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards,
        pitchTargets: {},
      },
    ]).repository;
  const auth = () =>
    fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service;

  it("shows the deck's cards and how they link", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=synergies",
      auth: auth(),
      decks: deck([
        { variantId: "hp1", quantity: 3, sideboard: false },
        { variantId: "bsl3", quantity: 3, sideboard: false },
      ]),
    });
    expect(
      await screen.findByRole("tab", { name: "Synergies" }),
    ).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(graph()).toEqual([
        "Hocus Pocus (in scope)",
        "Become the Shadow Lord (in scope)",
      ]),
    );
    expect(
      panel().getByText("Every card links to another in this deck."),
    ).toBeInTheDocument();
  });
});
