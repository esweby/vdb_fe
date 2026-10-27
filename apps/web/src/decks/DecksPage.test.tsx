import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import {
  fakeDeckRepository,
  type DeckFixture,
} from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import {
  fakeCardRepository,
  sampleCards,
  SOUL_OF_EXISTENCE,
} from "../test/fakeCardRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { sampleCommunity } from "../test/sampleCommunity.ts";
import type { DeckCard, PitchTargets } from "./deckRepository.ts";

const auth = () =>
  fakeAuthService({
    users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
    signedIn: { id: "u1", email: "u@test.local" },
  }).service;

const withDeck = (cards: DeckCard[] = [], pitchTargets: PitchTargets = {}) =>
  fakeDeckRepository([
    {
      id: "deck-1",
      name: "Gate tempo",
      updatedAt: "2026-10-14T10:00:00Z",
      cards,
      pitchTargets,
    },
  ]);

const region = (name: string) => within(screen.getByRole("region", { name }));

describe("decks list", () => {
  const signedOut = () => fakeAuthService().service;
  const decksOf = (fixtures: DeckFixture[]) =>
    fakeDeckRepository(fixtures, { userId: "u1" });
  const mine: DeckFixture = {
    id: "deck-1",
    name: "Gate tempo",
    updatedAt: "2026-10-14T10:00:00Z",
    cards: [
      { variantId: "hp1", quantity: 3, sideboard: false },
      { variantId: "bsl3", quantity: 2, sideboard: false },
      { variantId: "hp2", quantity: 1, sideboard: true },
    ],
    pitchTargets: {},
  };
  const theirs: DeckFixture = {
    id: "deck-9",
    name: "Usurp aggro",
    updatedAt: "2026-10-13T10:00:00Z",
    ownerId: "u2",
    visibility: "public",
    cards: [],
    pitchTargets: {},
  };
  const theirSecret: DeckFixture = {
    ...theirs,
    id: "deck-8",
    name: "Secret tech",
    visibility: "private",
  };
  const theirLink: DeckFixture = {
    ...theirs,
    id: "deck-7",
    name: "Link tech",
    visibility: "link",
  };
  const tile = (name: string) => within(screen.getByRole("listitem", { name }));

  it("opens on my decks, each with its card count, pitch mix and visibility", async () => {
    await renderApp({
      path: "/decks",
      auth: auth(),
      decks: decksOf([mine, theirs]).repository,
    });
    expect(
      await screen.findByRole("tab", { name: "My decks" }),
    ).toHaveAttribute("aria-selected", "true");
    const gate = tile("Gate tempo");
    // The sideboard card isn't counted
    expect(gate.getByText("5 cards")).toBeInTheDocument();
    expect(
      gate.getByRole("img", { name: "Pitch mix: 3 red, 0 yellow, 2 blue" }),
    ).toBeInTheDocument();
    expect(
      gate.getByRole("combobox", { name: "Who can see Gate tempo" }),
    ).toHaveValue("private");
    expect(gate.getByRole("link", { name: "Gate tempo" })).toHaveAttribute(
      "href",
      "/decks/deck-1",
    );
    // Someone else's public deck isn't one of mine
    expect(screen.queryByRole("listitem", { name: "Usurp aggro" })).toBeNull();
  });

  it("creates a deck from the header, private, link only or public, and opens it", async () => {
    const fake = decksOf([mine]);
    const { router } = await renderApp({
      path: "/decks",
      auth: auth(),
      decks: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "New deck" }));
    const dialog = within(screen.getByRole("dialog", { name: "New deck" }));
    await user.type(dialog.getByLabelText("Deck name"), "Runechant aggro");
    const who = dialog.getByRole("combobox", { name: "Who can see it" });
    expect(who).toHaveValue("private");
    await user.selectOptions(who, "Link only");
    await user.click(dialog.getByRole("button", { name: "Create deck" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/decks/deck-2"),
    );
    expect(fake.saved).toEqual(["create Runechant aggro link"]);
  });

  it("asks for a name before creating a deck", async () => {
    const fake = decksOf([]);
    await renderApp({ path: "/decks", auth: auth(), decks: fake.repository });
    const user = userEvent.setup();
    // With no decks yet, the empty state offers New deck too; use the header's.
    await user.click(
      (await screen.findAllByRole("button", { name: "New deck" }))[0]!,
    );
    const dialog = within(screen.getByRole("dialog", { name: "New deck" }));
    await user.click(dialog.getByRole("button", { name: "Create deck" }));
    expect(dialog.getByText("Name the deck first.")).toBeInTheDocument();
    expect(fake.saved).toEqual([]);
  });

  it("sets who can see a deck from the list: private, link only or public", async () => {
    const fake = decksOf([mine]);
    await renderApp({ path: "/decks", auth: auth(), decks: fake.repository });
    const user = userEvent.setup();
    const who = await screen.findByRole("combobox", {
      name: "Who can see Gate tempo",
    });
    expect(who).toHaveValue("private");
    await user.selectOptions(who, "Public");
    expect(fake.saved).toEqual(["public deck-1"]);
    expect(who).toHaveValue("public");
    await user.selectOptions(who, "Link only");
    expect(fake.saved).toEqual(["public deck-1", "link deck-1"]);
    expect(who).toHaveValue("link");
    await user.selectOptions(who, "Private");
    expect(fake.saved).toEqual([
      "public deck-1",
      "link deck-1",
      "private deck-1",
    ]);
  });

  it("lists everyone's public decks in their own tab, kept in the URL", async () => {
    const { router } = await renderApp({
      path: "/decks",
      auth: auth(),
      decks: decksOf([
        { ...mine, visibility: "public" },
        theirs,
        theirSecret,
        theirLink,
      ]).repository,
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Public decks" }));
    expect(router.state.location.search).toMatchObject({ tab: "public" });
    expect(
      await screen.findByRole("listitem", { name: "Usurp aggro" }),
    ).toBeInTheDocument();
    expect(tile("Gate tempo").getByText("Yours")).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Secret tech" })).toBeNull();
    // A link-only deck isn't listed
    expect(screen.queryByRole("listitem", { name: "Link tech" })).toBeNull();
    // Only the owner changes visibility
    expect(
      screen.queryByRole("combobox", { name: "Who can see Usurp aggro" }),
    ).toBeNull();
  });

  it("invites me to build my first deck when I have none", async () => {
    await renderApp({
      path: "/decks",
      auth: auth(),
      decks: decksOf([]).repository,
    });
    expect(
      await screen.findByText("You haven't built a deck yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start from Build a core" }),
    ).toHaveAttribute("href", "/core");
  });

  it("shows signed-out visitors the public decks and how to start their own", async () => {
    await renderApp({
      path: "/decks",
      auth: signedOut(),
      decks: decksOf([theirs, mine]).repository,
    });
    expect(
      await screen.findByRole("listitem", { name: "Usurp aggro" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "My decks" })).toBeNull();
    expect(screen.queryByRole("button", { name: "New deck" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Sign in to build decks" }),
    ).toHaveAttribute("href", "/sign-in");
  });
});

describe("deck page", () => {
  it("adds cards by searching, and changes quantities", async () => {
    const fake = withDeck();
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    expect(
      await screen.findByRole("heading", { name: "Gate tempo" }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Find cards"), "hocus");
    await user.click(
      screen.getByRole("button", { name: "Add Hocus Pocus (red)" }),
    );
    expect(region("Deck").getByText("Hocus Pocus")).toBeInTheDocument();
    await user.click(
      region("Deck").getByRole("button", {
        name: "One more Hocus Pocus (red)",
      }),
    );
    expect(
      region("Deck").getByLabelText("Copies of Hocus Pocus (red)"),
    ).toHaveTextContent("2");
    await user.click(
      region("Deck").getByRole("button", {
        name: "One fewer Hocus Pocus (red)",
      }),
    );
    await user.click(
      region("Deck").getByRole("button", {
        name: "One fewer Hocus Pocus (red)",
      }),
    );
    expect(region("Deck").queryByText("Hocus Pocus")).not.toBeInTheDocument();
    expect(fake.saved).toEqual([
      "set deck-1 hp1 1 main",
      "set deck-1 hp1 2 main",
      "set deck-1 hp1 1 main",
      "set deck-1 hp1 0 main",
    ]);
  });

  it("shows cards to add straight away, without typing", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck().repository,
    });
    const finder = within(
      await screen.findByRole("region", { name: "Add cards" }),
    );
    expect(
      within(finder.getByRole("list", { name: "Cards to add" }))
        .getAllByRole("listitem")
        .map((li) => li.getAttribute("aria-label")),
    ).toEqual([
      // Weapons and equipment first, then deck cards by name, a tile for each pitch.
      "Nebula Blade",
      "Become the Shadow Lord (blue)",
      "Fate Foreseen (red)",
      "Fate Foreseen (yellow)",
      "Fate Foreseen (blue)",
      "Hocus Pocus (red)",
      "Hocus Pocus (yellow)",
      "Hocus Pocus (blue)",
    ]);
    expect(finder.getByText("4 cards")).toBeInTheDocument();
  });

  it("finds cards to add by keyword as well as name", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck().repository,
    });
    const finder = within(
      await screen.findByRole("region", { name: "Add cards" }),
    );
    const names = () =>
      within(finder.getByRole("list", { name: "Cards to add" }))
        .queryAllByRole("listitem")
        .map((li) => li.getAttribute("aria-label"));
    const user = userEvent.setup();
    await user.type(finder.getByLabelText("Find cards"), "blood debt");
    expect(names()).toEqual([
      "Hocus Pocus (red)",
      "Hocus Pocus (yellow)",
      "Hocus Pocus (blue)",
    ]);
    await user.clear(finder.getByLabelText("Find cards"));
    await user.type(finder.getByLabelText("Find cards"), "go again");
    expect(names()).toEqual(["Become the Shadow Lord (blue)"]);
  });

  it("adds a card without a pitch to the deck or the sideboard from symbols over its picture", async () => {
    const fake = withDeck();
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    const blade = within(
      await screen.findByRole("listitem", { name: "Nebula Blade" }),
    );
    const actions = within(blade.getByRole("group", { name: "Nebula Blade" }));
    expect(
      actions.getAllByRole("button").map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Add Nebula Blade", "Add Nebula Blade to the sideboard"]);
    await userEvent.setup().click(
      actions.getByRole("button", {
        name: "Add Nebula Blade to the sideboard",
      }),
    );
    expect(fake.saved).toEqual(["set deck-1 nb 1 side"]);
  });

  it("allows only one copy of a piece of equipment", async () => {
    const purgatory = {
      ...sampleCards.find((c) => c.name === "Nebula Blade")!,
      id: "card-face-purgatory",
      name: "Face Purgatory",
      type: "equipment",
      subtypes: ["Head"],
      variants: [
        {
          ...sampleCards.find((c) => c.name === "Nebula Blade")!.variants[0]!,
          id: "fp",
        },
      ],
    };
    const fake = withDeck();
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: fakeCardRepository([...sampleCards, purgatory]),
      decks: fake.repository,
    });
    const item = within(
      await screen.findByRole("listitem", { name: "Face Purgatory" }),
    );
    const user = userEvent.setup();
    await user.click(item.getByRole("button", { name: "Add Face Purgatory" }));
    expect(fake.saved).toEqual(["set deck-1 fp 1 main"]);
    expect(
      item.getByRole("button", { name: "Add Face Purgatory" }),
    ).toBeDisabled();
  });

  it("offers Remove rather than − and + for equipment in the deck, as only one is allowed", async () => {
    const blade = sampleCards.find((c) => c.name === "Nebula Blade")!;
    const purgatory = {
      ...blade,
      id: "card-face-purgatory",
      name: "Face Purgatory",
      type: "equipment",
      subtypes: ["Head"],
      variants: [{ ...blade.variants[0]!, id: "fp" }],
    };
    const fake = withDeck([{ variantId: "fp", quantity: 1, sideboard: false }]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: fakeCardRepository([...sampleCards, purgatory]),
      decks: fake.repository,
    });
    const gear = within(
      await screen.findByRole("region", { name: "Weapons and equipment" }),
    );
    expect(
      gear.queryByRole("button", { name: "One more Face Purgatory" }),
    ).toBeNull();
    expect(
      gear.queryByRole("button", { name: "One fewer Face Purgatory" }),
    ).toBeNull();
    expect(
      gear.getByRole("button", {
        name: "Move one Face Purgatory to the sideboard",
      }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(gear.getByRole("button", { name: "Remove Face Purgatory" }));
    expect(fake.saved).toEqual(["set deck-1 fp 0 main"]);
  });

  it("gives each pitch its own tile, with deck and sideboard buttons down the side", async () => {
    const fake = withDeck();
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    const yellow = within(
      await screen.findByRole("listitem", { name: "Hocus Pocus (yellow)" }),
    );
    const actions = within(
      yellow.getByRole("group", { name: "Hocus Pocus (yellow)" }),
    );
    expect(
      actions.getAllByRole("button").map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Add Hocus Pocus (yellow)",
      "Add Hocus Pocus (yellow) to the sideboard",
    ]);
    const user = userEvent.setup();
    await user.click(
      actions.getByRole("button", { name: "Add Hocus Pocus (yellow)" }),
    );
    await user.click(
      within(
        screen.getByRole("listitem", { name: "Hocus Pocus (blue)" }),
      ).getByRole("button", {
        name: "Add Hocus Pocus (blue) to the sideboard",
      }),
    );
    expect(fake.saved).toEqual([
      "set deck-1 hp2 1 main",
      "set deck-1 hp3 1 side",
    ]);
  });

  it("pages through the cards to add rather than scrolling on and on", async () => {
    const blade = sampleCards.find((c) => c.id === "card-nebula-blade")!;
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...blade,
      id: `card-${i}`,
      name: `Zz blade ${String(i).padStart(2, "0")}`,
      variants: [{ ...blade.variants[0]!, id: `zz${i}` }],
    }));
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: fakeCardRepository([...sampleCards, ...many]),
      decks: withDeck().repository,
    });
    const finder = within(
      await screen.findByRole("region", { name: "Add cards" }),
    );
    const tiles = () =>
      within(finder.getByRole("list", { name: "Cards to add" })).getAllByRole(
        "listitem",
      );
    const pages = within(finder.getByRole("navigation", { name: "Pages" }));
    expect(tiles()).toHaveLength(24);
    expect(pages.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(pages.getByRole("button", { name: "Previous page" })).toBeDisabled();
    const user = userEvent.setup();
    // The cards scroll on their own under the search and filters; a new page starts at the top.
    const list = finder.getByRole("list", {
      name: "Cards to add",
    }).parentElement!;
    list.scrollTop = 400;
    await user.click(pages.getByRole("button", { name: "Next page" }));
    expect(list.scrollTop).toBe(0);
    expect(tiles()).toHaveLength(14);
    expect(pages.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(pages.getByRole("button", { name: "Next page" })).toBeDisabled();
    // A new search starts again at page 1.
    await user.type(finder.getByLabelText("Find cards"), "zz");
    expect(tiles()).toHaveLength(24);
    expect(pages.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("narrows the cards to add by pitch, offering only that pitch", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck().repository,
    });
    const finder = within(
      await screen.findByRole("region", { name: "Add cards" }),
    );
    await userEvent
      .setup()
      .click(
        within(finder.getByRole("group", { name: "Pitch" })).getByRole(
          "button",
          { name: "Blue" },
        ),
      );
    expect(
      finder.getByRole("button", { name: "Add Hocus Pocus (blue)" }),
    ).toBeInTheDocument();
    expect(
      finder.queryByRole("button", { name: "Add Hocus Pocus (red)" }),
    ).toBeNull();
    expect(finder.queryByRole("listitem", { name: "Nebula Blade" })).toBeNull();
  });

  it("narrows the cards to add by class", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck().repository,
    });
    const finder = within(
      await screen.findByRole("region", { name: "Add cards" }),
    );
    const user = userEvent.setup();
    await user.click(
      within(finder.getByRole("group", { name: "Class" })).getByRole("button", {
        name: "Shadow",
      }),
    );
    expect(
      within(finder.getByRole("list", { name: "Cards to add" }))
        .getAllByRole("listitem")
        .map((li) => li.getAttribute("aria-label")),
    ).toEqual(["Become the Shadow Lord (blue)"]);
    await user.click(finder.getByRole("button", { name: "Clear filters" }));
    expect(finder.getByText("4 cards")).toBeInTheDocument();
  });

  it("keeps the rest of the filters folded away under More filters", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck().repository,
    });
    const finder = within(
      await screen.findByRole("region", { name: "Add cards" }),
    );
    const more = finder.getByRole("button", { name: "More filters" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(finder.queryByRole("complementary", { name: "Filters" })).toBeNull();
    await userEvent.setup().click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(
      finder.getByRole("complementary", { name: "Filters" }),
    ).toBeInTheDocument();
  });

  // The maintainer, 20 Oct 2026: a card can be split, e.g. 1 in the deck and 2 in the sideboard.
  it("moves one copy at a time between the deck and the sideboard", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 3, sideboard: false },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    await screen.findByRole("region", { name: "Deck" });
    await userEvent.setup().click(
      region("Deck").getByRole("button", {
        name: "Move one Hocus Pocus (red) to the sideboard",
      }),
    );
    await screen.findByText("2 deck cards · 1 sideboard · 3 in the pool");
    // The sideboard copy is saved first, so a matchup never loses a copy in between.
    expect(fake.saved).toEqual([
      "set deck-1 hp1 1 side",
      "set deck-1 hp1 2 main",
    ]);
    await userEvent.setup().click(
      region("Sideboard").getByRole("button", {
        name: "Move one Hocus Pocus (red) to the deck",
      }),
    );
    await screen.findByText("3 deck cards · 0 sideboard · 3 in the pool");
    expect(fake.saved.slice(2)).toEqual([
      "set deck-1 hp1 3 main",
      "set deck-1 hp1 0 side",
    ]);
    expect(region("Sideboard").queryByText("Hocus Pocus")).toBeNull();
  });

  it("adds a card to the sideboard when it's already in the deck", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 1, sideboard: false },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    const red = within(
      await screen.findByRole("listitem", { name: "Hocus Pocus (red)" }),
    );
    await userEvent.setup().click(
      red.getByRole("button", {
        name: "Add Hocus Pocus (red) to the sideboard",
      }),
    );
    expect(fake.saved).toEqual(["set deck-1 hp1 1 side"]);
    await screen.findByText("1 deck cards · 1 sideboard · 2 in the pool");
  });

  it("counts the deck and sideboard copies together for the copy limit", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 1, sideboard: false },
      { variantId: "hp1", quantity: 2, sideboard: true },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    const red = within(
      await screen.findByRole("listitem", { name: "Hocus Pocus (red)" }),
    );
    expect(
      red.getByRole("button", { name: "Add Hocus Pocus (red)" }),
    ).toBeDisabled();
    expect(
      region("Deck").getByRole("button", {
        name: "One more Hocus Pocus (red)",
      }),
    ).toBeDisabled();
  });

  it("shows weapons apart from the deck, and what makes the deck illegal", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 3, sideboard: false },
      { variantId: "nb", quantity: 1, sideboard: false },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    expect(
      await region("Weapons and equipment").findByText("Nebula Blade"),
    ).toBeInTheDocument();
    expect(region("Deck").queryByText("Nebula Blade")).not.toBeInTheDocument();
    expect(
      screen.getByText("3 deck cards · 0 sideboard · 4 in the pool"),
    ).toBeInTheDocument();
    // The main deck is taken as built (maintainer, 19 Oct 2026): no minimum.
    expect(screen.queryByText(/needs at least/)).toBeNull();
  });

  it("shows each card as a card-shaped tile with its basic details", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck([
        { variantId: "hp1", quantity: 3, sideboard: false },
        { variantId: "nb", quantity: 1, sideboard: false },
      ]).repository,
    });
    const tile = await region("Deck").findByRole("article", {
      name: "Hocus Pocus (red)",
    });
    expect(within(tile).getByLabelText("Pitch 1")).toBeInTheDocument();
    expect(within(tile).getByLabelText("Cost 0")).toBeInTheDocument();
    expect(within(tile).getByLabelText("Power 4")).toBeInTheDocument();
    expect(within(tile).getByLabelText("Defense 3")).toBeInTheDocument();
    expect(
      within(tile).getByText("Runeblade Attack action"),
    ).toBeInTheDocument();
    expect(within(tile).getByText("Blood Debt")).toBeInTheDocument();
    expect(within(tile).getByText("3×")).toBeInTheDocument();
    // The art box shows an icon for the card type
    expect(within(tile).getByTestId("type-icon")).toHaveAttribute(
      "data-type",
      "attack_action",
    );
    // Keywords are chips
    expect(within(tile).getByText("Blood Debt")).toHaveAttribute(
      "data-chip",
      "keyword",
    );
    const blade = region("Weapons and equipment").getByRole("article", {
      name: "Nebula Blade",
    });
    expect(
      within(blade).getByText("Runeblade Weapon · Sword · 2H"),
    ).toBeInTheDocument();
    expect(within(blade).getByLabelText("Power 1")).toBeInTheDocument();
  });

  it("switches between card tiles and a compact list, keeping the choice in the URL", async () => {
    const { router } = await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck([{ variantId: "hp1", quantity: 3, sideboard: false }])
        .repository,
    });
    await region("Deck").findByRole("article", { name: "Hocus Pocus (red)" });
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Card view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "List view" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: "list" }),
    );
    expect(region("Deck").queryByRole("article")).not.toBeInTheDocument();
    expect(region("Deck").getByText("3×")).toBeInTheDocument();
  });

  it("puts weapons and equipment together in one row above the deck", async () => {
    const gear = (id: string, name: string, slot: string) => ({
      ...sampleCards.find((c) => c.id === "card-nebula-blade")!,
      id: `card-${id}`,
      name,
      type: "equipment",
      subtypes: [slot],
      variants: [
        {
          id,
          pitch: null,
          cost: null,
          power: null,
          defense: 1,
          attributes: {},
        },
      ],
    });
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: fakeCardRepository([
        ...sampleCards,
        gear("legs", "Arcane Lantern", "Legs"),
        gear("head", "Crown of Seeds", "Head"),
      ]),
      decks: withDeck([
        { variantId: "hp1", quantity: 3, sideboard: false },
        { variantId: "legs", quantity: 1, sideboard: false },
        { variantId: "nb", quantity: 1, sideboard: false },
        { variantId: "head", quantity: 1, sideboard: false },
      ]).repository,
    });
    const row = await screen.findByRole("region", {
      name: "Weapons and equipment",
    });
    await within(row).findByRole("article", { name: "Crown of Seeds" });
    expect(
      within(row)
        .getAllByRole("article")
        .map((a) => a.getAttribute("aria-label")),
    ).toEqual(["Nebula Blade", "Crown of Seeds", "Arcane Lantern"]);
    // The art box names the slot, so it isn't lost when the type line is cut off.
    expect(
      within(
        within(row).getByRole("article", { name: "Crown of Seeds" }),
      ).getByText("Head"),
    ).toBeInTheDocument();
    expect(
      within(
        within(row).getByRole("article", { name: "Nebula Blade" }),
      ).getByText("Sword · 2H"),
    ).toBeInTheDocument();
    const deck = screen.getByRole("region", { name: "Deck" });
    expect(
      row.compareDocumentPosition(deck) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("enlarges a card's picture from a magnifying glass, in Add cards and in the deck", async () => {
    const withImage = sampleCards.map((c) =>
      c.id === "card-hocus-pocus"
        ? {
            ...c,
            variants: c.variants.map((v) => ({
              ...v,
              imageUrl: `https://img/${v.id}.webp`,
            })),
          }
        : c,
    );
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: fakeCardRepository(withImage),
      decks: withDeck([{ variantId: "hp1", quantity: 2, sideboard: false }])
        .repository,
    });
    const user = userEvent.setup();
    const toAdd = within(
      await screen.findByRole("list", { name: "Cards to add" }),
    ).getByRole("listitem", { name: "Hocus Pocus (red)" });
    await user.click(
      within(toAdd).getByRole("button", { name: "Enlarge Hocus Pocus (red)" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Hocus Pocus (red)" });
    // Opened over the whole page, not inside the tile (which would clip and restyle it).
    expect(toAdd).not.toContainElement(dialog);
    expect(
      within(dialog).getByRole("img", { name: "Hocus Pocus (red)" }),
    ).toHaveAttribute("src", "https://img/hp1.webp");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const inDeck = await region("Deck").findByRole("article", {
      name: "Hocus Pocus (red)",
    });
    await user.click(
      within(inDeck).getByRole("button", {
        name: "Enlarge Hocus Pocus (red)",
      }),
    );
    expect(
      within(
        screen.getByRole("dialog", { name: "Hocus Pocus (red)" }),
      ).getByRole("img", { name: "Hocus Pocus (red)" }),
    ).toHaveAttribute("src", "https://img/hp1.webp");
  });

  it("offers no magnifying glass for a card without a picture", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck().repository,
    });
    const toAdd = within(
      await screen.findByRole("list", { name: "Cards to add" }),
    ).getByRole("listitem", { name: "Hocus Pocus (red)" });
    expect(
      within(toAdd).queryByRole("button", { name: /^Enlarge/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the card image when there is one, and the stand-in if it fails to load", async () => {
    const withImage = sampleCards.map((c) =>
      c.id === "card-hocus-pocus"
        ? {
            ...c,
            variants: c.variants.map((v) => ({
              ...v,
              imageUrl: `https://img/${v.id}.webp`,
            })),
          }
        : c,
    );
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: fakeCardRepository(withImage),
      decks: withDeck([{ variantId: "hp1", quantity: 2, sideboard: false }])
        .repository,
    });
    const tile = await region("Deck").findByRole("article", {
      name: "Hocus Pocus (red)",
    });
    const image = within(tile).getByRole("img", { name: "Hocus Pocus (red)" });
    expect(image).toHaveAttribute("src", "https://img/hp1.webp");
    fireEvent.error(image);
    expect(within(tile).getByLabelText("Power 4")).toBeInTheDocument();
  });

  it("orders cards by pitch, then name", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck([
        { variantId: "hp3", quantity: 1, sideboard: false },
        { variantId: "ff1", quantity: 1, sideboard: false },
        { variantId: "bsl3", quantity: 1, sideboard: false },
        { variantId: "hp1", quantity: 1, sideboard: false },
        { variantId: "ff2", quantity: 1, sideboard: false },
      ]).repository,
    });
    await region("Deck").findAllByText("Fate Foreseen");
    expect(
      region("Deck")
        .getAllByRole("listitem")
        .map((li) => within(li).getByRole("status").getAttribute("aria-label")),
    ).toEqual([
      "Copies of Fate Foreseen (red)",
      "Copies of Hocus Pocus (red)",
      "Copies of Fate Foreseen (yellow)",
      "Copies of Become the Shadow Lord (blue)",
      "Copies of Hocus Pocus (blue)",
    ]);
  });

  it("caps each card at the copy limit", async () => {
    const fake = withDeck([
      { variantId: "hp1", quantity: 3, sideboard: false },
    ]);
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: fake.repository,
    });
    expect(
      await region("Deck").findByRole("button", {
        name: "One more Hocus Pocus (red)",
      }),
    ).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText("Find cards"), "hocus");
    expect(
      screen.getByRole("button", { name: "Add Hocus Pocus (red)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add Hocus Pocus (blue)" }),
    ).toBeEnabled();
    expect(fake.saved).toEqual([]);
  });

  it("says when a deck doesn't exist", async () => {
    await renderApp({
      path: "/decks/nope",
      auth: auth(),
      decks: withDeck().repository,
    });
    expect(
      await screen.findByRole("heading", { name: "Deck not found" }),
    ).toBeInTheDocument();
  });
});

describe("deck analysis", () => {
  const cards: DeckCard[] = [
    { variantId: "hp1", quantity: 3, sideboard: false },
    { variantId: "hp3", quantity: 2, sideboard: false },
    { variantId: "nb", quantity: 1, sideboard: false },
  ];

  it("shows the pitch mix against the deck's targets, and saves new targets", async () => {
    const fake = withDeck(cards, { 3: 22 });
    await renderApp({
      path: "/decks/deck-1?tab=stats",
      auth: auth(),
      decks: fake.repository,
    });
    const pitch = await screen.findByRole("region", { name: "Pitch" });
    expect(within(pitch).getByText("Red 3")).toBeInTheDocument();
    expect(within(pitch).getByText("Blue 2 / 22")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(within(pitch).getByLabelText("Red target"), "18");
    await user.tab();
    expect(within(pitch).getByText("Red 3 / 18")).toBeInTheDocument();
    expect(fake.saved).toEqual(["targets deck-1 1:18,3:22"]);
  });

  it("shows the pitch split in the header, and switches between Cards and Stats", async () => {
    const { router } = await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck(cards).repository,
    });
    expect(
      await screen.findByRole("img", {
        name: "Pitch: 3 red, 0 yellow, 2 blue",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cards" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(region("Deck").getByText("3×")).toBeInTheDocument();
    expect(screen.queryByText("Average cost")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Stats" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: "stats" }),
    );
    expect(screen.getByText("Average cost")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Pitch" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Deck" }),
    ).not.toBeInTheDocument();
  });

  it("totals each dimension by pitch, with weapons as always available", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=stats",
      auth: auth(),
      decks: withDeck(cards).repository,
      scores: fakeScoreRepository([], { community: sampleCommunity() })
        .repository,
    });
    const table = await screen.findByRole("table", { name: "Ratings" });
    const row = await within(table).findByRole("row", {
      name: /^Overall/,
    });
    expect(
      within(row)
        .getAllByRole("cell")
        .map((c) => c.textContent),
      // hp1 ×3 (overall 50) and hp3 ×2 (overall 30): average 42, shown out of 10 as 4.2;
      // Nebula Blade is always available
    ).toEqual(["5", "3", "0", "2", "4.2", "1"]);
  });
});

describe("purple (pitch 4) cards", () => {
  const withSoul = () =>
    fakeCardRepository([...sampleCards, SOUL_OF_EXISTENCE]);
  const cards: DeckCard[] = [
    { variantId: "hp1", quantity: 3, sideboard: false },
    { variantId: "hp3", quantity: 2, sideboard: false },
    { variantId: "soe4", quantity: 1, sideboard: false },
  ];

  it("counts them in the decks list's pitch mix", async () => {
    await renderApp({
      path: "/decks",
      auth: auth(),
      cards: withSoul(),
      decks: fakeDeckRepository(
        [
          {
            id: "deck-1",
            name: "Gate tempo",
            updatedAt: "2026-10-14T10:00:00Z",
            cards,
            pitchTargets: {},
          },
        ],
        { userId: "u1" },
      ).repository,
    });
    const tile = within(
      await screen.findByRole("listitem", { name: "Gate tempo" }),
    );
    expect(tile.getByText("6 cards")).toBeInTheDocument();
    expect(
      tile.getByRole("img", {
        name: "Pitch mix: 3 red, 0 yellow, 2 blue, 1 purple",
      }),
    ).toBeInTheDocument();
  });

  it("counts them in the deck header's pitch split", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      cards: withSoul(),
      decks: withDeck(cards).repository,
    });
    expect(
      await screen.findByRole("img", {
        name: "Pitch: 3 red, 0 yellow, 2 blue, 1 purple",
      }),
    ).toBeInTheDocument();
  });

  it("shows a purple row in the stats, without a target, and a purple ratings column", async () => {
    await renderApp({
      path: "/decks/deck-1?tab=stats",
      auth: auth(),
      cards: withSoul(),
      decks: withDeck(cards, { 3: 22 }).repository,
      scores: fakeScoreRepository([], { community: sampleCommunity() })
        .repository,
    });
    const pitch = await screen.findByRole("region", { name: "Pitch" });
    expect(within(pitch).getByText("Purple 1")).toBeInTheDocument();
    expect(within(pitch).getByLabelText("Red target")).toBeInTheDocument();
    expect(within(pitch).queryByLabelText("Purple target")).toBeNull();
    const table = await screen.findByRole("table", { name: "Ratings" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual([
      "Rating",
      "Cards",
      "Red",
      "Yellow",
      "Blue",
      "Purple",
      "Average",
      "Always available",
    ]);
  });
});

describe("someone else's public deck", () => {
  const theirs = (cards: DeckCard[]) =>
    fakeDeckRepository([
      {
        id: "deck-9",
        name: "Usurp aggro",
        updatedAt: "2026-10-13T10:00:00Z",
        ownerId: "u2",
        visibility: "public",
        cards,
        pitchTargets: { 1: 20 },
      },
    ]).repository;
  const cards: DeckCard[] = [
    { variantId: "hp1", quantity: 3, sideboard: false },
    { variantId: "nb", quantity: 1, sideboard: false },
    { variantId: "hp2", quantity: 1, sideboard: true },
  ];

  const expectReadOnly = async () => {
    expect(
      await screen.findByRole("heading", { name: "Usurp aggro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    // The cards show, but nothing changes them.
    expect(
      region("Deck").getByRole("article", { name: "Hocus Pocus (red)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Add cards" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(One more|One fewer|Remove)/ }),
    ).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /^Sideboard/ })).toBeNull();
  };

  it("opens signed out, read only", async () => {
    await renderApp({
      path: "/decks/deck-9",
      auth: fakeAuthService().service,
      decks: theirs(cards),
    });
    await expectReadOnly();
  });

  it("is read only for a signed-in player who doesn't own it", async () => {
    await renderApp({
      path: "/decks/deck-9",
      auth: auth(),
      decks: theirs(cards),
    });
    await expectReadOnly();
  });

  it("shows the owner's pitch targets in Stats without letting you change them", async () => {
    await renderApp({
      path: "/decks/deck-9?tab=stats",
      auth: fakeAuthService().service,
      decks: theirs(cards),
    });
    const pitch = within(await screen.findByRole("region", { name: "Pitch" }));
    expect(pitch.getByText("Red 3 / 20")).toBeInTheDocument();
    expect(pitch.queryByLabelText("Red target")).toBeNull();
  });
});

// A preview of what's coming (maintainer, 16 Oct 2026): the Ranking page's scenarios, run
// against a deck's main deck.
describe("deck scenarios", () => {
  it("runs the scenarios on the deck from a Scenarios tab", async () => {
    const { router } = await renderApp({
      path: "/decks/deck-1",
      auth: auth(),
      decks: withDeck([
        { variantId: "hp1", quantity: 3, sideboard: false },
        { variantId: "bsl3", quantity: 2, sideboard: false },
        // Not drawn: the sideboard and weapons.
        { variantId: "hp2", quantity: 1, sideboard: true },
        { variantId: "nb", quantity: 1, sideboard: false },
      ]).repository,
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Scenarios" }));
    expect(router.state.location.search).toMatchObject({ tab: "scenarios" });
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText(/Run your scenarios/)).toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Run scenarios" }));
    expect(
      await panel.findByText("10,000 runs each · seed 1 · 5 deck cards"),
    ).toBeInTheDocument();
    expect(
      panel.getByRole("region", { name: "Traverse timeline" }),
    ).toBeInTheDocument();
  });
});
