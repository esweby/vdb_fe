import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};
const auth = () =>
  fakeAuthService({ users, signedIn: { id: "s1", email: "s@test.local" } })
    .service;
const names = (section: HTMLElement) =>
  within(section)
    .getAllByRole("link")
    .map((l) => l.textContent);

describe("needs review page", () => {
  it("lists unreviewed Runeblade and Shadow cards first, then generics", async () => {
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository().repository,
    });
    const classCards = await screen.findByRole("region", {
      name: "Runeblade and Shadow",
    });
    expect(names(classCards)).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
      "Nebula Blade",
    ]);
    expect(names(screen.getByRole("region", { name: "Generic" }))).toEqual([
      "Fate Foreseen",
    ]);
  });

  it("puts the newest cards first in each section, generics last, with their set", async () => {
    const released: Record<string, [string, string]> = {
      "card-hocus-pocus": ["Rosetta", "2024-09-20"],
      "card-nebula-blade": ["Arcane Rising", "2020-03-27"],
      "card-fate-foreseen": ["Welcome to Rathe", "2019-10-11"],
    };
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository().repository,
      cards: fakeCardRepository(
        sampleCards.map((c) => ({
          ...c,
          firstSet: released[c.id]?.[0] ?? null,
          firstReleased: released[c.id]?.[1] ?? null,
        })),
      ),
    });
    const classCards = await screen.findByRole("region", {
      name: "Runeblade and Shadow",
    });
    // Newest first; a card without a release date comes after the dated ones.
    expect(names(classCards)).toEqual([
      "Hocus Pocus",
      "Nebula Blade",
      "Become the Shadow Lord",
    ]);
    expect(
      within(classCards).getByText("Hocus Pocus").closest("li"),
    ).toHaveTextContent("Rosetta");
    expect(names(screen.getByRole("region", { name: "Generic" }))).toEqual([
      "Fate Foreseen",
    ]);
    // Start reviewing follows the same order.
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Start reviewing" }));
    expect(
      await screen.findByRole("dialog", { name: "Hocus Pocus" }),
    ).toBeInTheDocument();
  });

  it("leaves out cards I've reviewed and shows how many are left", async () => {
    const fake = fakeScoreRepository([], {
      reviewedCardIds: ["card-hocus-pocus"],
    });
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fake.repository,
    });
    const classCards = await screen.findByRole("region", {
      name: "Runeblade and Shadow",
    });
    expect(names(classCards)).toEqual([
      "Become the Shadow Lord",
      "Nebula Blade",
    ]);
    expect(screen.getByText("3 cards left to review")).toBeInTheDocument();
  });

  it("opens a card in the pop-over without leaving Needs review", async () => {
    const { router } = await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository().repository,
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Hocus Pocus" }));
    expect(
      await screen.findByRole("dialog", { name: "Hocus Pocus" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/needs-review");
    expect(router.state.location.search).toMatchObject({
      card: "card-hocus-pocus",
    });
  });

  it("starts at the first card to review and says where you are", async () => {
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository().repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Start reviewing" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Become the Shadow Lord",
    });
    expect(within(dialog).getByText("1 of 4")).toBeInTheDocument();
  });

  it("marks reviewed and moves to the next card, dropping the reviewed one from the list", async () => {
    const scores = fakeScoreRepository();
    await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord",
      auth: auth(),
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
    const summary = await screen.findByRole("dialog", {
      name: "Mark reviewed",
    });
    await user.click(
      within(summary).getByRole("button", { name: "Confirm review" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Hocus Pocus" }),
    ).toBeInTheDocument();
    expect(scores.saved).toContain("review card-become-the-shadow-lord");
    expect(
      names(screen.getByRole("region", { name: "Runeblade and Shadow" })),
    ).toEqual(["Hocus Pocus", "Nebula Blade"]);
    expect(screen.getByText("3 cards left to review")).toBeInTheDocument();
  });

  it("works through cards from the keyboard: rate, Ctrl+Enter, Enter, next card", async () => {
    const scores = fakeScoreRepository();
    await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord",
      auth: auth(),
      scores: scores.repository,
    });
    const user = userEvent.setup();
    const dialog = await screen.findByRole("dialog", {
      name: "Become the Shadow Lord",
    });
    // Focus starts on the first rating, not Close.
    const overall = await within(dialog).findByRole("slider", {
      name: "Overall",
    });
    await waitFor(() => expect(overall).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    // Ctrl+Enter (or Cmd+Enter) asks to mark reviewed; Confirm review has focus.
    await user.keyboard("{Control>}{Enter}{/Control}");
    const summary = await screen.findByRole("dialog", {
      name: "Mark reviewed",
    });
    expect(
      within(summary).getByRole("button", { name: "Confirm review" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    const next = await screen.findByRole("dialog", { name: "Hocus Pocus" });
    expect(scores.saved).toContain("review card-become-the-shadow-lord");
    await waitFor(() =>
      expect(
        within(next).getByRole("slider", { name: "Overall" }),
      ).toHaveFocus(),
    );
  });

  // Maintainer, 19 Oct 2026: on a MacBook, typing a number and pressing Enter did nothing.
  it("works through cards with number keys and plain Enter", async () => {
    const scores = fakeScoreRepository();
    await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord",
      auth: auth(),
      scores: scores.repository,
    });
    const user = userEvent.setup();
    const dialog = await screen.findByRole("dialog", {
      name: "Become the Shadow Lord",
    });
    const overall = await within(dialog).findByRole("slider", {
      name: "Overall",
    });
    await waitFor(() => expect(overall).toHaveFocus());
    await user.keyboard("8");
    expect(overall).toHaveAttribute("aria-valuetext", "8");
    await user.keyboard("{Enter}");
    const summary = await screen.findByRole("dialog", {
      name: "Mark reviewed",
    });
    expect(
      within(summary).getByRole("button", { name: "Confirm review" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Hocus Pocus" });
    expect(scores.saved).toContain("review card-become-the-shadow-lord");
  });

  it("shows the keyboard shortcut beside Mark reviewed", async () => {
    await renderApp({
      path: "/needs-review?card=card-become-the-shadow-lord",
      auth: auth(),
      scores: fakeScoreRepository().repository,
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Become the Shadow Lord",
    });
    expect(
      await within(dialog).findByRole("button", {
        name: "Mark reviewed and next",
      }),
    ).toHaveAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
  });

  it("says when everything is reviewed", async () => {
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository([], {
        reviewedCardIds: [
          "card-hocus-pocus",
          "card-become-the-shadow-lord",
          "card-fate-foreseen",
          "card-nebula-blade",
        ],
      }).repository,
    });
    expect(
      await screen.findByText("You've reviewed every card. Thank you."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start reviewing" }),
    ).toBeNull();
  });
});
