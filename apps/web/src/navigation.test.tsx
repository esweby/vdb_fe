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

  it("puts Synergy weights beside Account, for admins", async () => {
    await renderApp({
      path: "/",
      auth: fakeAuthService({
        users,
        signedIn: { id: "a1", email: "admin@test.local" },
      }).service,
    });
    await account().findByRole("link", { name: "Synergy weights" });
    expect(
      account()
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Synergy weights", "Account"]);
    expect(nav().queryByRole("link", { name: "Synergy weights" })).toBeNull();
  });
});
