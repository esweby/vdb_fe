// Matchups (the maintainer, 19 Oct 2026): per-hero board plans. Pick an opposing hero; the plan
// starts as the main deck; board cards in from the sideboard and out of the main deck.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckCard, Matchup } from "./deckRepository.ts";

const card = (
  variantId: string,
  quantity: number,
  sideboard = false,
): DeckCard => ({
  variantId,
  quantity,
  sideboard,
});
// Main: Hocus Pocus (red) ×3, Become the Shadow Lord ×2. Sideboard: Fate Foreseen (red) ×2.
const CARDS = [card("hp1", 3), card("bsl3", 2), card("ff1", 2, true)];
const HEROES = [
  {
    id: "h1",
    name: "Example Hero",
    classes: ["Warrior"],
    talents: [],
    imageUrl: null,
  },
  {
    id: "h2",
    name: "Other Hero",
    classes: ["Wizard"],
    talents: [],
    imageUrl: null,
  },
];

async function open(
  matchups: Matchup[] = [],
  heroes = HEROES,
  cards = CARDS,
  pool = sampleCards,
) {
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
    { heroes, matchups },
  );
  await renderApp({
    path: "/decks/deck-1?tab=matchups",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fake.repository,
    cards: fakeCardRepository(pool),
  });
  const panel = within(await screen.findByRole("region", { name: "Matchups" }));
  await panel.findByLabelText("Against");
  return { panel, fake, user: userEvent.setup() };
}
const row = (scope: ReturnType<typeof within>, name: string) =>
  within(scope.getByRole("row", { name: new RegExp(`^${name}`) }));

describe("matchups", () => {
  it("protects an edited plan when switching, and can discard it explicitly", async () => {
    const { panel, user } = await open([
      {
        id: "m1",
        deckId: "deck-1",
        name: "Race",
        heroId: null,
        cards: [{ variantId: "hp1", quantity: 3 }],
      },
      {
        id: "m2",
        deckId: "deck-1",
        name: "More defence",
        heroId: null,
        cards: [{ variantId: "ff1", quantity: 2 }],
      },
    ]);
    await user.click(
      panel.getByRole("button", { name: "Board out a Hocus Pocus (red)" }),
    );
    await user.click(panel.getByRole("button", { name: "Open More defence" }));
    const dialog = within(
      screen.getByRole("dialog", { name: "Unsaved plan changes" }),
    );
    await user.click(dialog.getByRole("button", { name: "Keep editing" }));
    expect(panel.getByLabelText("Plan name")).toHaveValue("Race");
    await user.click(panel.getByRole("button", { name: "Open More defence" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(panel.getByLabelText("Plan name")).toHaveValue("More defence");
    expect(
      panel.getByRole("button", { name: "Open More defence" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renames a generic plan by id and creates another rather than replacing it", async () => {
    const { panel, fake, user } = await open([
      { id: "m1", deckId: "deck-1", name: "Race", heroId: null, cards: [] },
    ]);
    const name = panel.getByLabelText("Plan name");
    await user.clear(name);
    await user.type(name, "More defence");
    await user.click(panel.getByRole("button", { name: "Save plan" }));
    expect(
      panel.getByRole("button", { name: "Open More defence" }),
    ).toBeInTheDocument();
    expect(await fake.repository.listMatchups("deck-1")).toEqual([
      expect.objectContaining({ id: "m1", name: "More defence", heroId: null }),
    ]);
    await user.click(panel.getByRole("button", { name: "+ New plan" }));
    await user.type(panel.getByLabelText("Plan name"), "Race again");
    await user.click(panel.getByRole("button", { name: "Save plan" }));
    expect(await fake.repository.listMatchups("deck-1")).toHaveLength(2);
  });

  it("keeps an unsaved draft after a failed save and rejects blank names", async () => {
    const { panel, fake, user } = await open();
    await user.click(panel.getByRole("button", { name: "Save plan" }));
    expect(fake.saved).toEqual([]);
    expect(panel.getByText(/Give the plan a name/)).toBeInTheDocument();
    await user.type(panel.getByLabelText("Plan name"), "More defence");
    vi.spyOn(fake.repository, "saveMatchup").mockRejectedValueOnce(
      new Error("offline"),
    );
    await user.click(panel.getByRole("button", { name: "Save plan" }));
    expect(await panel.findByRole("alert")).toHaveTextContent(
      "Your changes are still here",
    );
    expect(panel.getByLabelText("Plan name")).toHaveValue("More defence");
    await user.click(panel.getByRole("button", { name: "Save plan" }));
    expect(await panel.findByText("Plan saved")).toBeInTheDocument();
  });

  it("keeps rows compact, offers pictures, and folds real-game data away", async () => {
    const { panel, user } = await open();
    const cards = panel.getByRole("list", { name: "Deck for this matchup" });
    expect(cards).toHaveAttribute("data-view", "rows");
    expect(
      panel.queryByRole("region", { name: "Viserai in real games" }),
    ).toBeNull();
    await user.click(panel.getByRole("button", { name: "Pictures" }));
    expect(cards).toHaveAttribute("data-view", "pictures");
    await user.click(
      panel.getByText("Matchups in real games", { selector: "summary" }),
    );
    expect(
      await panel.findByRole("region", { name: "Viserai in real games" }),
    ).toBeInTheDocument();
  });

  it("counts a card split between the main deck and sideboard only once", async () => {
    const { panel } = await open([], HEROES, [
      card("hp1", 1),
      card("hp1", 2, true),
    ]);
    expect(
      panel.getByRole("heading", { name: "Deck · 1/60 cards" }),
    ).toBeInTheDocument();
    expect(
      panel.getByText("1 cards in the main deck for this matchup"),
    ).toBeInTheDocument();
  });

  it("creates a named plan without a hero, even when no heroes are imported", async () => {
    const { panel, fake, user } = await open([], []);
    expect(
      panel.getByRole("textbox", { name: "Plan name" }),
    ).toBeInTheDocument();
    await user.type(
      panel.getByRole("textbox", { name: "Plan name" }),
      "More defence",
    );
    expect(panel.getByLabelText("Against")).toHaveValue("");
    await user.click(panel.getByRole("button", { name: "Save plan" }));
    await waitFor(() =>
      expect(fake.saved).toContain("matchup deck-1 custom bsl3:2,hp1:3"),
    );
    expect(
      panel.getByRole("button", { name: "Open More defence" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  // The maintainer, 20 Oct 2026: the plan as card pictures, deck and sideboard side by side, with
  // arrows on hover to board a copy in or out.
  it("plans a matchup: starts as the main deck, boards in and out, and saves", async () => {
    const { panel, fake, user } = await open();
    await user.selectOptions(panel.getByLabelText("Against"), "h1");
    const plan = within(panel.getByRole("region", { name: "vs Example Hero" }));
    const deckSide = () =>
      within(plan.getByRole("list", { name: "Deck for this matchup" }));
    const sideboard = () =>
      within(plan.getByRole("list", { name: "Sideboard" }));
    expect(
      deckSide().getByRole("listitem", { name: "Hocus Pocus (red)" }),
    ).toHaveTextContent("×3");
    await user.click(
      deckSide().getByRole("button", {
        name: "Board out a Hocus Pocus (red)",
      }),
    );
    await user.click(
      sideboard().getByRole("button", {
        name: "Board in a Fate Foreseen (red)",
      }),
    );
    // A card split between the two shows on both sides, with its copies.
    expect(
      deckSide().getByRole("listitem", { name: "Hocus Pocus (red)" }),
    ).toHaveTextContent("×2");
    expect(
      sideboard().getByRole("listitem", { name: "Hocus Pocus (red)" }),
    ).toHaveTextContent("×1");
    expect(
      plan.getByText("In: Fate Foreseen (red) ×1 · Out: Hocus Pocus (red) ×1"),
    ).toBeInTheDocument();
    expect(
      plan.getByText("5 cards in the main deck for this matchup"),
    ).toBeInTheDocument();
    await user.click(plan.getByRole("button", { name: "Save plan" }));
    await waitFor(() =>
      expect(fake.saved).toContain("matchup deck-1 h1 bsl3:2,ff1:1,hp1:2"),
    );
  });

  // The maintainer, 22 Oct 2026: Save plan gave no sign it had worked.
  it("confirms a saved plan, until the plan changes again", async () => {
    const { panel, user } = await open();
    await user.selectOptions(panel.getByLabelText("Against"), "h1");
    const plan = within(panel.getByRole("region", { name: "vs Example Hero" }));
    expect(plan.queryByText("Plan saved")).toBeNull();
    await user.click(plan.getByRole("button", { name: "Save plan" }));
    expect(await plan.findByText("Plan saved")).toBeInTheDocument();
    await user.click(
      plan.getByRole("button", { name: "Board out a Hocus Pocus (red)" }),
    );
    expect(plan.queryByText("Plan saved")).toBeNull();
  });

  // Bug (the maintainer, 20 Oct 2026): "Matchups dont allow me to create a matchup". With no
  // heroes imported, the hero list was empty and said nothing.
  it("offers a custom plan when there are no heroes to plan against", async () => {
    const { panel } = await open([], []);
    expect(panel.getByLabelText("Against")).toHaveValue("");
    expect(panel.getByRole("textbox", { name: "Plan name" })).toBeEnabled();
  });

  // Bug (the maintainer, 20 Oct 2026): "The plan against doesn't include equipment". Gear was
  // sorted in among the cards; it now comes first, in a group of its own.
  // The maintainer, 20 Oct 2026: gear apart from the cards, in slot order (weapon, head, chest,
  // arms, legs), and the deck counted against its size.
  it("shows weapons and equipment apart, in slot order, and the deck against its size", async () => {
    const nebula = sampleCards.find((c) => c.name === "Nebula Blade")!;
    const gear = (id: string, name: string, slot: string) => ({
      ...nebula,
      id: `card-${id}`,
      name,
      type: "equipment",
      subtypes: [slot],
      variants: [{ ...nebula.variants[0]!, id }],
    });
    const { panel, user } = await open(
      [],
      HEROES,
      [...CARDS, card("legs", 1), card("nb", 1), card("helm", 1)],
      [
        ...sampleCards,
        gear("legs", "Test Greaves", "Legs"),
        gear("helm", "Test Helm", "Head"),
      ],
    );
    await user.selectOptions(panel.getByLabelText("Against"), "h1");
    const plan = within(panel.getByRole("region", { name: "vs Example Hero" }));
    const names = (list: string) =>
      within(plan.getByRole("list", { name: list }))
        .getAllByRole("listitem")
        .map((li) => li.getAttribute("aria-label"));
    await user.click(
      plan.getByText("Weapons and equipment", { selector: "summary" }),
    );
    expect(names("Weapons and equipment")).toEqual([
      "Nebula Blade",
      "Test Helm",
      "Test Greaves",
    ]);
    expect(names("Deck for this matchup")).toEqual([
      "Become the Shadow Lord (blue)",
      "Hocus Pocus (red)",
    ]);
    expect(
      plan.getByRole("heading", { name: "Deck · 5/60 cards" }),
    ).toBeInTheDocument();
  });

  it("never boards in more copies than the pool has", async () => {
    const { panel, user } = await open();
    await user.selectOptions(panel.getByLabelText("Against"), "h1");
    const plan = within(panel.getByRole("region", { name: "vs Example Hero" }));
    const sideboard = () =>
      within(plan.getByRole("list", { name: "Sideboard" }));
    for (const _ of [1, 2])
      await user.click(
        sideboard().getByRole("button", {
          name: "Board in a Fate Foreseen (red)",
        }),
      );
    expect(
      plan.queryByRole("list", { name: "Sideboard" }) &&
        sideboard().queryByRole("listitem", { name: "Fate Foreseen (red)" }),
    ).toBeFalsy();
  });

  it("lists saved plans with what goes in and out, and deletes one", async () => {
    const { panel, fake, user } = await open([
      {
        id: "m1",
        deckId: "deck-1",
        heroId: "h2",
        name: "vs Other Hero",
        cards: [
          { variantId: "hp1", quantity: 3 },
          { variantId: "bsl3", quantity: 1 },
          { variantId: "ff1", quantity: 1 },
        ],
      },
    ]);
    const saved = within(panel.getByRole("list", { name: "Planned matchups" }));
    expect(saved.getByRole("listitem")).toHaveTextContent("in 1 · out 1");
    await user.click(saved.getByRole("button", { name: "Open vs Other Hero" }));
    const plan = within(panel.getByRole("region", { name: "vs Other Hero" }));
    await user.click(plan.getByRole("button", { name: "Delete plan" }));
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Delete vs Other Hero?" }),
      ).getByRole("button", { name: "Delete it" }),
    );
    await waitFor(() => expect(fake.saved).toContain("delete matchup m1"));
    expect(panel.queryByRole("list", { name: "Planned matchups" })).toBeNull();
  });
});

// Part 3: goldfish and scenarios play a plan.
describe("playing a matchup", () => {
  const plan: Matchup = {
    id: "m1",
    deckId: "deck-1",
    heroId: "h1",
    name: "vs Example Hero",
    // Hocus Pocus 2 (one out), Become the Shadow Lord 2, Fate Foreseen 1 (in): 5 cards.
    cards: [
      { variantId: "hp1", quantity: 2 },
      { variantId: "bsl3", quantity: 2 },
      { variantId: "ff1", quantity: 1 },
    ],
  };
  const openAt = async (path: string, matchups = [plan]) => {
    const fake = fakeDeckRepository(
      [
        {
          id: "deck-1",
          name: "Gate tempo",
          updatedAt: "2026-10-14T10:00:00Z",
          cards: CARDS,
          pitchTargets: {},
        },
      ],
      { heroes: HEROES, matchups },
    );
    const { router } = await renderApp({
      path,
      auth: fakeAuthService({
        users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
        signedIn: { id: "u1", email: "u@test.local" },
      }).service,
      decks: fake.repository,
    });
    return { router, user: userEvent.setup() };
  };

  it("goldfish deals from the plan when one is chosen, and keeps it in the link", async () => {
    const { router, user } = await openAt("/decks/deck-1?tab=goldfish&seed=7");
    const playing = await screen.findByLabelText("Playing");
    await user.selectOptions(playing, "m1");
    expect(router.state.location.search).toMatchObject({ plan: "m1" });
    const goldfish = within(
      (await screen.findAllByRole("region", { name: "Goldfish" })).at(-1)!,
    );
    // 5 cards in the plan: 4 in hand, 1 left in the deck.
    expect(
      goldfish.getByRole("heading", { name: "Deck · 1" }),
    ).toBeInTheDocument();
  });

  it("plays a hero-free named plan and keeps it when moving between goldfish and scenarios", async () => {
    const { router, user } = await openAt("/decks/deck-1?tab=goldfish&seed=7", [
      { ...plan, name: "More defence", heroId: null },
    ]);
    await user.selectOptions(await screen.findByLabelText("Playing"), "m1");
    expect(router.state.location.search).toMatchObject({ plan: "m1", seed: 7 });
    expect(
      screen.getByRole("option", { name: "More defence · 5 cards" }),
    ).toBeInTheDocument();
    const goldfish = within(
      (await screen.findAllByRole("region", { name: "Goldfish" })).at(-1)!,
    );
    expect(
      goldfish.getByRole("heading", { name: "Deck · 1" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Scenarios" }));
    expect(router.state.location.search).toMatchObject({
      plan: "m1",
      tab: "scenarios",
    });
    expect(await screen.findByLabelText("Playing")).toHaveValue("m1");
    await user.click(screen.getByRole("tab", { name: "Goldfish" }));
    expect(await screen.findByLabelText("Playing")).toHaveValue("m1");
  });

  it("scenarios run on the plan's cards", async () => {
    await openAt("/decks/deck-1?tab=scenarios&vs=h1&mode=create");
    expect(await screen.findByLabelText("Playing")).toHaveValue("m1");
    const user = userEvent.setup();
    const builder = within(
      await screen.findByRole("region", { name: "Build a scenario" }),
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(
      await screen.findByText(/of 10,000 runs · seed 1 · 5 deck cards$/),
    ).toBeInTheDocument();
  });

  // The maintainer, 20 Oct 2026: goldfish should let you choose a matchup, or keep the main deck.
  it("always offers the choice on goldfish, with each list's card count", async () => {
    await openAt("/decks/deck-1?tab=goldfish&seed=7");
    const panel = within(await screen.findByRole("tabpanel"));
    const playing = await panel.findByLabelText("Playing");
    expect(playing).toHaveValue("");
    expect(
      within(playing)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Main deck · 5 cards", "vs Example Hero · 5 cards"]);
  });

  it("offers to plan a matchup when there are none yet", async () => {
    const { router, user } = await openAt(
      "/decks/deck-1?tab=goldfish&seed=7",
      [],
    );
    const panel = within(await screen.findByRole("tabpanel"));
    expect(await panel.findByLabelText("Playing")).toHaveValue("");
    await user.click(panel.getByRole("link", { name: "Plan a matchup" }));
    expect(router.state.location.search).toMatchObject({ tab: "matchups" });
  });
});
