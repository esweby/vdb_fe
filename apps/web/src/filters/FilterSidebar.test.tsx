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

  it("doesn't add anything above the groups when filtering", async () => {
    render(<Harness />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /^Go again/ }));
    expect(
      screen.queryByRole("button", { name: /^Remove/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear all filters" }),
    ).not.toBeInTheDocument();
  });

  it("clears one group with its own Clear button, shown only when it has a selection", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    expect(
      screen.queryByRole("button", { name: "Clear Keywords" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Go again/ }));
    await user.click(screen.getByRole("button", { name: /^Blood debt/ }));
    await user.click(screen.getByRole("button", { name: /^Blood debt/ }));
    await user.click(screen.getByRole("button", { name: "Clear Keywords" }));
    expect(
      screen.getByRole("button", { name: /^Go again/ }),
    ).toHaveAccessibleName(/not filtered$/);
    expect(
      screen.getByRole("button", { name: /^Blood debt/ }),
    ).toHaveAccessibleName(/not filtered$/);
    expect(
      screen.queryByRole("button", { name: "Clear Keywords" }),
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
