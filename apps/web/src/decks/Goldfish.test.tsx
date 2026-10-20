// The goldfish tool (README "Goldfishing", phase two step 5), on the rules engine since step 8
// of docs/rules-engine.md: cards with verified rules are played by them, so Viserai, Runechants
// and Blood Debt happen by themselves; everything else is still moved by hand, as a sandbox.
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckCard, Hero } from "./deckRepository.ts";
import { encodeFixed } from "./goldfishLink.ts";

const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});
// 10 deck cards and a weapon.
const deck = [card("hp1", 3), card("bsl3", 3), card("ff1", 4), card("nb", 1)];
/** Equipment with energy counters, for its button (the maintainer, 20 Oct 2026). */
const FYENDAL = {
  ...sampleCards[3]!,
  id: "card-fyendal",
  name: "Fyendal's Spring Tunic",
  type: "equipment",
  subtypes: ["Chest"],
  classes: ["Generic"],
  attributes: { ...sampleCards[3]!.attributes, canAttack: false },
  variants: [{ ...sampleCards[3]!.variants[0]!, id: "fst" }],
};

async function open(
  path = "/decks/deck-1?tab=goldfish&seed=7",
  heroes: Hero[] = [],
  cards: DeckCard[] = deck,
) {
  await renderApp({
    path,
    cards: fakeCardRepository([...sampleCards, FYENDAL]),
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
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
      { heroes },
    ).repository,
  });
  // The latest render: one test opens the page twice.
  const table = within(
    (await screen.findAllByRole("region", { name: "Goldfish" })).at(-1)!,
  );
  return { table, user: userEvent.setup() };
}
const zone = (table: ReturnType<typeof within>, name: string) =>
  within(table.getByRole("region", { name }));
const zoneCards = (table: ReturnType<typeof within>, name: string) =>
  zone(table, name).queryAllByRole("listitem");
/** Picks an action from a card's menu. */
const act = async (
  user: ReturnType<typeof userEvent.setup>,
  card: HTMLElement,
  action: string,
) =>
  user.selectOptions(
    within(card).getByRole("combobox", {
      name: `Action for ${card.getAttribute("aria-label")}`,
    }),
    action,
  );

describe("goldfish", () => {
  it("deals a hand of 4 from the shuffled deck, with the weapon in play and the seed shown", async () => {
    const { table } = await open();
    expect(zoneCards(table, "Hand")).toHaveLength(4);
    expect(
      table.getByRole("heading", { name: "Deck · 6" }),
    ).toBeInTheDocument();
    expect(zoneCards(table, "Weapons")).toHaveLength(1);
    expect(table.getByText("Turn 1")).toBeInTheDocument();
    expect(table.getByText("Seed 7")).toBeInTheDocument();
    expect(table.getByText("On Forsaken")).toBeInTheDocument();
  });

  it("deals the same hand for the same seed", async () => {
    const first = (await open()).table;
    const hand = zoneCards(first, "Hand").map((li) => li.textContent);
    const again = await open();
    expect(
      zoneCards(
        within(screen.getAllByRole("region", { name: "Goldfish" }).at(-1)!),
        "Hand",
      ).map((li) => li.textContent),
    ).toEqual(hand);
    void again;
  });

  it("pitches a card from the hand, adding its pitch to resources", async () => {
    const { table, user } = await open();
    const [first] = zoneCards(table, "Hand");
    const name = first!.getAttribute("aria-label")!;
    await user.selectOptions(
      within(first!).getByRole("combobox", { name: `Action for ${name}` }),
      "Pitch",
    );
    expect(zoneCards(table, "Pitch")).toHaveLength(1);
    expect(zoneCards(table, "Hand")).toHaveLength(3);
    expect(table.getByText(/^Resources \d$/)).not.toHaveTextContent(
      "Resources 0",
    );
  });

  it("puts a card in the arena by hand, and moves it on", async () => {
    const { table, user } = await open();
    const [first] = zoneCards(table, "Hand");
    const name = first!.getAttribute("aria-label")!;
    await user.selectOptions(
      within(first!).getByRole("combobox", { name: `Action for ${name}` }),
      "To arena (by hand)",
    );
    const played = zoneCards(table, "Arena")[0]!;
    await user.selectOptions(
      within(played).getByRole("combobox", { name: `Action for ${name}` }),
      "Graveyard",
    );
    expect(zoneCards(table, "Graveyard")).toHaveLength(1);
  });

  it("counts tokens, and those created this turn", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "More Runechants" }));
    await user.click(table.getByRole("button", { name: "More Runechants" }));
    expect(
      table.getByText("Runechants 2 · 2 made this turn"),
    ).toBeInTheDocument();
  });

  it("traverses, ends the turn and undoes", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Traverse" }));
    expect(table.getByText("On Usurper")).toBeInTheDocument();
    const [first] = zoneCards(table, "Hand");
    await user.selectOptions(
      within(first!).getByRole("combobox", {
        name: `Action for ${first!.getAttribute("aria-label")}`,
      }),
      "Pitch",
    );
    await user.click(table.getByRole("button", { name: "End turn" }));
    expect(table.getByText("Turn 2")).toBeInTheDocument();
    expect(zoneCards(table, "Hand")).toHaveLength(4);
    expect(zoneCards(table, "Pitch")).toHaveLength(0);
    await user.click(table.getByRole("button", { name: "Undo" }));
    expect(table.getByText("Turn 1")).toBeInTheDocument();
    await user.click(table.getByRole("button", { name: "Redo" }));
    expect(table.getByText("Turn 2")).toBeInTheDocument();
  });

  it("keeps an action log", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Traverse" }));
    await user.click(table.getByRole("button", { name: "End turn" }));
    expect(
      within(table.getByRole("list", { name: "Action log" }))
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Traverse to Usurper", "End turn 1"]);
  });

  it("restarts with a new seed", async () => {
    const { table, user } = await open();
    const seed = table.getByRole("textbox", { name: "Seed" });
    await user.clear(seed);
    await user.type(seed, "99");
    await user.click(table.getByRole("button", { name: "Restart" }));
    expect(table.getByText("Seed 99")).toBeInTheDocument();
    expect(table.getByText("Turn 1")).toBeInTheDocument();
  });

  // Part 2 (README "Goldfishing").
  describe("the deck", () => {
    it("looks at the top cards, and moves one to the bottom", async () => {
      const { table, user } = await open();
      await user.click(table.getByRole("button", { name: "Open the deck" }));
      await user.click(table.getByRole("button", { name: "Look at top 3" }));
      const top = () =>
        within(table.getByRole("list", { name: "Top of deck" })).getAllByRole(
          "listitem",
        );
      const [first, second] = top();
      const name = first!.getAttribute("aria-label")!;
      const next = second!.getAttribute("aria-label");
      await user.selectOptions(
        within(first!).getByRole("combobox", { name: `Action for ${name}` }),
        "Bottom of deck",
      );
      expect(top()[0]!.getAttribute("aria-label")).toBe(next);
    });

    it("searches the deck for a card, then shuffles", async () => {
      const { table, user } = await open();
      await user.click(table.getByRole("button", { name: "Open the deck" }));
      const found = within(
        table.getByRole("list", { name: "Cards in the deck" }),
      ).getAllByRole("listitem")[0]!;
      await user.selectOptions(
        within(found).getByRole("combobox", {
          name: `Action for ${found.getAttribute("aria-label")}`,
        }),
        "Hand",
      );
      expect(zoneCards(table, "Hand")).toHaveLength(5);
      await user.click(
        table.getByRole("button", { name: "Shuffle and close" }),
      );
      expect(
        within(table.getByRole("list", { name: "Action log" }))
          .getAllByRole("listitem")
          .at(-1),
      ).toHaveTextContent("Shuffle the deck");
    });
  });

  describe("gear, life and damage", () => {
    it("attacks with the weapon, marked used until the end of the turn", async () => {
      const { table, user } = await open();
      const weapons = zone(table, "Weapons");
      await act(user, zoneCards(table, "Weapons")[0]!, "Attack");
      expect(weapons.getByText("Used this turn")).toBeInTheDocument();
      expect(weapons.getByRole("option", { name: "Attack" })).toBeDisabled();
      await user.click(table.getByRole("button", { name: "End turn" }));
      expect(weapons.queryByText("Used this turn")).toBeNull();
    });

    // The maintainer, 20 Oct 2026: only cards that need counters have them.
    it("keeps counters on gear, shown only once a card has one", async () => {
      const { table, user } = await open();
      const weapons = zone(table, "Weapons");
      expect(
        weapons.queryByRole("button", {
          name: "More counters on Nebula Blade",
        }),
      ).toBeNull();
      await act(user, zoneCards(table, "Weapons")[0]!, "Add a counter");
      // The maintainer, 20 Oct 2026: a mark on the card itself, with − and + underneath.
      const blade = within(zoneCards(table, "Weapons")[0]!);
      expect(blade.getByLabelText("1 counter")).toHaveTextContent("1");
      await user.click(
        blade.getByRole("button", { name: "More counters on Nebula Blade" }),
      );
      expect(blade.getByLabelText("2 counters")).toHaveTextContent("2");
      await user.click(
        blade.getByRole("button", { name: "Fewer counters on Nebula Blade" }),
      );
      await user.click(
        blade.getByRole("button", { name: "Fewer counters on Nebula Blade" }),
      );
      expect(blade.queryByLabelText(/counter/)).toBeNull();
    });

    it("counts life and damage", async () => {
      const { table, user } = await open();
      await user.click(table.getByRole("button", { name: "Fewer life" }));
      await user.click(table.getByRole("button", { name: "More damage" }));
      expect(table.getByText("Life 39")).toBeInTheDocument();
      expect(table.getByText("Damage 1 · 1 in total")).toBeInTheDocument();
    });

    it("banishes face down", async () => {
      const { table, user } = await open();
      const [first] = zoneCards(table, "Hand");
      const name = first!.getAttribute("aria-label")!;
      await user.selectOptions(
        within(first!).getByRole("combobox", { name: `Action for ${name}` }),
        "Banish face down",
      );
      expect(zoneCards(table, "Banished")[0]).toHaveAccessibleName(
        `${name} (face down)`,
      );
    });
  });

  it("recaps each turn", async () => {
    const { table, user } = await open();
    const [first] = zoneCards(table, "Hand");
    const name = first!.getAttribute("aria-label")!;
    await user.selectOptions(
      within(first!).getByRole("combobox", { name: `Action for ${name}` }),
      "Pitch",
    );
    await user.click(table.getByRole("button", { name: "More Runechants" }));
    await act(user, zoneCards(table, "Weapons")[0]!, "Attack");
    await user.click(table.getByRole("button", { name: "Traverse" }));
    await user.click(table.getByRole("button", { name: "End turn" }));
    expect(
      within(table.getByRole("list", { name: "Turn recaps" })).getByRole(
        "listitem",
      ),
    ).toHaveTextContent(
      `Turn 1: pitched ${name}; attacked with Nebula Blade; made 1 Runechant; traversed to Usurper.`,
    );
  });

  it("replays a shared session from its link", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Traverse" }));
    await user.click(table.getByRole("button", { name: "Share this session" }));
    const link = (
      table.getByRole("textbox", { name: "Share link" }) as HTMLInputElement
    ).value;
    const url = new URL(link);
    const { table: shared } = await open(`${url.pathname}${url.search}`);
    expect(shared.getByText("On Usurper")).toBeInTheDocument();
  });

  describe("faster play", () => {
    it("drags a card to another zone", async () => {
      const { table } = await open();
      const [first] = zoneCards(table, "Hand");
      fireEvent.dragStart(first!);
      fireEvent.drop(table.getByRole("region", { name: "Graveyard" }));
      expect(zoneCards(table, "Graveyard")).toHaveLength(1);
    });

    it("has keys for a focused card, and for the table", async () => {
      const { table, user } = await open();
      zoneCards(table, "Hand")[0]!.focus();
      await user.keyboard("i");
      expect(zoneCards(table, "Pitch")).toHaveLength(1);
      await user.keyboard("d");
      expect(zoneCards(table, "Hand")).toHaveLength(4);
      await user.keyboard("{Control>}z{/Control}");
      expect(zoneCards(table, "Hand")).toHaveLength(3);
    });
  });
});

// docs/rules-engine.md, step 8b: goldfish on the rules engine.
describe("by the rules", () => {
  /** A seed-7 game with these cards fixed in hand. */
  const withHand = (names: string[], extra = "") =>
    open(
      `/decks/deck-1?tab=goldfish&seed=7${extra}&fixed=${encodeFixed(
        names.map((name) => ({ name, zone: "hand" as const })),
      )}`,
    );
  const act = async (
    table: ReturnType<typeof within>,
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    action: string,
  ) => {
    const card = zoneCards(table, "Hand").find(
      (li) => li.getAttribute("aria-label") === label,
    )!;
    await user.selectOptions(
      within(card).getByRole("combobox", { name: `Action for ${label}` }),
      action,
    );
  };

  it("plays a card with verified rules by them, asking for the choice it needs", async () => {
    const { table, user } = await withHand([
      "Become the Shadow Lord",
      "Hocus Pocus",
    ]);
    await act(table, user, "Become the Shadow Lord (blue)", "Play");
    const choice = within(await table.findByRole("region", { name: "Choose" }));
    expect(choice.getByText("Banish a card from hand")).toBeInTheDocument();
    await user.click(
      choice.getAllByRole("button", { name: "Hocus Pocus (red)" })[0]!,
    );
    // Runeblade: a Runechant; Viserai then banishes the top card of the deck.
    expect(
      table.getByText("Runechants 1 · 1 made this turn"),
    ).toBeInTheDocument();
    expect(zoneCards(table, "Banished")).toHaveLength(2);
    expect(table.queryByRole("region", { name: "Choose" })).toBeNull();
  });

  it("says why the rules refuse an action", async () => {
    const { table, user } = await open();
    const blade = zoneCards(table, "Weapons")[0]!;
    await user.selectOptions(
      within(blade).getByRole("combobox", { name: "Action for Nebula Blade" }),
      "Pitch",
    );
    expect(table.getByRole("alert")).toHaveTextContent(
      "Nebula Blade can't be pitched.",
    );
  });

  it("asks before an optional trigger, in plain words", async () => {
    const { table, user } = await withHand(
      ["Become the Shadow Lord", "Become the Shadow Lord"],
      "&side=usurper",
    );
    await act(table, user, "Become the Shadow Lord (blue)", "Play");
    const choice = within(await table.findByRole("region", { name: "Choose" }));
    await user.click(choice.getAllByRole("button")[0]!);
    await user.click(table.getByRole("button", { name: "End turn" }));
    const confirm = within(
      await table.findByRole("region", { name: "Choose" }),
    );
    expect(
      confirm.getByText("Viserai, the Usurper: traverse to Forsaken?"),
    ).toBeInTheDocument();
    await user.click(confirm.getByRole("button", { name: "Yes" }));
    expect(table.getByText("On Forsaken")).toBeInTheDocument();
    expect(table.getByText("Turn 2")).toBeInTheDocument();
  });

  it("has no hero prompts any more: the engine resolves Viserai itself", async () => {
    const { table } = await open();
    expect(table.queryByText(/Hero prompts/)).toBeNull();
  });
});

// The maintainer, 19 Oct 2026: lay goldfish out like a FaB playmat (Fabrary and Talishar).
describe("the playmat", () => {
  it("puts the hero in the middle, showing its side", async () => {
    const { table, user } = await open();
    const hero = () => within(table.getByRole("region", { name: "Hero" }));
    expect(hero().getByText("Viserai, the Forsaken")).toBeInTheDocument();
    await user.click(table.getByRole("button", { name: "Traverse" }));
    expect(hero().getByText("Viserai, the Usurper")).toBeInTheDocument();
  });

  it("shows the equipment slots by name, empty until filled", async () => {
    const { table } = await open();
    const equipment = zone(table, "Equipment");
    for (const slot of ["Head", "Chest", "Arms", "Legs"])
      expect(
        equipment.getByRole("group", { name: `${slot} slot` }),
      ).toHaveTextContent(`${slot}Empty`);
  });

  it("lays the zones out in the mat's places", async () => {
    const { table } = await open();
    const places = [
      ...table
        .getByRole("region", { name: "Playmat" })
        .querySelectorAll("[data-place]"),
    ].map((el) => el.getAttribute("data-place"));
    expect(places).toEqual([
      "equipment",
      "arena",
      "graveyard",
      "weapons",
      "hero",
      "pitch",
      "deck",
      "arsenal",
      "banished",
      "hand",
    ]);
  });
});

// The maintainer, 20 Oct 2026: closer to Fabrary's draw view, with small cards on the board,
// piles with counts and a plain hand.
describe("the compact board", () => {
  it("says when nothing has been played this turn", async () => {
    const { table, user } = await open();
    expect(
      zone(table, "Arena").getByText("No cards played this turn"),
    ).toBeInTheDocument();
    const [first] = zoneCards(table, "Hand");
    await user.selectOptions(
      within(first!).getByRole("combobox", {
        name: `Action for ${first!.getAttribute("aria-label")}`,
      }),
      "To arena (by hand)",
    );
    expect(
      zone(table, "Arena").queryByText("No cards played this turn"),
    ).toBeNull();
  });

  it("shows each pile as a stack with its count", async () => {
    const { table, user } = await open();
    expect(zone(table, "Pitch").getByTestId("count")).toHaveTextContent("0");
    expect(zone(table, "Deck").getByTestId("count")).toHaveTextContent("6");
    await user.click(zoneCards(table, "Hand")[0]!);
    await user.keyboard("i");
    expect(zone(table, "Pitch").getByTestId("count")).toHaveTextContent("1");
  });

  it("names an empty zone in a card-sized space", async () => {
    const { table } = await open();
    expect(zone(table, "Banished").getByText("Banished")).toBeInTheDocument();
    expect(zone(table, "Graveyard").getByText("Graveyard")).toBeInTheDocument();
  });
});

// The maintainer, 20 Oct 2026: closer to the playmat in their screenshot (after Fabrary).
describe("closer to the playmat", () => {
  const VISERAI: Hero[] = [
    {
      id: "hf",
      name: "Viserai, the Forsaken",
      classes: ["Runeblade"],
      talents: ["Shadow"],
      imageUrl: "https://img.test/forsaken.png",
    },
    {
      id: "hu",
      name: "Viserai, Usurper",
      classes: ["Runeblade"],
      talents: ["Shadow"],
      imageUrl: "https://img.test/usurper.png",
    },
  ];

  it("shows Viserai's card for the side the hero is on", async () => {
    const { table, user } = await open(undefined, VISERAI);
    const hero = () => within(table.getByRole("region", { name: "Hero" }));
    expect(
      await hero().findByRole("img", { name: "Viserai, the Forsaken" }),
    ).toHaveAttribute("src", "https://img.test/forsaken.png");
    await user.click(table.getByRole("button", { name: "Traverse" }));
    expect(
      hero().getByRole("img", { name: "Viserai, the Usurper" }),
    ).toHaveAttribute("src", "https://img.test/usurper.png");
  });

  // The maintainer, 20 Oct 2026: "Button Viserai to traverse?"
  it("traverses when Viserai's card is clicked", async () => {
    const { table, user } = await open(undefined, VISERAI);
    const hero = within(table.getByRole("region", { name: "Hero" }));
    await user.click(
      await hero.findByRole("button", { name: "Traverse to Usurper" }),
    );
    expect(table.getByText("On Usurper")).toBeInTheDocument();
    await user.click(
      hero.getByRole("button", { name: "Traverse to Forsaken" }),
    );
    expect(table.getByText("On Forsaken")).toBeInTheDocument();
  });

  it("only counts the tokens the deck makes", async () => {
    // Hocus Pocus and Become the Shadow Lord make Runechants and Gates; nothing makes Eloquence.
    const { table } = await open();
    expect(
      table.getByRole("button", { name: "More Runechants" }),
    ).toBeVisible();
    expect(table.getByRole("button", { name: "More Gates" })).toBeVisible();
    expect(table.queryByRole("button", { name: "More Eloquence" })).toBeNull();
  });

  it("draws from the bar", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Draw" }));
    expect(zoneCards(table, "Hand")).toHaveLength(5);
  });

  it("opens the graveyard and the banished zone as a list", async () => {
    const { table, user } = await open();
    const [first] = zoneCards(table, "Hand");
    const name = first!.getAttribute("aria-label")!;
    await act(user, first!, "Graveyard");
    await user.click(table.getByRole("button", { name: "Open the graveyard" }));
    const list = within(table.getByRole("dialog", { name: "Graveyard" }));
    expect(list.getByRole("listitem", { name })).toBeInTheDocument();
    await act(user, list.getByRole("listitem", { name }), "Banish");
    await user.click(list.getByRole("button", { name: "Close" }));
    expect(table.queryByRole("dialog")).toBeNull();
    await user.click(
      table.getByRole("button", { name: "Open the banished zone" }),
    );
    expect(
      within(table.getByRole("dialog", { name: "Banished" })).getByRole(
        "listitem",
        { name },
      ),
    ).toBeInTheDocument();
  });

  it("pitches a card dropped on the pitch zone, by the rules", async () => {
    const { table } = await open();
    const [first] = zoneCards(table, "Hand");
    fireEvent.dragStart(first!);
    fireEvent.drop(table.getByRole("region", { name: "Pitch" }));
    expect(zoneCards(table, "Pitch")).toHaveLength(1);
    expect(table.getByText(/^Resources \d$/)).not.toHaveTextContent(
      "Resources 0",
    );
  });
});

// The maintainer, 20 Oct 2026, after playing a matchup.
describe("quicker turns", () => {
  it("banishes the top card of the deck from the bar", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Banish top" }));
    expect(zone(table, "Banished").getByTestId("count")).toHaveTextContent("1");
    expect(zone(table, "Deck").getByTestId("count")).toHaveTextContent("5");
  });

  it("plays a banished card with its Play button, other moves in its menu", async () => {
    const { table, user } = await open();
    const [first] = zoneCards(table, "Hand");
    const name = first!.getAttribute("aria-label")!;
    await act(user, first!, "Banish");
    await user.click(
      table.getByRole("button", { name: "Open the banished zone" }),
    );
    const list = within(table.getByRole("dialog", { name: "Banished" }));
    const banished = list.getByRole("listitem", { name });
    expect(
      within(banished).getByRole("combobox", { name: `Action for ${name}` }),
    ).toBeInTheDocument();
    await user.click(
      within(banished).getByRole("button", { name: `Play ${name}` }),
    );
    expect(zoneCards(table, "Banished")).toHaveLength(0);
  });

  it("clears the arena to the graveyard when the turn ends", async () => {
    const { table, user } = await open();
    await act(user, zoneCards(table, "Hand")[0]!, "To arena (by hand)");
    await user.click(table.getByRole("button", { name: "End turn" }));
    expect(zoneCards(table, "Arena")).toHaveLength(0);
    expect(zone(table, "Graveyard").getByTestId("count")).toHaveTextContent(
      "1",
    );
  });

  // Signed off by the maintainer, 20 Oct 2026: "Instant – Remove 3 energy counters from this:
  // Gain {r}".
  it("spends Fyendal's Spring Tunic's 3 counters for a resource", async () => {
    const { table, user } = await open(
      undefined,
      [],
      [...deck, card("fst", 1)],
    );
    const tunic = () =>
      zone(table, "Equipment").getByRole("listitem", {
        name: "Fyendal's Spring Tunic",
      });
    expect(
      within(tunic()).queryByRole("button", { name: /Gain a resource/ }),
    ).toBeNull();
    await act(user, tunic(), "Add a counter");
    const more = within(tunic()).getByRole("button", {
      name: "More counters on Fyendal's Spring Tunic",
    });
    await user.click(more);
    await user.click(more);
    await user.click(
      within(tunic()).getByRole("button", {
        name: "Remove 3 counters: Gain a resource",
      }),
    );
    expect(table.getByText("Resources 1")).toBeInTheDocument();
    expect(within(tunic()).queryByLabelText(/counter/)).toBeNull();
  });
});

// The maintainer, 20 Oct 2026: close lists by clicking outside, and show the deck as it'll be drawn.
describe("the lists", () => {
  it("closes when you click outside it", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Open the deck" }));
    expect(table.getByRole("dialog", { name: "Deck" })).toBeInTheDocument();
    await user.click(screen.getByTestId("pile-backdrop"));
    expect(table.queryByRole("dialog")).toBeNull();
  });

  it("lists the deck in the order it'll be drawn", async () => {
    const { table, user } = await open();
    await user.click(table.getByRole("button", { name: "Open the deck" }));
    await user.click(table.getByRole("button", { name: "Look at top 3" }));
    const names = (list: string) =>
      within(table.getByRole("list", { name: list }))
        .getAllByRole("listitem")
        .map((li) => li.getAttribute("aria-label"));
    expect(names("Cards in the deck").slice(0, 3)).toEqual(
      names("Top of deck"),
    );
    // Drawing takes the first card in the list.
    const first = names("Cards in the deck")[0];
    await user.click(table.getByRole("button", { name: "Draw" }));
    expect(
      zoneCards(table, "Hand").map((li) => li.getAttribute("aria-label")),
    ).toContain(first);
  });
});
