import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "./test/fakeAuthService.ts";
import { fakeDeckRepository } from "./test/fakeDeckRepository.ts";
import { renderApp } from "./test/renderApp.tsx";

// The forms match the database's limits (security audit, 16 Oct 2026), so people meet them as
// a field that stops typing, not as an error from the server.
const auth = () =>
  fakeAuthService({
    users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
    signedIn: { id: "u1", email: "u@test.local" },
  }).service;
const decks = () =>
  fakeDeckRepository([
    {
      id: "deck-1",
      name: "Gate tempo",
      updatedAt: "2026-10-14T10:00:00Z",
      cards: [],
      pitchTargets: {},
    },
  ]).repository;

describe("form limits", () => {
  it("caps a new deck's name at 80 characters", async () => {
    await renderApp({ path: "/decks", auth: auth(), decks: decks() });
    await userEvent
      .setup()
      .click((await screen.findAllByRole("button", { name: "New deck" }))[0]!);
    const dialog = within(screen.getByRole("dialog", { name: "New deck" }));
    expect(dialog.getByLabelText("Deck name")).toHaveAttribute(
      "maxlength",
      "80",
    );
  });

  it("caps a deck name saved from the core at 80 characters", async () => {
    await renderApp({
      path: "/ranking?tab=board",
      auth: auth(),
      decks: decks(),
    });
    expect(
      await screen.findByRole("textbox", { name: "New deck name" }),
    ).toHaveAttribute("maxlength", "80");
  });

  it("caps a deck's pitch targets at 80", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=stats",
      auth: auth(),
      decks: decks(),
    });
    expect(await screen.findByLabelText("Red target")).toHaveAttribute(
      "max",
      "80",
    );
  });
});
