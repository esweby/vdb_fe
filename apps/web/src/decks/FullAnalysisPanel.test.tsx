import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { FullAnalysisPanel } from "./FullAnalysisPanel.tsx";
import type { FullAnalysisOutput, ProfileRun } from "./fullAnalysis.ts";

const game = (gateTurn: number | null): ProfileRun => ({
  completed: true,
  damage: [1, 2, 3, 4, 5, 6, 7, 8],
  gateTurn,
  usurperTurn: null,
  chain:
    gateTurn === null
      ? { reached: 0, setupTurn: null, payoffTurn: null }
      : { reached: 3, setupTurn: gateTurn, payoffTurn: gateTurn },
  cards: {},
});

const output: FullAnalysisOutput = {
  rows: [
    {
      id: "player",
      label: "This deck",
      source: "player",
      coverage: { modelled: 3, total: 3, unmodelled: [] },
      cardNames: [],
      runs: [game(3), game(5), game(null), game(null)],
    },
    {
      id: "common-60-a",
      label: "Common 60-card list A",
      source: "fablazing",
      sides: 345,
      coverage: { modelled: 59, total: 60, unmodelled: ["Eye of Ophidia"] },
      cardNames: [],
      runs: [game(3), game(5), game(null), game(null)],
    },
  ],
  runs: 4,
  seed: 20261027,
  turns: 8,
  policy: "reviewed-delayed-hands-v2",
};

function renderPanel(run = vi.fn().mockResolvedValue(output)) {
  const bsl = sampleCards[1]!;
  render(
    <FullAnalysisPanel
      entries={[
        { card: bsl, variant: bsl.variants[0]!, quantity: 3, sideboard: false },
      ]}
      cards={sampleCards}
      benchmarks={{
        label: "UNVERIFIED test",
        window: {
          startsOn: "2026-09-21",
          endsOn: "2026-10-20",
          exports: 57,
          generatedOn: "2026-10-27",
        },
        observedChain: {
          population: 24_789,
          completed: 6_152,
          byDelay: [2_551, 2_068, 1_533],
        },
        lists: [],
      }}
      run={run}
    />,
  );
  return run;
}

describe("Full analysis", () => {
  it("states the questions, then answers each one in a sentence", async () => {
    const run = renderPanel();
    const user = userEvent.setup();

    expect(
      screen.getByRole("heading", {
        name: "How often do Become the Shadow Lord, a Gate and a blood debt card come together by turn 6?",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run analysis" }));

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ runs: 1_000, turns: 8 }),
    );
    expect(await screen.findByText("In 50% of games.")).toBeInTheDocument();
    expect(
      screen.getAllByText("No clear difference from list A (50%).").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("UNVERIFIED").length).toBeGreaterThan(0);
    expect(screen.getByText(/real games it's 41%/)).toBeInTheDocument();
  });

  it("hides the damage, Gate and Usurper questions and says why", () => {
    renderPanel();

    expect(
      screen.queryByRole("heading", { name: /How much damage/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /made a Gate/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /become the Usurper/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Hidden for now: damage threatened, Gate made and becoming the Usurper\./,
      ),
    ).toBeInTheDocument();
  });

  it("answers for another turn without running again", async () => {
    const run = renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    await screen.findByText("In 50% of games.");

    await user.selectOptions(screen.getByLabelText("By turn"), "4");

    expect(
      screen.getByRole("heading", {
        name: "How often do Become the Shadow Lord, a Gate and a blood debt card come together by turn 4?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("In 25% of games.")).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps the turn-by-turn numbers, coverage and method behind their own sections", async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Run analysis" }));
    await screen.findByText("In 50% of games.");

    const table = screen.getByRole("table", {
      name: "Become the Shadow Lord, Gate and blood debt, by turn",
    });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]!).getByText("This deck")).toBeInTheDocument();
    expect(within(rows[1]!).getAllByText("25%").length).toBeGreaterThan(0);
    expect(screen.getByText(/Not covered: Eye of Ophidia/)).toBeInTheDocument();
  });
});
