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
const result = () =>
  within(screen.getByRole("region", { name: "Scenario result" }));

describe("building a scenario", () => {
  it("starts with one block, and runs it on the deck", async () => {
    const { builder, user } = await open();
    await user.selectOptions(block(builder, 1).getByLabelText("Pitch"), "3");
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(
      await result().findByText(
        /of 10,000 runs · seed 1 · 5 deck cards \+ 55 blanks \(60\)$/,
      ),
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
      block(builder, 1).getByLabelText("Card"),
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
      block(builder, 1).getByLabelText("Type"),
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
      block(builder, 1).getByLabelText("Type"),
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
    await user.selectOptions(block(builder, 1).getByLabelText("Pitch"), "3");
    await user.click(builder.getByRole("button", { name: "Add a block" }));
    const second = block(builder, 2);
    await user.selectOptions(second.getByLabelText("Pitch"), "1");
    const amount = second.getByRole("textbox", { name: "Amount" });
    await user.clear(amount);
    await user.type(amount, "5");
    const run = () =>
      user.click(builder.getByRole("button", { name: "Run this scenario" }));
    await run();
    expect(await result().findByText(/^0\.0%/)).toBeInTheDocument();
    await user.selectOptions(builder.getByLabelText("Match"), "any");
    await run();
    expect(await result().findByText(/^[1-9]\d?\.\d%/)).toBeInTheDocument();

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
    await user.click(builder.getByRole("button", { name: "Add a step" }));
    const step = within(builder.getByRole("group", { name: "Step 1" }));
    await user.selectOptions(step.getByLabelText("When"), "1");
    await user.selectOptions(step.getByLabelText("Do"), "arsenal");
    await user.selectOptions(
      step.getByLabelText("Card"),
      "Become the Shadow Lord",
    );
    await user.selectOptions(builder.getByLabelText("Check"), "1");
    await user.click(builder.getByRole("checkbox", { name: "Hand" }));
    await user.click(builder.getByRole("checkbox", { name: "Arsenal" }));
    await user.selectOptions(
      block(builder, 1).getByLabelText("Card"),
      "Become the Shadow Lord",
    );
    await user.click(
      builder.getByRole("button", { name: "Run this scenario" }),
    );
    expect(await result().findByText(/^100\.0%/)).toBeInTheDocument();
  });

  it("draws extra cards with a count", async () => {
    const { builder, user } = await open();
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

  it("can see the banished zone, and says steps don't run for the opening hand", async () => {
    const { builder, user } = await open();
    expect(
      builder.getByRole("checkbox", { name: "Banished zone" }),
    ).toBeInTheDocument();
    await user.click(builder.getByRole("button", { name: "Add a step" }));
    expect(
      builder.getByText(/The opening hand is checked before any steps/),
    ).toBeInTheDocument();
    await user.click(
      within(builder.getByRole("group", { name: "Step 1" })).getByRole(
        "button",
        {
          name: "Remove step",
        },
      ),
    );
    expect(builder.queryByRole("group", { name: "Step 1" })).toBeNull();
  });
});
