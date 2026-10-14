import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { renderApp } from "../test/renderApp.tsx";

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
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
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
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    await userEvent.setup().type(screen.getByLabelText("Search"), "shadow");
    await waitFor(() => expect(rowNames()).toEqual(["Become the Shadow Lord"]));
  });

  it("includes and excludes with the sidebar, and keeps filters in the URL", async () => {
    const { router } = await renderApp({
      path: "/cards",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    const user = userEvent.setup();
    await user.click(filters().getByRole("button", { name: /^Pitch 3,/ }));
    expect(rowNames()).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Hocus Pocus",
    ]);
    // Generic: click twice to exclude
    await user.click(filters().getByRole("button", { name: /^Generic,/ }));
    await user.click(filters().getByRole("button", { name: /^Generic,/ }));
    expect(rowNames()).toEqual(["Become the Shadow Lord", "Hocus Pocus"]);
    expect(router.state.location.search).toEqual({
      inc: ["pitch:3"],
      exc: ["class:Generic"],
    });
  });

  it("restores filters from the URL", async () => {
    await renderApp({
      path: "/cards?inc=%5B%22keywords%3Ago_again%22%5D",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("table", { name: /cards/i });
    expect(rowNames()).toEqual(["Become the Shadow Lord"]);
    expect(
      screen.getByRole("button", { name: "Remove Include: Go again" }),
    ).toBeInTheDocument();
  });

  it("shows how many cards match", async () => {
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
    await screen.findByRole("link", { name: "Hocus Pocus" });
    expect(screen.getByText("4 of 4 cards")).toBeInTheDocument();
  });

  it("links each card to its page", async () => {
    const { router } = await renderApp({
      path: "/cards",
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
});
