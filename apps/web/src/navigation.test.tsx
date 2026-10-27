import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "./test/fakeAuthService.ts";
import { renderApp } from "./test/renderApp.tsx";

const users = {
  "scorer@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "user@test.local": { id: "u1", password: "pw", role: "user" as const },
  "admin@test.local": { id: "a1", password: "pw", role: "admin" as const },
};
const nav = () => within(screen.getByRole("navigation", { name: "Main" }));
// Account, Sign in and Sign out sit apart from the page tabs, so they stay in view on a phone.
const account = () =>
  within(screen.getByRole("navigation", { name: "Account" }));

describe("navigation", () => {
  it("shows public pages and Sign in when signed out", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    expect(nav().getByRole("link", { name: "Cards" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Build core" })).toBeInTheDocument();
    expect(
      account().getByRole("link", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Sign in" })).toBeNull();
    // Public decks can be browsed signed out.
    expect(nav().getByRole("link", { name: "Decks" })).toBeInTheDocument();
  });

  it("sends signed-out visitors from private pages to sign-in", async () => {
    const { router } = await renderApp({
      path: "/account",
      auth: fakeAuthService().service,
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/sign-in"),
    );
  });

  it("shows Reviews only to scorers", async () => {
    await renderApp({
      path: "/",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "scorer@test.local" },
      }).service,
    });
    expect(
      await nav().findByRole("link", { name: "Reviews" }),
    ).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Decks" })).toBeInTheDocument();
  });

  it("keeps regular users out of Reviews", async () => {
    const { router } = await renderApp({
      path: "/needs-review",
      auth: fakeAuthService({
        users,
        signedIn: { id: "u1", email: "user@test.local" },
      }).service,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(
      nav().queryByRole("link", { name: "Reviews" }),
    ).not.toBeInTheDocument();
  });

  it("moves between pages", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    await userEvent.setup().click(nav().getByRole("link", { name: "Cards" }));
    expect(
      await screen.findByRole("heading", { name: "Cards" }),
    ).toBeInTheDocument();
  });

  it("signs out", async () => {
    const fake = fakeAuthService({
      users,
      signedIn: { id: "u1", email: "user@test.local" },
    });
    await renderApp({ path: "/", auth: fake.service });
    await userEvent
      .setup()
      .click(await account().findByRole("button", { name: "Sign out" }));
    expect(
      await account().findByRole("link", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(fake.calls).toContain("signOut");
  });

  // The maintainer, 20 Oct 2026: the ranking is renamed Core. Old links keep working.
  it("sends an old /ranking link to /core, settings and all", async () => {
    const { router } = await renderApp({
      path: "/ranking?tab=board&risk=-50",
      auth: fakeAuthService().service,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/core"));
    expect(router.state.location.search).toMatchObject({
      tab: "board",
      risk: -50,
    });
  });

  it("marks the current page's tab, and the wordmark links home", async () => {
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
    expect(nav().getByRole("link", { name: "Cards" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav().getByRole("link", { name: "Build core" })).not.toHaveAttribute(
      "aria-current",
    );
    const banner = within(screen.getByRole("banner"));
    expect(
      banner.getByRole("link", { name: "Viserai Deck Builder, home" }),
    ).toHaveAttribute("href", "/");
  });

  it("orders the page tabs Cards, Reviews, Synergies, Build core, Decks", async () => {
    await renderApp({
      path: "/",
      auth: fakeAuthService({
        users,
        signedIn: { id: "a1", email: "admin@test.local" },
      }).service,
    });
    await nav().findByRole("link", { name: "Reviews" });
    expect(
      nav()
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Cards", "Reviews", "Synergies", "Build core", "Decks"]);
  });

  const asAdmin = () =>
    fakeAuthService({
      users,
      signedIn: { id: "a1", email: "admin@test.local" },
    }).service;

  it("shows no Admin menu to anyone but admins", async () => {
    await renderApp({
      path: "/",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "scorer@test.local" },
      }).service,
    });
    await nav().findByRole("link", { name: "Reviews" });
    expect(account().queryByRole("button", { name: "Admin" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Synergy weights" })).toBeNull();
  });

  it("opens an Admin menu with Synergy weights and User analytics, beside Account", async () => {
    await renderApp({ path: "/", auth: asAdmin() });
    const user = userEvent.setup();
    const button = await account().findByRole("button", { name: "Admin" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Synergy weights" })).toBeNull();
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(
      account().getByRole("link", { name: "Synergy weights" }),
    ).toHaveAttribute("href", "/admin/synergy");
    expect(
      account().getByRole("link", { name: "User analytics" }),
    ).toHaveAttribute("href", "/admin/analytics");
  });

  it("closes the Admin menu on Escape, on an outside click and after choosing a page", async () => {
    await renderApp({ path: "/", auth: asAdmin() });
    const user = userEvent.setup();
    const button = await account().findByRole("button", { name: "Admin" });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "User analytics" })).toBeNull();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole("link", { name: "User analytics" })).toBeNull();
    await user.click(button);
    await user.click(screen.getByRole("link", { name: "User analytics" }));
    expect(screen.queryByRole("link", { name: "User analytics" })).toBeNull();
  });
});

// Keyboard pass (M8): a new page is named in the browser tab and announced by moving focus to
// its heading, so screen readers say where you've landed.
describe("moving between pages", () => {
  it("names the browser tab after the page", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(document.title).toBe("Viserai Deck Builder"));
    await userEvent.setup().click(nav().getByRole("link", { name: "Cards" }));
    await waitFor(() =>
      expect(document.title).toBe("Cards · Viserai Deck Builder"),
    );
  });

  it("moves focus to the new page's heading, but not on the first page", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    const home = await screen.findByRole("heading", { level: 1 });
    expect(home).not.toHaveFocus();
    await userEvent.setup().click(nav().getByRole("link", { name: "Decks" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Decks" }),
      ).toHaveFocus(),
    );
  });

  it("leaves focus where it is when only the query changes", async () => {
    const { router } = await renderApp({
      path: "/cards",
      auth: fakeAuthService().service,
    });
    await screen.findByRole("heading", { level: 1, name: "Cards" });
    const search = screen.getByRole("searchbox", { name: "Search" });
    const user = userEvent.setup();
    await user.click(search);
    await user.type(search, "hocus");
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ q: "hocus" }),
    );
    expect(search).toHaveFocus();
  });
});
