import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { renderApp } from "../test/renderApp.tsx";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";

const table = () => screen.getByRole("table", { name: /cards/i });
const rowNames = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]!.textContent);
const filters = () =>
  within(screen.getByRole("complementary", { name: "Filters" }));

describe("cards page", () => {
  it("lists cards with their details", async () => {
    await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByRole("link", { name: "Hocus Pocus" }),
    ).toBeInTheDocument();
    const row = screen
      .getByRole("link", { name: "Hocus Pocus" })
      .closest("tr")!;
    expect(within(row).getByText("Attack action")).toBeInTheDocument();
    expect(within(row).getByText("1 2 3")).toBeInTheDocument();
  });

  it("searches by name", async () => {
    await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    await userEvent.setup().type(screen.getByLabelText("Search"), "shadow");
    await waitFor(() => expect(rowNames()).toEqual(["Become the Shadow Lord"]));
  });

  it("narrows to the selected pitches and classes, and keeps them in the URL", async () => {
    const { router } = await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    const user = userEvent.setup();
    const pitch = within(screen.getByRole("group", { name: "Pitch" }));
    await user.click(pitch.getByRole("button", { name: "Blue" }));
    expect(rowNames()).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Hocus Pocus",
    ]);
    const cls = within(screen.getByRole("group", { name: "Class" }));
    await user.click(cls.getByRole("button", { name: "Shadow" }));
    expect(rowNames()).toEqual(["Become the Shadow Lord"]);
    expect(router.state.location.search.inc).toEqual(
      expect.arrayContaining(["pitch:3", "class:Shadow"]),
    );
    expect(screen.getByText(/Pitch: Blue · Class: Shadow/)).toBeInTheDocument();
  });

  it("restores filters from the URL", async () => {
    await renderApp({
      path: "/cards?inc=%5B%22keywords%3Ago_again%22%5D&view=list",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("table", { name: /cards/i });
    expect(rowNames()).toEqual(["Become the Shadow Lord"]);
    expect(filters().getByRole("checkbox", { name: "Go again" })).toBeChecked();
    expect(
      screen.getByText(/Only Go again/, { selector: "p *, p" }),
    ).toBeInTheDocument();
  });

  it("resets every filter from the line above the results", async () => {
    await renderApp({
      path: "/cards?inc=%5B%22keywords%3Ago_again%22%5D&exc=%5B%22pitch%3A1%22%5D&view=list",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("table", { name: /cards/i });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reset filters" }));
    expect(rowNames()).toHaveLength(4);
    expect(
      screen.queryByRole("button", { name: "Reset filters" }),
    ).not.toBeInTheDocument();
  });

  it("shows stand-in card tiles by default, one per pitch, and a list view", async () => {
    const { router } = await renderApp({
      path: "/cards",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByRole("article", { name: "Hocus Pocus (red)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Hocus Pocus (blue)" }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    // Selecting a pitch shows only that pitch's tiles
    await user.click(
      within(screen.getByRole("group", { name: "Pitch" })).getByRole("button", {
        name: "Blue",
      }),
    );
    expect(
      screen.queryByRole("article", { name: "Hocus Pocus (red)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Hocus Pocus (blue)" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "List" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: "list" }),
    );
    expect(screen.getByRole("table", { name: /cards/i })).toBeInTheDocument();
  });

  it("shows how many cards match", async () => {
    await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    expect(screen.getByText("4 of 4 cards")).toBeInTheDocument();
  });

  it("opens a card in a pop-over over the card database, and closes it again", async () => {
    const { router } = await renderApp({
      path: "/cards",
      auth: fakeAuthService().service,
    });
    const tile = await screen.findByRole("article", {
      name: "Hocus Pocus (red)",
    });
    const user = userEvent.setup();
    await user.click(within(tile).getByRole("link", { name: "Hocus Pocus" }));
    const dialog = await screen.findByRole("dialog", { name: "Hocus Pocus" });
    expect(router.state.location.pathname).toBe("/cards");
    expect(router.state.location.search).toMatchObject({
      card: "card-hocus-pocus",
    });
    // Side by side: the card, its details, and scoring
    for (const name of ["Card", "Details", "Scores"]) {
      expect(within(dialog).getByRole("region", { name })).toBeInTheDocument();
    }
    expect(
      within(within(dialog).getByRole("region", { name: "Card" })).getByRole(
        "article",
        { name: "Hocus Pocus (red)" },
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(router.state.location.search.card).toBeUndefined();
    expect(
      screen.getByRole("article", { name: "Hocus Pocus (red)" }),
    ).toBeInTheDocument();
  });

  it("shows the pitch that was clicked, and switches pitch in the pop-over", async () => {
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
    const tile = await screen.findByRole("article", {
      name: "Hocus Pocus (yellow)",
    });
    const user = userEvent.setup();
    await user.click(within(tile).getByRole("link", { name: "Hocus Pocus" }));
    const card = within(
      within(await screen.findByRole("dialog")).getByRole("region", {
        name: "Card",
      }),
    );
    expect(
      card.getByRole("article", { name: "Hocus Pocus (yellow)" }),
    ).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Blue" }));
    expect(
      card.getByRole("article", { name: "Hocus Pocus (blue)" }),
    ).toBeInTheDocument();
  });

  it("steps through the current results with Next and Previous card", async () => {
    await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("link", { name: "Become the Shadow Lord" }),
    );
    const dialog = () => screen.getByRole("dialog");
    await screen.findByRole("dialog", { name: "Become the Shadow Lord" });
    expect(
      within(dialog()).getByRole("button", { name: "Previous card" }),
    ).toBeDisabled();
    await user.click(
      within(dialog()).getByRole("button", { name: "Next card" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Fate Foreseen" }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog()).getByRole("button", { name: "Previous card" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
  });

  it("opens a card straight from a shared link", async () => {
    await renderApp({
      path: "/cards?card=card-nebula-blade",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByRole("dialog", { name: "Nebula Blade" }),
    ).toBeInTheDocument();
  });

  it("shows cost, power and defense, and sorts by them", async () => {
    const { router } = await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    const row = screen
      .getByRole("link", { name: "Hocus Pocus" })
      .closest("tr")!;
    expect(within(row).getByText("4 / 3 / 2")).toBeInTheDocument();
    await userEvent
      .setup()
      .selectOptions(screen.getByLabelText("Sort"), "power");
    await waitFor(() => expect(rowNames()[0]).toBe("Hocus Pocus"));
    expect(router.state.location.search).toMatchObject({ sort: "power" });
  });

  it("offers small and large cards, and a list", async () => {
    const { router } = await renderApp({
      path: "/cards",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("article", { name: "Hocus Pocus (red)" });
    const views = within(screen.getByRole("group", { name: "View" }));
    expect(views.getByRole("button", { name: "Small cards" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent
      .setup()
      .click(views.getByRole("button", { name: "Large cards" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: "large" }),
    );
    expect(screen.getByRole("list", { name: "Cards" })).toHaveAttribute(
      "data-size",
      "large",
    );
    expect(
      views.queryByRole("button", { name: "Larger cards" }),
    ).not.toBeInTheDocument();
  });

  it("loads more results under the ones shown, and starts again when filters change", async () => {
    // 70 single-pitch cards: 60 small tiles in the first batch
    const many = Array.from({ length: 70 }, (_, i) => ({
      ...sampleCards[1]!,
      id: `card-${i}`,
      name: `Card ${String(i).padStart(2, "0")}`,
      variants: [{ ...sampleCards[1]!.variants[0]!, id: `v-${i}` }],
    }));
    const { router } = await renderApp({
      path: "/cards",
      auth: fakeAuthService().service,
      cards: fakeCardRepository(many),
    });
    await screen.findByRole("article", { name: "Card 00 (blue)" });
    expect(screen.getAllByRole("article")).toHaveLength(60);
    expect(screen.getByText(/^Showing 60 of 70 cards/)).toBeInTheDocument();
    const user = userEvent.setup();
    const more = screen.getByRole("button", { name: /^Load more/ });
    expect(more).toHaveTextContent("10 left");
    await user.click(more);
    // The first batch stays; the rest is added under it
    expect(screen.getAllByRole("article")).toHaveLength(70);
    expect(
      screen.getByRole("article", { name: "Card 00 (blue)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Card 69 (blue)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Load more/ }),
    ).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ page: 2 });
    expect(
      screen.queryByRole("navigation", { name: "Pages" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), "Card 0");
    await waitFor(() =>
      expect(router.state.location.search.page).toBeUndefined(),
    );
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });

  it("closes the pop-over when clicking outside it, and stops the page scrolling while open", async () => {
    await renderApp({
      path: "/cards?card=card-nebula-blade",
      auth: fakeAuthService().service,
    });
    const dialog = await screen.findByRole("dialog", { name: "Nebula Blade" });
    expect(document.body.style.overflow).toBe("hidden");
    // A click inside doesn't close it
    await userEvent.setup().click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId("dialog-backdrop"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("shows where the card is in the results, and moves on with Skip", async () => {
    await renderApp({
      path: "/cards?view=list&card=card-become-the-shadow-lord",
      auth: fakeAuthService().service,
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Become the Shadow Lord",
    });
    expect(within(dialog).getByText("1 of 4")).toBeInTheDocument();
    // The keyboard tip lives on the ‹ › buttons' tooltips, not far away in the footer
    expect(
      within(dialog).queryByText(/to move between cards/),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Next card" }),
    ).toHaveAttribute("title", "Next card (→)");
    await userEvent
      .setup()
      .click(within(dialog).getByRole("button", { name: "Skip" }));
    expect(
      await screen.findByRole("dialog", { name: "Fate Foreseen" }),
    ).toBeInTheDocument();
  });

  it("marks a card reviewed and moves to the next one", async () => {
    const scores = fakeScoreRepository();
    await renderApp({
      path: "/cards?view=list&card=card-become-the-shadow-lord",
      auth: fakeAuthService({
        users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: scores.repository,
    });
    const user = userEvent.setup();
    const dialog = await screen.findByRole("dialog", {
      name: "Become the Shadow Lord",
    });
    await user.click(
      await within(dialog).findByRole("button", {
        name: "Mark reviewed and next",
      }),
    );
    // The review summary opens on top; Escape would close only it
    const summary = await screen.findByRole("dialog", {
      name: "Mark reviewed",
    });
    await user.click(
      within(summary).getByRole("button", { name: "Confirm review" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Fate Foreseen" }),
    ).toBeInTheDocument();
    expect(scores.saved).toContain("review card-become-the-shadow-lord");
  });

  it("closes only the review summary on Escape, not the card", async () => {
    await renderApp({
      path: "/cards?view=list&card=card-become-the-shadow-lord",
      auth: fakeAuthService({
        users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Mark reviewed and next" }),
    );
    await screen.findByRole("dialog", { name: "Mark reviewed" });
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Mark reviewed" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
  });

  it("keeps the page title and field labels for screen readers, with a compact toolbar", async () => {
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Cards" }),
    ).toHaveClass(/visuallyHidden/);
    expect(screen.getByLabelText("Search")).toHaveAttribute(
      "placeholder",
      "Search card names",
    );
  });
});
