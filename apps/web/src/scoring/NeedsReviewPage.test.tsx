import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
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
