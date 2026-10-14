import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Facet, FilterState } from "./applyFilters.ts";
import { FilterSidebar } from "./FilterSidebar.tsx";

type Card = { tags: string[] };
const cards: Card[] = [
  { tags: ["go"] },
  { tags: ["go", "debt"] },
  { tags: [] },
];
const facets: Facet<Card>[] = [
  {
    id: "keywords",
    label: "Keywords",
    mode: "all",
    values: [
      { id: "go", label: "Go again", test: (c) => c.tags.includes("go") },
      { id: "debt", label: "Blood debt", test: (c) => c.tags.includes("debt") },
    ],
  },
];

function Harness() {
  const [state, setState] = useState<FilterState>({});
  return (
    <FilterSidebar
      items={cards}
      facets={facets}
      state={state}
      onChange={setState}
    />
  );
}

describe("FilterSidebar", () => {
  it("cycles a value: neutral, include, exclude, neutral", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const go = () => screen.getByRole("button", { name: /^Go again/ });
    expect(go()).toHaveAccessibleName("Go again, 2 cards, not filtered");
    await user.click(go());
    expect(go()).toHaveAccessibleName("Go again, 2 cards, included");
    await user.click(go());
    expect(go()).toHaveAccessibleName("Go again, 2 cards, excluded");
    await user.click(go());
    expect(go()).toHaveAccessibleName("Go again, 2 cards, not filtered");
  });

  it("shows active filters as removable chips, and clears all", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Go again/ }));
    await user.click(screen.getByRole("button", { name: /^Blood debt/ }));
    await user.click(screen.getByRole("button", { name: /^Blood debt/ }));
    expect(
      screen.getByRole("button", { name: "Remove Include: Go again" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove Exclude: Blood debt" }),
    );
    expect(
      screen.queryByRole("button", { name: /^Remove Exclude/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(
      screen.queryByRole("button", { name: /^Remove/ }),
    ).not.toBeInTheDocument();
  });

  it("updates counts as filters change", async () => {
    render(<Harness />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /^Go again/ }));
    // Blood debt count within the 'all' keywords group: cards with go AND debt
    expect(
      screen.getByRole("button", { name: /^Blood debt/ }),
    ).toHaveAccessibleName("Blood debt, 1 card, not filtered");
  });
});
