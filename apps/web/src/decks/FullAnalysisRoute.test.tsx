import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const auth = () =>
  fakeAuthService({
    users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
    signedIn: { id: "u1", email: "u@test.local" },
  }).service;

describe("Full analysis route", () => {
  it("opens as its own deck tab", async () => {
    const { router } = await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fakeDeckRepository([
        {
          id: "deck-1",
          name: "Gate tempo",
          updatedAt: "2026-10-14T10:00:00Z",
          cards: [],
          pitchTargets: {},
        },
      ]).repository,
    });

    await userEvent
      .setup()
      .click(await screen.findByRole("tab", { name: "Analysis" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: "analysis" }),
    );
    expect(screen.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "Full analysis" }),
    ).toBeInTheDocument();
  });
});
