import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "./test/fakeAuthService.ts";
import { fakeDeckRepository } from "./test/fakeDeckRepository.ts";
import { renderApp } from "./test/renderApp.tsx";

// Optional usernames (maintainer, 16 Oct 2026): at sign-up, on the Account page, and shown as
// the author of public decks.
describe("usernames", () => {
  async function signUp(
    fake: ReturnType<typeof fakeAuthService>,
    name: string,
  ) {
    await renderApp({ path: "/sign-in?mode=signup", auth: fake.service });
    const user = userEvent.setup();
    if (name) await user.type(await screen.findByLabelText("Username"), name);
    await user.type(await screen.findByLabelText("Email"), "new@test.local");
    await user.type(screen.getByLabelText("Password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
  }

  it("can be chosen when creating an account", async () => {
    const fake = fakeAuthService();
    await signUp(fake, "Edd_99");
    await waitFor(() =>
      expect(fake.calls).toEqual(["signUp:new@test.local:Edd_99"]),
    );
  });

  // Required now it's how people sign in (maintainer, 16 Oct 2026).
  it("is required", async () => {
    const fake = fakeAuthService();
    await signUp(fake, "");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a username: it's how you sign in.",
    );
    expect(fake.calls).toEqual([]);
  });

  it("says when a username is taken, before creating the account", async () => {
    const fake = fakeAuthService({ takenUsernames: ["edd_99"] });
    await signUp(fake, "EDD_99");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That username is taken. Try another.",
    );
    expect(fake.calls).toEqual([]);
  });

  it("explains the rules for an invalid one", async () => {
    const fake = fakeAuthService();
    await signUp(fake, "no spaces");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A username is 3 to 24 letters, numbers, _ or -.",
    );
    expect(fake.calls).toEqual([]);
  });

  it("can be set or changed on the Account page", async () => {
    const fake = fakeAuthService({
      users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
      signedIn: { id: "s1", email: "s@test.local" },
    });
    await renderApp({ path: "/account", auth: fake.service });
    const user = userEvent.setup();
    const field = await screen.findByLabelText("Username");
    await user.type(field, "Edd");
    await user.click(screen.getByRole("button", { name: "Save username" }));
    await waitFor(() => expect(fake.calls).toContain("setUsername:Edd"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Username saved",
    );
  });

  it("asks an account without one to choose a username to sign in with", async () => {
    const fake = fakeAuthService({
      users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
      signedIn: { id: "s1", email: "s@test.local" },
    });
    await renderApp({ path: "/account", auth: fake.service });
    expect(
      await screen.findByText(
        "Choose a username: you'll be able to sign in with it instead of your email.",
      ),
    ).toBeInTheDocument();
  });

  it("shows who made a public deck", async () => {
    const decks = fakeDeckRepository([
      {
        id: "deck-9",
        name: "Usurp aggro",
        updatedAt: "2026-10-13T10:00:00Z",
        ownerId: "u2",
        ownerName: "Edd",
        isPublic: true,
        cards: [],
        pitchTargets: {},
      },
    ]).repository;
    await renderApp({
      path: "/decks?tab=public",
      auth: fakeAuthService().service,
      decks,
    });
    expect(
      within(
        await screen.findByRole("listitem", { name: "Usurp aggro" }),
      ).getByText("by Edd"),
    ).toBeInTheDocument();
  });

  it("shows who made someone else's deck on its page", async () => {
    const decks = fakeDeckRepository([
      {
        id: "deck-9",
        name: "Usurp aggro",
        updatedAt: "2026-10-13T10:00:00Z",
        ownerId: "u2",
        ownerName: "Edd",
        isPublic: true,
        cards: [],
        pitchTargets: {},
      },
    ]).repository;
    await renderApp({
      path: "/decks/deck-9",
      auth: fakeAuthService().service,
      decks,
    });
    expect(await screen.findByText("by Edd")).toBeInTheDocument();
  });
});
