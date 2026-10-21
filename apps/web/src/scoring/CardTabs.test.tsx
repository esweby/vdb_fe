import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { resolveCardTab } from "./cardTabs.ts";

const path = "/cards/card-become-the-shadow-lord";
const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};
const scorer = () =>
  fakeAuthService({ users, signedIn: { id: "s1", email: "s@test.local" } })
    .service;
const selectedTab = () =>
  screen
    .getAllByRole("tab")
    .find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

describe("resolveCardTab", () => {
  it("reads a known tab and falls back to the viewer's default otherwise", () => {
    expect(resolveCardTab("real-games", false)).toBe("real-games");
    expect(resolveCardTab("synergy", true)).toBe("synergy");
    expect(resolveCardTab(undefined, false)).toBe("overview");
    expect(resolveCardTab(undefined, true)).toBe("scoring");
    expect(resolveCardTab("nonsense", false)).toBe("overview");
    expect(resolveCardTab("nonsense", true)).toBe("scoring");
    expect(resolveCardTab(3, true)).toBe("scoring");
  });
});

describe("card page tabs", () => {
  it("lists Overview, Scoring, Synergy and In real games, with the card beside them", async () => {
    await renderApp({ path, auth: fakeAuthService().service });
    const tabs = within(
      await screen.findByRole("tablist", { name: "Card information" }),
    );
    expect(tabs.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Overview",
      "Scoring",
      "Synergy",
      "In real games",
    ]);
    // The card and its pitches sit outside the tabs.
    expect(screen.getByRole("region", { name: "Card" })).toBeInTheDocument();
  });

  it("opens on the tab in the URL", async () => {
    await renderApp({ path: `${path}?tab=real-games`, auth: scorer() });
    const panel = await screen.findByRole("tabpanel", {
      name: "In real games",
    });
    expect(selectedTab()).toBe("In real games");
    expect(
      within(panel).getByRole("region", { name: "In real games" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scores" })).toBeNull();
  });

  it("opens on Overview for anyone who isn't a scorer, missing or unknown tab alike", async () => {
    await renderApp({
      path: `${path}?tab=bogus`,
      auth: fakeAuthService().service,
    });
    const panel = await screen.findByRole("tabpanel", { name: "Overview" });
    expect(selectedTab()).toBe("Overview");
    expect(
      within(panel).getByRole("region", { name: "Details" }),
    ).toBeInTheDocument();
  });

  it("opens on Scoring for a scorer, with their ratings and the scoring group's", async () => {
    await renderApp({ path, auth: scorer() });
    const panel = await screen.findByRole("tabpanel", { name: "Scoring" });
    expect(
      within(panel).getByRole("region", { name: "Scores" }),
    ).toBeInTheDocument();
    expect(
      await within(panel).findByRole("slider", { name: "Overall" }),
    ).toBeInTheDocument();
  });

  it("keeps the tab in the URL without adding to the history", async () => {
    const { router } = await renderApp({ path, auth: scorer() });
    const user = userEvent.setup();
    await screen.findByRole("tabpanel", { name: "Scoring" });
    const before = router.history.length;
    await user.click(screen.getByRole("tab", { name: "In real games" }));
    await screen.findByRole("tabpanel", { name: "In real games" });
    expect(router.state.location.search).toEqual({ tab: "real-games" });
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    await screen.findByRole("tabpanel", { name: "Overview" });
    expect(router.state.location.search).toEqual({ tab: "overview" });
    expect(router.history.length).toBe(before);
  });

  it("moves between tabs with the arrow keys, Home and End", async () => {
    await renderApp({ path: `${path}?tab=overview`, auth: scorer() });
    const user = userEvent.setup();
    const overview = await screen.findByRole("tab", { name: "Overview" });
    // Only the selected tab is in the tab order.
    expect(overview).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Scoring" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    overview.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Scoring" })).toHaveFocus();
    expect(selectedTab()).toBe("Scoring");
    await user.keyboard("{End}");
    expect(selectedTab()).toBe("In real games");
    await user.keyboard("{ArrowRight}");
    expect(selectedTab()).toBe("Overview");
    await user.keyboard("{ArrowLeft}");
    expect(selectedTab()).toBe("In real games");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("puts the related cards and this card's quick question under Synergy", async () => {
    await renderApp({ path: `${path}?tab=synergy`, auth: scorer() });
    const panel = await screen.findByRole("tabpanel", { name: "Synergy" });
    expect(
      await within(panel).findByRole("region", { name: "Related cards" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: /synergy explorer/i }),
    ).toHaveAttribute("href", "/synergies?card=card-become-the-shadow-lord");
  });
});

describe("card pop-over tabs", () => {
  it("shows the same tabs, kept in the list's URL as cardTab, with a full-page link", async () => {
    const { router } = await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord&cardTab=real-games",
      auth: scorer(),
      scores: fakeScoreRepository().repository,
    });
    const user = userEvent.setup();
    const dialog = within(
      await screen.findByRole("dialog", { name: "Become the Shadow Lord" }),
    );
    expect(
      await dialog.findByRole("tabpanel", { name: "In real games" }),
    ).toBeInTheDocument();
    expect(
      dialog.getByRole("link", { name: "Open full page" }),
    ).toHaveAttribute(
      "href",
      "/cards/card-become-the-shadow-lord?tab=real-games",
    );
    await user.click(dialog.getByRole("tab", { name: "Overview" }));
    expect(router.state.location.search).toMatchObject({
      card: "card-become-the-shadow-lord",
      cardTab: "overview",
    });
    expect(
      dialog.getByRole("link", { name: "Open full page" }),
    ).toHaveAttribute(
      "href",
      "/cards/card-become-the-shadow-lord?tab=overview",
    );
  });

  it("keeps the chosen tab when stepping to the next card", async () => {
    await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord&cardTab=overview",
      auth: scorer(),
      scores: fakeScoreRepository().repository,
    });
    const user = userEvent.setup();
    const dialog = within(
      await screen.findByRole("dialog", { name: "Become the Shadow Lord" }),
    );
    await user.click(dialog.getByRole("button", { name: "Next card" }));
    const next = within(
      await screen.findByRole("dialog", { name: "Hocus Pocus" }),
    );
    expect(next.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("arrow keys on the tabs switch tabs, not cards", async () => {
    await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord&cardTab=overview",
      auth: scorer(),
      scores: fakeScoreRepository().repository,
    });
    const user = userEvent.setup();
    const dialog = within(
      await screen.findByRole("dialog", { name: "Become the Shadow Lord" }),
    );
    dialog.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(dialog.getByRole("tab", { name: "Scoring" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(
      screen.getByRole("dialog", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
  });
});
