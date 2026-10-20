// The maintainer, 20 Oct 2026: "A deck should be able to be toggled private/public. It should be
// able to be renamed. It should be able to be deleted with a confirmation."
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

async function open(ownerId = "u1", isPublic = false) {
  const fake = fakeDeckRepository([
    {
      id: "deck-1",
      name: "Gate tempo",
      updatedAt: "2026-10-14T10:00:00Z",
      ownerId,
      isPublic,
      cards: [{ variantId: "hp1", quantity: 3, sideboard: false }],
      pitchTargets: {},
    },
  ]);
  const { router } = await renderApp({
    path: "/decks/deck-1",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fake.repository,
  });
  await screen.findByRole("heading", { level: 1 });
  return { fake, router, user: userEvent.setup() };
}

describe("managing a deck from its page", () => {
  it("switches it between private and public", async () => {
    const { fake, user } = await open();
    expect(screen.getByText("Private")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make public" }));
    await waitFor(() => expect(fake.saved).toContain("public deck-1"));
    expect(
      screen.getByRole("button", { name: "Make private" }),
    ).toBeInTheDocument();
  });

  it("renames it, but not to nothing", async () => {
    const { fake, user } = await open();
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: "Deck name" });
    expect(name).toHaveValue("Gate tempo");
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(screen.getByText("A deck needs a name.")).toBeInTheDocument();
    await user.type(name, "Gate tempo v2");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(fake.saved).toContain("rename deck-1 Gate tempo v2"),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Gate tempo v2" }),
    ).toBeInTheDocument();
  });

  it("deletes it only after you confirm, then goes back to your decks", async () => {
    const { fake, router, user } = await open();
    await user.click(screen.getByRole("button", { name: "Delete deck" }));
    const confirm = within(
      screen.getByRole("dialog", { name: "Delete Gate tempo?" }),
    );
    await user.click(confirm.getByRole("button", { name: "Keep it" }));
    expect(fake.saved).not.toContain("delete deck-1");
    await user.click(screen.getByRole("button", { name: "Delete deck" }));
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Delete Gate tempo?" }),
      ).getByRole("button", { name: "Delete it" }),
    );
    await waitFor(() => expect(fake.saved).toContain("delete deck-1"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/decks"));
  });

  it("shows none of this on someone else's deck", async () => {
    await open("someone-else", true);
    expect(screen.queryByRole("button", { name: /Make p/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete deck" })).toBeNull();
  });
});
