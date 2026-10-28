// Comparing versions on the owner's Versions tab (task 7b).
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckCard, DeckVersion } from "./deckRepository.ts";

const hocus = (quantity: number, sideboard = false) => ({
  variantId: "hp1",
  quantity,
  sideboard,
  externalId: "hp1",
  name: "Hocus Pocus",
  pitch: 1,
  type: "attack_action",
  subtypes: ["Attack"],
});
const fate = (quantity: number, sideboard = false) => ({
  variantId: "ff1",
  quantity,
  sideboard,
  externalId: "ff1",
  name: "Fate Foreseen",
  pitch: 1,
  type: "defense_reaction",
  subtypes: [],
});

const version = (
  number: number,
  cards: DeckVersion["snapshot"]["cards"],
  name: string | null = null,
): DeckVersion => ({
  id: `version-${number}`,
  deckId: "deck-1",
  number,
  name,
  createdAt: `2026-10-2${number}T12:00:00Z`,
  fabraryUrl: null,
  snapshot: {
    schemaVersion: 1,
    name: "Gate tempo",
    hero: "Viserai, the Forsaken",
    format: "Classic Constructed",
    pitchTargets: {},
    cards,
    loadouts: [],
  },
});

async function open(cards: DeckCard[], versions: DeckVersion[]) {
  const fake = fakeDeckRepository(
    [
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards,
        pitchTargets: {},
      },
    ],
    { versions },
  );
  await renderApp({
    path: "/decks/deck-1?tab=versions",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fake.repository,
  });
  const comparison = await screen.findByRole("region", { name: "Compare" });
  return { comparison, user: userEvent.setup() };
}

describe("comparing versions", () => {
  it("compares the newest version with the deck as it is now, by default", async () => {
    const { comparison } = await open(
      [{ variantId: "hp1", quantity: 3, sideboard: false }],
      [version(1, [hocus(2)])],
    );
    expect(within(comparison).getByLabelText("Compare")).toHaveDisplayValue(
      "Version 1",
    );
    expect(within(comparison).getByLabelText("With")).toHaveDisplayValue(
      "Current deck",
    );
    const deck = within(comparison).getByRole("region", { name: "Main deck" });
    expect(
      within(deck).getByText("Changed: Hocus Pocus (red) 2 → 3"),
    ).toBeInTheDocument();
    expect(
      within(comparison).getByRole("region", { name: "Sideboard" }),
    ).toHaveTextContent("No changes.");
  });

  it("compares two versions, with the deck and the sideboard apart", async () => {
    const { comparison, user } = await open(
      [{ variantId: "hp1", quantity: 3, sideboard: false }],
      [version(2, [hocus(2), fate(1, true)]), version(1, [hocus(3), fate(2)])],
    );
    await user.selectOptions(
      within(comparison).getByLabelText("Compare"),
      "Version 1",
    );
    await user.selectOptions(
      within(comparison).getByLabelText("With"),
      "Version 2",
    );
    const deck = within(comparison).getByRole("region", { name: "Main deck" });
    const sideboard = within(comparison).getByRole("region", {
      name: "Sideboard",
    });
    expect(
      within(deck)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Removed: Fate Foreseen (red) 2 → 0",
      "Changed: Hocus Pocus (red) 3 → 2",
    ]);
    expect(
      within(sideboard)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Added: Fate Foreseen (red) 0 → 1"]);
  });

  it("isn't shown before the first version", async () => {
    const fake = fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: [],
        pitchTargets: {},
      },
    ]);
    await renderApp({
      path: "/decks/deck-1?tab=versions",
      auth: fakeAuthService({
        users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
        signedIn: { id: "u1", email: "u@test.local" },
      }).service,
      decks: fake.repository,
    });
    await screen.findByText(/No versions yet/);
    expect(
      screen.queryByRole("region", { name: "Compare" }),
    ).not.toBeInTheDocument();
  });

  it("names a version, and shows the name wherever the version is listed", async () => {
    const fake = fakeDeckRepository(
      [
        {
          id: "deck-1",
          name: "Gate tempo",
          updatedAt: "2026-10-14T10:00:00Z",
          cards: [],
          pitchTargets: {},
        },
      ],
      { versions: [version(1, [hocus(2)])] },
    );
    await renderApp({
      path: "/decks/deck-1?tab=versions",
      auth: fakeAuthService({
        users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
        signedIn: { id: "u1", email: "u@test.local" },
      }).service,
      decks: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByText("Version 1", { selector: "summary" }),
    );
    await user.type(
      screen.getByLabelText("Name for version 1"),
      "  Levia tech ",
    );
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Name saved.")).toBeInTheDocument();
    expect(fake.saved).toContain("version name version-1 Levia tech");
    expect(
      screen.getByText("Version 1 · Levia tech", { selector: "summary" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Compare" })).getByLabelText(
        "Compare",
      ),
    ).toHaveDisplayValue("Version 1 · Levia tech");
  });

  it("clears a name when it's left blank", async () => {
    const fake = fakeDeckRepository(
      [
        {
          id: "deck-1",
          name: "Gate tempo",
          updatedAt: "2026-10-14T10:00:00Z",
          cards: [],
          pitchTargets: {},
        },
      ],
      { versions: [version(1, [hocus(2)], "Old name")] },
    );
    await renderApp({
      path: "/decks/deck-1?tab=versions",
      auth: fakeAuthService({
        users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
        signedIn: { id: "u1", email: "u@test.local" },
      }).service,
      decks: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByText("Version 1 · Old name", { selector: "summary" }),
    );
    await user.clear(screen.getByLabelText("Name for version 1"));
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(fake.saved).toContain("version name version-1 ");
  });
});
