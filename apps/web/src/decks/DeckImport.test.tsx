// Deck list import (the maintainer, 27 Oct 2026): paste a list or upload a file, then create a
// new deck from it or replace a deck's pool. Every line must match a card, or be removed, first.
import { screen, waitFor, within } from "@testing-library/react";
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

const existing = {
  id: "deck-1",
  name: "Gate tempo",
  updatedAt: "2026-10-14T10:00:00Z",
  cards: [{ variantId: "hp1", quantity: 3, sideboard: false }],
  pitchTargets: {},
};

async function openImport() {
  const fake = fakeDeckRepository([existing]);
  const { router } = await renderApp({
    path: "/decks",
    auth: auth(),
    decks: fake.repository,
  });
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Import list" }));
  const dialog = within(screen.getByRole("dialog", { name: "Import a list" }));
  return { fake, router, user, dialog };
}

describe("importing a list as a new deck", () => {
  it("creates the deck with its deck and sideboard cards, and opens it", async () => {
    const { fake, router, user, dialog } = await openImport();
    await user.type(dialog.getByLabelText("Deck name"), "Imported");
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste(
      "3x Hocus Pocus (red)\n1 Nebula Blade\nSideboard\n2 Hocus Pocus (blue)",
    );
    expect(dialog.getByText("3 lines matched.")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Create deck" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/decks/deck-2"),
    );
    expect(fake.saved).toEqual([
      "create Imported",
      "replace deck-2 hp1:3,nb:1,hp3:2:side",
    ]);
  });

  it("takes the deck name from a FaBrary export", async () => {
    const { user, dialog } = await openImport();
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste(
      "Name: Blood debt\nHero: Viserai\n\nDeck cards\n3x Hocus Pocus (red)",
    );
    expect(dialog.getByLabelText("Deck name")).toHaveValue("Blood debt");
  });

  it("lists lines that don't match, and waits until they're fixed or removed", async () => {
    const { fake, user, dialog } = await openImport();
    await user.type(dialog.getByLabelText("Deck name"), "Imported");
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste("3 Hocus Pocus (red)\n2 Hokus Pokus (red)\n3 Hocus Pocus");
    const problems = within(dialog.getByRole("list", { name: "Lines to fix" }));
    expect(problems.getAllByRole("listitem")).toHaveLength(2);
    expect(problems.getByText("No card with this name.")).toBeInTheDocument();
    const create = dialog.getByRole("button", { name: "Create deck" });
    expect(create).toBeDisabled();

    await user.click(
      problems.getByRole("button", {
        name: "Remove line 2: 2 Hokus Pokus (red)",
      }),
    );
    expect(dialog.getByLabelText("Deck list")).toHaveValue(
      "3 Hocus Pocus (red)\n3 Hocus Pocus",
    );
    expect(create).toBeDisabled();
    // Fixed by hand in the box.
    await user.type(dialog.getByLabelText("Deck list"), " (blue)");
    expect(dialog.queryByRole("list", { name: "Lines to fix" })).toBeNull();
    expect(create).toBeEnabled();
    await user.click(create);
    await waitFor(() =>
      expect(fake.saved).toContain("replace deck-2 hp1:3,hp3:3"),
    );
  });

  it("reads an uploaded .txt file into the box", async () => {
    const { user, dialog } = await openImport();
    const file = new File(["3 Hocus Pocus (yellow)\n"], "deck.txt", {
      type: "text/plain",
    });
    await user.upload(
      dialog.getByLabelText("Or upload a .txt or .csv file"),
      file,
    );
    await waitFor(() =>
      expect(dialog.getByLabelText("Deck list")).toHaveValue(
        "3 Hocus Pocus (yellow)\n",
      ),
    );
    expect(dialog.getByText("1 line matched.")).toBeInTheDocument();
  });

  it("warns when the list is for another hero, without blocking", async () => {
    const { user, dialog } = await openImport();
    await user.type(dialog.getByLabelText("Deck name"), "Imported");
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste("Hero: Dorinthea Ironsong\n3 Hocus Pocus (red)");
    expect(
      dialog.getByText(/This list is for Dorinthea Ironsong\./),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Create deck" })).toBeEnabled();
  });

  it("imports a list that breaks the deck rules as given", async () => {
    const { fake, user, dialog } = await openImport();
    await user.type(dialog.getByLabelText("Deck name"), "Too many");
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste("5 Hocus Pocus (red)");
    await user.click(dialog.getByRole("button", { name: "Create deck" }));
    await waitFor(() => expect(fake.saved).toContain("replace deck-2 hp1:5"));
    expect(
      await screen.findByText(/Hocus Pocus \(red\) has 5 copies/),
    ).toBeInTheDocument();
  });
});

describe("replacing a deck's pool from a list", () => {
  async function openReplace() {
    const fake = fakeDeckRepository([existing]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Replace from list" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Replace Gate tempo's cards" }),
    );
    return { fake, user, dialog };
  }

  it("replaces the deck and the sideboard together", async () => {
    const { fake, user, dialog } = await openReplace();
    expect(
      dialog.getByText(/replaces every card in the deck and the sideboard/),
    ).toBeInTheDocument();
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste("2 Hocus Pocus (blue)\nSideboard\n1 Nebula Blade");
    await user.click(dialog.getByRole("button", { name: "Replace cards" }));
    await waitFor(() =>
      expect(fake.saved).toEqual(["replace deck-1 hp3:2,nb:1:side"]),
    );
    expect(
      screen.queryByRole("dialog", { name: "Replace Gate tempo's cards" }),
    ).toBeNull();
    expect(
      await screen.findByText("2 deck cards · 1 sideboard · 3 in the pool"),
    ).toBeInTheDocument();
  });

  it("warns when the list's hero isn't the deck's", async () => {
    const { user, dialog } = await openReplace();
    await user.click(dialog.getByLabelText("Deck list"));
    await user.paste("Hero: Dorinthea Ironsong\n2 Hocus Pocus (blue)");
    expect(
      dialog.getByText(/This list is for Dorinthea Ironsong\./),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Replace cards" })).toBeEnabled();
  });

  it("only the owner can replace the cards", async () => {
    const fake = fakeDeckRepository([
      { ...existing, ownerId: "u2", visibility: "public" },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("button", { name: "Replace from list" }),
    ).toBeNull();
  });
});
