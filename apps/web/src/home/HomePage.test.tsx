import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const signedInAs = (role: "user" | "scorer") =>
  fakeAuthService({
    users: { "p@test.local": { id: "p1", password: "pw", role } },
    signedIn: { id: "p1", email: "p@test.local" },
  }).service;

describe("home page", () => {
  it("explains the app to a first-time visitor and offers a way in", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    expect(
      await screen.findByRole("heading", { level: 1, name: /Viserai/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/build Viserai decks around his engines/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the cards" }),
    ).toHaveAttribute("href", "/cards");
    expect(
      screen.getAllByRole("link", { name: "Sign in" }).length,
    ).toBeGreaterThan(0);
    // A first visit has no account yet: creating one is the main way in.
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/sign-in?mode=signup");
  });

  it("points a scorer to the cards they have left to review", async () => {
    await renderApp({
      path: "/",
      auth: signedInAs("scorer"),
      scores: fakeScoreRepository([], {
        reviewedCardIds: ["card-hocus-pocus"],
      }).repository,
    });
    expect(
      await screen.findByText("3 cards left to review"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue reviewing" }),
    ).toHaveAttribute("href", "/needs-review");
  });

  it("offers building a core to everyone signed in, and no review prompt to non-scorers", async () => {
    await renderApp({ path: "/", auth: signedInAs("user") });
    expect(
      await screen.findByRole("link", { name: "Build a core" }),
    ).toHaveAttribute("href", "/core");
    expect(
      screen.queryByRole("link", { name: "Continue reviewing" }),
    ).toBeNull();
  });
});
