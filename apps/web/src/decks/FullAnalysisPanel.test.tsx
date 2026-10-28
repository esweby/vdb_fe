import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { FullAnalysisPanel } from "./FullAnalysisPanel.tsx";

describe("Full analysis", () => {
  it("runs 1,000 browser simulations and shows setup speed and coverage", async () => {
    const bsl = sampleCards[1]!;
    const run = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "player",
          label: "This deck",
          source: "player",
          coverage: { modelled: 3, total: 3, unmodelled: [] },
          summary: {
            completedRuns: 1_000,
            failedRuns: 0,
            byTurn: { 4: 0.42, 6: 0.68, 8: 0.81 },
            medianTurn: 5,
            incompleteByTurn8: 0.19,
            sameTurn: 0.72,
            chains: 810,
          },
        },
      ],
      runs: 1_000,
      seed: 20261027,
      turns: 8,
      policy: "reviewed-delayed-hands-v2",
    });
    render(
      <FullAnalysisPanel
        entries={[
          {
            card: bsl,
            variant: bsl.variants[0]!,
            quantity: 3,
            sideboard: false,
          },
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

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Full analysis" }));

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ runs: 1_000, turns: 8 }),
    );
    const table = await screen.findByRole("table", {
      name: "Setup comparison",
    });
    expect(within(table).getByText("This deck")).toBeInTheDocument();
    expect(within(table).getByText("100% covered")).toBeInTheDocument();
    expect(within(table).getByText("42%")).toBeInTheDocument();
    expect(screen.getAllByText("UNVERIFIED").length).toBeGreaterThan(0);
    expect(screen.getByText(/41.47%/)).toBeInTheDocument();
  });
});
