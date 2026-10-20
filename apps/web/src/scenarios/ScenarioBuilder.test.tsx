// Scenarios stage 1 (README "Scenarios", phase two step 6): build a rule from blocks and run it
// against a deck, on the deck's Scenarios tab.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DeckCard } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});
// Hocus Pocus (red) ×3, Become the Shadow Lord (blue) ×2, and Nebula Blade.
const DECK = [card("hp1", 3), card("bsl3", 2), card("nb", 1)];

async function open() {
  await renderApp({
    path: "/decks/deck-1?tab=scenarios",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: DECK,
        pitchTargets: {},
      },
    ]).repository,
  });
  const builder = within(
    await screen.findByRole("region", { name: "Build a scenario" }),
  );
  return { builder, user: userEvent.setup() };
}
const block = (b: ReturnType<typeof within>, n: number) =>
  within(b.getByRole("group", { name: `Block ${n}` }));
/** Filters show only once added (the maintainer, 19 Oct 2026: too many fields at once). */
async function filter(
  user: ReturnType<typeof userEvent.setup>,
  scope: ReturnType<typeof within>,
  label: string,
) {
  await user.selectOptions(scope.getByLabelText("Add a filter"), label);
  return scope.getByLabelText(label);
}
const result = () =>
  within(screen.getByRole("region", { name: "Scenario result" }));

describe("building a scenario", () => {
  it("starts with one block, and runs it on the deck", async () => {
    const { builder, user } = await open();
    await user.selectOptions(
      await filter(user, block(builder, 1), "Pitch"),
      "3",
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(
      await result().findByText(/of 10,000 runs · seed 1 · 5 deck cards$/),
    ).toBeInTheDocument();
    expect(result().getByText("at least 1 blue card")).toBeInTheDocument();
  });

  it("fixes a card in hand, taking a copy out of the deck", async () => {
    const { builder, user } = await open();
    await user.click(builder.getByRole("button", { name: "Add a fixed card" }));
    const fixed = within(builder.getByRole("group", { name: "Fixed card 1" }));
    await user.selectOptions(
      fixed.getByLabelText("Card"),
      "Become the Shadow Lord (blue)",
    );
    await user.selectOptions(
      await filter(user, block(builder, 1), "Card"),
      "Become the Shadow Lord",
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(await result().findByText(/^100\.0%/)).toBeInTheDocument();
  });

  it("says when the deck lacks the copies to fix", async () => {
    const { builder, user } = await open();
    for (let i = 1; i <= 3; i++) {
      await user.click(
        builder.getByRole("button", { name: "Add a fixed card" }),
      );
      await user.selectOptions(
        within(
          builder.getByRole("group", { name: `Fixed card ${i}` }),
        ).getByLabelText("Card"),
        "Become the Shadow Lord (blue)",
      );
    }
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(
      await result().findByText(
        "Can't run on this deck: Needs 3 copies of Become the Shadow Lord (blue); the deck has 2.",
      ),
    ).toBeInTheDocument();
  });

  it("always sees the weapon", async () => {
    const { builder, user } = await open();
    await user.selectOptions(
      await filter(user, block(builder, 1), "Type"),
      "weapon",
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(await result().findByText(/^100\.0%/)).toBeInTheDocument();
  });

  it("groups failures by the block that wasn't met", async () => {
    const { builder, user } = await open();
    await user.selectOptions(
      await filter(user, block(builder, 1), "Type"),
      "instant",
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    const why = within(
      await result().findByRole("list", { name: "Why runs failed" }),
    );
    expect(why.getByRole("listitem")).toHaveTextContent(
      "100% of failed runs missed “at least 1 instant card”",
    );
  });

  it("combines blocks with all or any, and nests groups", async () => {
    const { builder, user } = await open();
    await user.selectOptions(
      await filter(user, block(builder, 1), "Pitch"),
      "3",
    );
    await user.click(builder.getByRole("button", { name: "Add a block" }));
    const second = block(builder, 2);
    await user.selectOptions(await filter(user, second, "Pitch"), "1");
    const amount = second.getByRole("textbox", { name: "Amount" });
    await user.clear(amount);
    await user.type(amount, "5");
    const run = () =>
      user.click(builder.getByRole("button", { name: "Run this scenario" }));
    await run();
    expect(await result().findByText(/^0\.0%/)).toBeInTheDocument();
    await user.selectOptions(builder.getByLabelText("Match"), "any");
    await run();
    // 5 cards, no blanks: any hand of 4 holds a blue card.
    expect(await result().findByText(/^100\.0%/)).toBeInTheDocument();

    await user.click(builder.getByRole("button", { name: "Add a group" }));
    const group = within(builder.getByRole("group", { name: "Group 2" }));
    expect(group.getByRole("group", { name: "Block 3" })).toBeInTheDocument();
  });

  it("won't run an empty group, and says why", async () => {
    const { builder, user } = await open();
    await user.click(
      block(builder, 1).getByRole("button", { name: "Remove block" }),
    );
    expect(builder.getByText("Add a block to check.")).toBeInTheDocument();
    expect(
      builder.getByRole("button", { name: "Run this scenario" }),
    ).toBeDisabled();
  });

  it("checks by a later turn, with a breakdown by turn", async () => {
    const { builder, user } = await open();
    await user.selectOptions(builder.getByLabelText("Check"), "3");
    await user.selectOptions(builder.getByLabelText("Between turns"), "drawUp");
    await user.click(builder.getByRole("checkbox", { name: "Arsenal" }));
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    const byTurn = within(
      await result().findByRole("list", { name: "By turn" }),
    );
    expect(byTurn.getAllByRole("listitem")).toHaveLength(3);
  });

  it("starts from a built-in scenario", async () => {
    const { builder, user } = await open();
    await user.selectOptions(
      builder.getByLabelText("Start from"),
      "Opening hand has a blue card to pitch",
    );
    expect(builder.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Opening hand has a blue card to pitch",
    );
    expect(block(builder, 1).getByLabelText("Pitch")).toHaveValue("3");
  });
});

// Scenarios stage 2 (README "Steps (the flow)", phase two step 9).
describe("scripted steps", () => {
  it("puts a card in arsenal on turn 1, checked after the turn's steps", async () => {
    const { builder, user } = await open();
    await user.click(builder.getByRole("button", { name: "Add a fixed card" }));
    await user.selectOptions(
      within(
        builder.getByRole("group", { name: "Fixed card 1" }),
      ).getByLabelText("Card"),
      "Become the Shadow Lord (blue)",
    );
    // Steps need a turn: the opening hand has none.
    await user.selectOptions(builder.getByLabelText("Check"), "1");
    await user.click(builder.getByRole("button", { name: "Add a step" }));
    const step = within(builder.getByRole("group", { name: "Step 1" }));
    await user.selectOptions(step.getByLabelText("When"), "1");
    await user.selectOptions(step.getByLabelText("Do"), "arsenal");
    await user.selectOptions(
      await filter(user, step, "Card"),
      "Become the Shadow Lord",
    );
    await user.click(builder.getByRole("checkbox", { name: "Hand" }));
    await user.click(builder.getByRole("checkbox", { name: "Arsenal" }));
    await user.selectOptions(
      await filter(user, block(builder, 1), "Card"),
      "Become the Shadow Lord",
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(await result().findByText(/^100\.0%/)).toBeInTheDocument();
  });

  it("draws extra cards with a count", async () => {
    const { builder, user } = await open();
    await user.selectOptions(builder.getByLabelText("Check"), "2");
    await user.click(builder.getByRole("button", { name: "Add a step" }));
    const step = within(builder.getByRole("group", { name: "Step 1" }));
    await user.selectOptions(step.getByLabelText("Do"), "draw");
    const count = step.getByRole("textbox", { name: "How many" });
    await user.clear(count);
    await user.type(count, "x");
    expect(
      builder.getByText("Step counts are whole numbers, 1 or more."),
    ).toBeInTheDocument();
    await user.clear(count);
    await user.type(count, "2");
    expect(builder.queryByText(/Step counts/)).toBeNull();
  });

  it("can see the banished zone, and only takes steps once a turn is chosen", async () => {
    const { builder, user } = await open();
    expect(
      builder.getByRole("checkbox", { name: "Banished zone" }),
    ).toBeInTheDocument();
    // The opening hand is checked before any steps run.
    expect(builder.getByRole("button", { name: "Add a step" })).toBeDisabled();
    expect(builder.getByText(/choose a turn under When/)).toBeInTheDocument();
    await user.selectOptions(builder.getByLabelText("Check"), "2");
    await user.click(builder.getByRole("button", { name: "Add a step" }));
    await user.click(
      within(builder.getByRole("group", { name: "Step 1" })).getByRole(
        "button",
        { name: "Remove step" },
      ),
    );
    expect(builder.queryByRole("group", { name: "Step 1" })).toBeNull();
  });
});

// The maintainer, 19 Oct 2026: too many fields at once, hard to read back, steps and fixed
// cards unclear.
describe("the form", () => {
  it("reads back as one sentence, as you edit", async () => {
    const { builder, user } = await open();
    const readsAs = () =>
      within(builder.getByRole("region", { name: "Reads as" }));
    expect(
      readsAs().getByText("In your opening hand: at least 1 card."),
    ).toBeInTheDocument();
    await user.selectOptions(
      await filter(user, block(builder, 1), "Pitch"),
      "3",
    );
    expect(
      readsAs().getByText("In your opening hand: at least 1 blue card."),
    ).toBeInTheDocument();
  });

  it("is laid out as five numbered sections, in the order they apply", async () => {
    const { builder } = await open();
    expect(
      builder
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
        .slice(0, 5),
    ).toEqual([
      "1. When",
      "2. Starting with",
      "3. Each turn",
      "4. Look at",
      "5. Succeeds if",
    ]);
  });

  it("shows a block's filters only once added, each removable", async () => {
    const { builder, user } = await open();
    const first = block(builder, 1);
    expect(first.queryByLabelText("Pitch")).toBeNull();
    await user.selectOptions(await filter(user, first, "Pitch"), "3");
    expect(first.getByText("at least 1 blue card")).toBeInTheDocument();
    await user.click(
      first.getByRole("button", { name: "Remove the Pitch filter" }),
    );
    expect(first.queryByLabelText("Pitch")).toBeNull();
    expect(first.getByText("at least 1 card")).toBeInTheDocument();
  });
});
