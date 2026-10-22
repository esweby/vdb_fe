// Review engagement by area, for admins (maintainer, 22 Oct 2026).
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeEngagementRepository } from "../test/fakeEngagementRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "a@test.local": { id: "a1", password: "pw", role: "admin" as const },
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};
const auth = (email: keyof typeof users) =>
  fakeAuthService({ users, signedIn: { id: users[email].id, email } }).service;

const engagement = fakeEngagementRepository(
  [
    {
      area: "Card scoring",
      people: 4,
      items: 90,
      itemsPerPerson: 22.5,
      peopleLast7d: 3,
      itemsLast7d: 40,
      first: "2026-10-15T10:00:00Z",
      latest: "2026-10-22T09:00:00Z",
    },
    {
      area: "Strategy questions",
      people: 0,
      items: 0,
      itemsPerPerson: null,
      peopleLast7d: 0,
      itemsLast7d: 0,
      first: null,
      latest: null,
    },
  ],
  [{ day: "2026-10-22", area: "Card scoring", people: 2, items: 12 }],
  { users: 31, usersLast7d: 5, decks: 47, publicDecks: 9 },
);

describe("user analytics page", () => {
  it("is for admins only: anyone else goes home", async () => {
    const { router } = await renderApp({
      path: "/admin/analytics",
      auth: auth("s@test.local"),
      engagement,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("shows the site totals above the tables", async () => {
    await renderApp({
      path: "/admin/analytics",
      auth: auth("a@test.local"),
      engagement,
    });
    const totals = within(
      await screen.findByRole("group", { name: "Site totals" }),
    );
    expect(totals.getByText("Users").nextSibling).toHaveTextContent("31");
    expect(totals.getByText("Joined in 7 days").nextSibling).toHaveTextContent(
      "5",
    );
    expect(totals.getByText("Decks built").nextSibling).toHaveTextContent("47");
    expect(totals.getByText("Public decks").nextSibling).toHaveTextContent("9");
  });

  it("shows each area's people and items, and the daily counts", async () => {
    await renderApp({
      path: "/admin/analytics",
      auth: auth("a@test.local"),
      engagement,
    });
    const areas = within(
      await screen.findByRole("table", { name: "Engagement by area" }),
    );
    const row = areas
      .getByRole("cell", { name: "Card scoring" })
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("90")).toBeInTheDocument();
    expect(within(row).getByText("22.5")).toBeInTheDocument();
    const empty = areas
      .getByRole("cell", { name: "Strategy questions" })
      .closest("tr") as HTMLElement;
    expect(within(empty).getAllByText("–").length).toBeGreaterThan(0);
    const daily = screen.getByRole("table", { name: /by day/i });
    expect(within(daily).getByText("12")).toBeInTheDocument();
    expect(
      screen.getByText(/Quick review vs card page isn't recorded/),
    ).toBeInTheDocument();
  });
});
