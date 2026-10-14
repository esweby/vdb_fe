import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { renderApp } from "../test/renderApp.tsx";
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
    expect(
      filters().getByRole("button", { name: "Only Go again" }),
    ).toHaveAttribute("aria-pressed", "true");
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

  it("links each card to its page", async () => {
    const { router } = await renderApp({
      path: "/cards?view=list",
      auth: fakeAuthService().service,
    });
    await userEvent
      .setup()
      .click(await screen.findByRole("link", { name: "Nebula Blade" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/cards/card-nebula-blade"),
    );
    expect(
      await screen.findByRole("heading", { name: "Nebula Blade" }),
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

  it("offers small, large and larger cards, and a list", async () => {
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
      .click(views.getByRole("button", { name: "Larger cards" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: "larger" }),
    );
    expect(screen.getByRole("list", { name: "Cards" })).toHaveAttribute(
      "data-size",
      "larger",
    );
  });

  it("pages through results, and goes back to page 1 when filters change", async () => {
    // 70 single-pitch cards: 60 small tiles fit on page 1
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
    expect(screen.getByText(/Showing 1–60 of 70/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ page: 2 }),
    );
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(
      screen.getByRole("article", { name: "Card 69 (blue)" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), "Card 0");
    await waitFor(() =>
      expect(router.state.location.search.page).toBeUndefined(),
    );
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });
});
