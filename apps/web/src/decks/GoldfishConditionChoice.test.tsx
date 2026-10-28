// Approved red rules with synthetic display names to isolate the choice interface.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CARD_RULES, verifiedRulesFor } from "@esweby/fab-engine/rules";
import { expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { Goldfish } from "./Goldfish.tsx";

it.each([true, false])(
  "records an explicit life-comparison answer of %s through undo/redo",
  async (yes) => {
    const card = {
      ...sampleCards[0]!,
      name: "Draft Scar",
      type: "attack_action",
      attributes: { ...sampleCards[0]!.attributes, hasGoAgain: true },
    };
    const rules = verifiedRulesFor("Scar for a Scar", 1);
    expect(rules).toBeDefined();
    CARD_RULES[card.name] = rules!;
    try {
      render(
        <Goldfish
          seed={17}
          entries={[
            {
              card,
              variant: { ...card.variants[0]!, cost: 0 },
              quantity: 4,
              sideboard: false,
            },
          ]}
        />,
      );
      const user = userEvent.setup();
      await user.selectOptions(
        screen.getAllByRole("combobox", { name: /^Action for Draft Scar/ })[0]!,
        "Play",
      );
      const choice = within(screen.getByRole("region", { name: "Choose" }));
      expect(
        choice.getByText("Do you have less life than an opposing hero?"),
      ).toBeInTheDocument();
      await user.click(
        choice.getByRole("button", { name: yes ? "Yes" : "No" }),
      );
      expect(screen.queryByRole("region", { name: "Choose" })).toBeNull();
      expect(
        screen.getByText(`Action points ${yes ? 1 : 0}`),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Undo" }));
      expect(screen.getByText("Action points 1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Redo" }));
      expect(
        screen.getByText(`Action points ${yes ? 1 : 0}`),
      ).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Choose" })).toBeNull();
    } finally {
      delete CARD_RULES[card.name];
    }
  },
);

it("offers Cull's instant mode at zero action points, then asks which hand card to banish", async () => {
  const card = {
    ...sampleCards[0]!,
    name: "Draft Cull",
    type: "action",
    attributes: { ...sampleCards[0]!.attributes, hasGoAgain: false },
  };
  const rules = verifiedRulesFor("Cull", 1);
  expect(rules).toBeDefined();
  CARD_RULES[card.name] = rules!;
  try {
    render(
      <Goldfish
        seed={17}
        entries={[
          {
            card,
            variant: { ...card.variants[0]!, cost: 0 },
            quantity: 4,
            sideboard: false,
          },
        ]}
      />,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Fewer action points" }),
    );
    await user.selectOptions(
      screen.getAllByRole("combobox", { name: /^Action for Draft Cull/ })[0]!,
      "Play",
    );
    let choice = within(screen.getByRole("region", { name: "Choose" }));
    expect(
      choice.getByText(/Only choose Yes if a hero has lost life this turn/),
    ).toBeInTheDocument();
    await user.click(choice.getByRole("button", { name: "Yes" }));
    choice = within(screen.getByRole("region", { name: "Choose" }));
    expect(choice.getByText("Banish a card from hand")).toBeInTheDocument();
    await user.click(choice.getAllByRole("button", { name: /Draft Cull/ })[0]!);
    expect(screen.getByText("Action points 0")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Choose" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.queryByRole("region", { name: "Choose" })).toBeNull();
  } finally {
    delete CARD_RULES[card.name];
  }
});
