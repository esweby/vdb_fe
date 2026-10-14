import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Facet, FilterState } from "./applyFilters.ts";
import { FilterBar } from "./FilterBar.tsx";
import { FilterSidebar } from "./FilterSidebar.tsx";

type Card = { type: string; tags: string[] };
const cards: Card[] = [
  { type: "action", tags: ["go"] },
  { type: "action", tags: ["go", "debt"] },
  { type: "instant", tags: [] },
  { type: "equipment", tags: [] },
];
const facets: Facet<Card>[] = [
  {
    id: "type",
    label: "Card type",
    mode: "any",
    kind: "exclusive",
    values: ["action", "instant", "equipment"].map((t) => ({
      id: t,
      label: t[0]!.toUpperCase() + t.slice(1),
      test: (c: Card) => c.type === t,
    })),
  },
  {
    id: "slot",
    label: "Equipment slot",
    mode: "any",
    kind: "exclusive",
    showWhen: (state) => state.type?.equipment !== "exclude",
    values: [
      { id: "head", label: "Head", test: (c) => c.type === "equipment" },
    ],
  },
  {
    id: "keywords",
    label: "Keywords",
    mode: "all",
    kind: "feature",
    section: "Mechanics",
    values: [
      { id: "go", label: "Go again", test: (c) => c.tags.includes("go") },
      { id: "debt", label: "Blood debt", test: (c) => c.tags.includes("debt") },
    ],
  },
];

let latest: FilterState = {};
function Harness(props: { initial?: FilterState }) {
  const [state, setState] = useState<FilterState>(props.initial ?? {});
  latest = state;
  return (
    <>
      <FilterBar
        items={cards}
        facets={[{ ...facets[0]!, placement: "bar" }]}
        state={state}
        onChange={setState}
      />
      <FilterSidebar
        items={cards}
        facets={facets}
        state={state}
        onChange={setState}
      />
    </>
  );
}

const sidebar = () =>
  within(screen.getByRole("complementary", { name: "Filters" }));
const box = (name: string) => sidebar().getByRole("checkbox", { name });

describe("FilterSidebar", () => {
  it("starts with every box ticked, and unticking hides those cards", async () => {
    render(<Harness />);
    expect(box("Action")).toBeChecked();
    expect(box("Instant")).toBeChecked();
    await userEvent.setup().click(box("Instant"));
    expect(box("Instant")).not.toBeChecked();
    expect(latest).toEqual({ type: { instant: "exclude" } });
  });

  it("shows how many cards each value has", () => {
    render(<Harness />);
    expect(box("Action").closest("label")?.parentElement).toHaveTextContent(
      "2",
    );
  });

  it("'Only' on a card type unticks every other type", async () => {
    render(<Harness />);
    await userEvent
      .setup()
      .click(sidebar().getByRole("button", { name: "Only Action" }));
    expect(box("Action")).toBeChecked();
    expect(box("Instant")).not.toBeChecked();
    expect(box("Equipment")).not.toBeChecked();
  });

  it("'Only' on a mechanic shows just the cards that have it, and toggles off", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const only = sidebar().getByRole("button", { name: "Only Go again" });
    expect(only).toHaveAttribute("aria-pressed", "false");
    await user.click(only);
    expect(only).toHaveAttribute("aria-pressed", "true");
    expect(latest).toEqual({ keywords: { go: "include" } });
    await user.click(only);
    expect(latest).toEqual({});
  });

  it("'All' ticks a whole group again", async () => {
    render(
      <Harness initial={{ type: { instant: "exclude", action: "exclude" } }} />,
    );
    await userEvent
      .setup()
      .click(sidebar().getByRole("button", { name: "Show all Card type" }));
    expect(box("Instant")).toBeChecked();
    expect(box("Action")).toBeChecked();
    expect(
      sidebar().queryByRole("button", { name: "Show all Card type" }),
    ).not.toBeInTheDocument();
  });

  it("collapses each group by default, but opens groups that have filters", () => {
    render(<Harness initial={{ keywords: { go: "include" } }} />);
    const groupOf = (name: string) =>
      sidebar()
        .getByText(name, { selector: "summary *, summary" })
        .closest("details")!;
    expect(groupOf("Card type")).not.toHaveAttribute("open");
    expect(groupOf("Keywords")).toHaveAttribute("open");
  });

  it("keeps mechanics in a collapsed section", () => {
    render(<Harness />);
    const mechanics = sidebar().getByText("Mechanics").closest("details")!;
    expect(mechanics).not.toHaveAttribute("open");
  });

  it("hides the equipment slot group while equipment is unticked", async () => {
    render(<Harness />);
    expect(sidebar().getByText("Equipment slot")).toBeInTheDocument();
    await userEvent.setup().click(box("Equipment"));
    expect(sidebar().queryByText("Equipment slot")).not.toBeInTheDocument();
  });

  it("leaves bar groups out of the sidebar", () => {
    render(<Harness />);
    expect(
      screen.getByRole("group", { name: "Card type" }),
    ).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  it("shows everything with none selected, and selecting narrows to the selected values", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const bar = within(screen.getByRole("group", { name: "Card type" }));
    const instant = bar.getByRole("button", { name: "Instant" });
    const action = bar.getByRole("button", { name: "Action" });
    expect(instant).toHaveAttribute("aria-pressed", "false");
    await user.click(instant);
    expect(instant).toHaveAttribute("aria-pressed", "true");
    expect(latest).toEqual({ type: { instant: "include" } });
    await user.click(action);
    expect(latest).toEqual({ type: { instant: "include", action: "include" } });
    await user.click(instant);
    await user.click(action);
    expect(latest).toEqual({});
  });
});
