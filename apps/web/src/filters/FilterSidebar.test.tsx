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

const include = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^Include ${label},`) });
const exclude = (label: string) =>
  screen.getByRole("button", { name: `Exclude ${label}` });

describe("FilterSidebar", () => {
  it("has a green include and a red exclude button for each value", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    expect(include("Go again")).toHaveAccessibleName(
      "Include Go again, 2 cards",
    );
    expect(include("Go again")).toHaveAttribute("aria-pressed", "false");
    expect(exclude("Go again")).toHaveAttribute("aria-pressed", "false");

    await user.click(include("Go again"));
    expect(include("Go again")).toHaveAttribute("aria-pressed", "true");

    // Exclude replaces include
    await user.click(exclude("Go again"));
    expect(exclude("Go again")).toHaveAttribute("aria-pressed", "true");
    expect(include("Go again")).toHaveAttribute("aria-pressed", "false");

    // Clicking the active button turns it off
    await user.click(exclude("Go again"));
    expect(exclude("Go again")).toHaveAttribute("aria-pressed", "false");
  });

  it("doesn't add anything above the groups when filtering", async () => {
    render(<Harness />);
    await userEvent.setup().click(include("Go again"));
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
    await user.click(include("Go again"));
    await user.click(exclude("Blood debt"));
    await user.click(screen.getByRole("button", { name: "Clear Keywords" }));
    expect(include("Go again")).toHaveAttribute("aria-pressed", "false");
    expect(exclude("Blood debt")).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Clear Keywords" }),
    ).not.toBeInTheDocument();
  });

  it("updates counts as filters change", async () => {
    render(<Harness />);
    await userEvent.setup().click(include("Go again"));
    // ALL group: cards with Go again and Blood debt
    expect(include("Blood debt")).toHaveAccessibleName(
      "Include Blood debt, 1 card",
    );
  });
});
