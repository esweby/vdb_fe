import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CARD_RULES } from "@vdb/engine/rules";
import { expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { Goldfish } from "./Goldfish.tsx";

it("offers all life-payment amounts and records the choice through undo and redo", async () => {
  const card = { ...sampleCards[0]!, name: "Payment example", type: "action" };
  const variant = { ...card.variants[0]!, pitch: 3, cost: 0 };
  CARD_RULES[card.name] = {
    effects: [{ op: "payLifeForToken", token: "runechant", maximum: 3 }],
  };
  try {
    render(
      <Goldfish
        seed={1}
        entries={[{ card, variant, quantity: 4, sideboard: false }]}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getAllByRole("combobox", {
        name: /^Action for Payment example/,
      })[0]!,
      "Play",
    );
    const choice = within(screen.getByRole("region", { name: "Choose" }));
    for (const amount of ["0", "1", "2", "3"])
      expect(choice.getByRole("button", { name: amount })).toBeInTheDocument();
    expect(screen.getByText("Life 40")).toBeInTheDocument();
    await user.click(choice.getByRole("button", { name: "2" }));
    expect(screen.getByText("Life 38")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Life 40")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByText("Life 38")).toBeInTheDocument();
  } finally {
    delete CARD_RULES[card.name];
  }
});
