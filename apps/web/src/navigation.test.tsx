import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "./test/fakeAuthService.ts";
import { renderApp } from "./test/renderApp.tsx";

const users = {
  "scorer@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "user@test.local": { id: "u1", password: "pw", role: "user" as const },
};
const nav = () => within(screen.getByRole("navigation", { name: "Main" }));
// Account, Sign in and Sign out sit apart from the page tabs, so they stay in view on a phone.
const account = () =>
  within(screen.getByRole("navigation", { name: "Account" }));

describe("navigation", () => {
  it("shows public pages and Sign in when signed out", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    expect(nav().getByRole("link", { name: "Cards" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Ranking" })).toBeInTheDocument();
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

  it("shows Needs review only to scorers", async () => {
    await renderApp({
      path: "/",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "scorer@test.local" },
      }).service,
    });
    expect(
      await nav().findByRole("link", { name: "Needs review" }),
    ).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Decks" })).toBeInTheDocument();
  });

  it("keeps regular users out of Needs review", async () => {
    const { router } = await renderApp({
      path: "/needs-review",
      auth: fakeAuthService({
        users,
        signedIn: { id: "u1", email: "user@test.local" },
      }).service,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(
      nav().queryByRole("link", { name: "Needs review" }),
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

  it("marks the current page's tab, and the wordmark links home", async () => {
    await renderApp({ path: "/cards", auth: fakeAuthService().service });
    expect(nav().getByRole("link", { name: "Cards" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav().getByRole("link", { name: "Ranking" })).not.toHaveAttribute(
      "aria-current",
    );
    const banner = within(screen.getByRole("banner"));
    expect(
      banner.getByRole("link", { name: "Viserai Deck Builder, home" }),
    ).toHaveAttribute("href", "/");
  });
});
