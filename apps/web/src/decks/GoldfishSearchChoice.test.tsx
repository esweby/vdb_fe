import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CARD_RULES } from "@vdb/engine/rules";
import { expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { Goldfish } from "./Goldfish.tsx";
import { encodeFixed } from "./goldfishLink.ts";

it("offers the searched aura and replays the selection through undo and redo", async () => {
  const source = { ...sampleCards[0]!, name: "Search example", type: "action" };
  const variant = { ...source.variants[0]!, id: "search-example", cost: 0 };
  const aura = { ...source, name: "Runechant of Envy", subtypes: ["Aura"] };
  const auraVariant = { ...variant, id: "envy-example" };
  CARD_RULES[source.name] = { effects: [{ op: "searchRunechantAura" }] };
  try {
    render(
      <Goldfish
        seed={17}
        fixed={encodeFixed(
          Array.from({ length: 4 }, () => ({
            name: source.name,
            zone: "hand" as const,
          })),
        )}
        entries={[
          { card: source, variant, quantity: 4, sideboard: false },
          { card: aura, variant: auraVariant, quantity: 1, sideboard: false },
        ]}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getAllByRole("combobox", {
        name: /^Action for Search example/,
      })[0]!,
      "Play",
    );
    const choice = within(screen.getByRole("region", { name: "Choose" }));
    await user.click(choice.getByRole("button", { name: /Runechant of Envy/ }));
    const arena = within(screen.getByRole("region", { name: "Arena" }));
    expect(
      arena.getByRole("listitem", { name: /Runechant of Envy/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      arena.queryByRole("listitem", { name: /Runechant of Envy/ }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(
      arena.getByRole("listitem", { name: /Runechant of Envy/ }),
    ).toBeInTheDocument();
  } finally {
    delete CARD_RULES[source.name];
  }
});
