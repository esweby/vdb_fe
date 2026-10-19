// The goldfish tool (README "Goldfishing", phase two step 5): a sandbox for playing a deck's
// turns alone. The user moves every card; the tool keeps count and enforces no game rules.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckCard } from "./deckRepository.ts";

const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});
// 10 deck cards and a weapon.
const deck = [card("hp1", 3), card("bsl3", 3), card("ff1", 4), card("nb", 1)];

async function open(path = "/decks/deck-1?tab=goldfish&seed=7") {
  await renderApp({
    path,
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: deck,
        pitchTargets: {},
      },
    ]).repository,
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

  it("plays a card to the arena, and moves it on", async () => {
    const { table, user } = await open();
    const [first] = zoneCards(table, "Hand");
    const name = first!.getAttribute("aria-label")!;
    await user.selectOptions(
      within(first!).getByRole("combobox", { name: `Action for ${name}` }),
      "Play",
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
});
