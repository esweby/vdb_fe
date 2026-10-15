import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ScoreRow } from "./scoreRepository.ts";
import { ScoreEditor } from "./ScoreEditor.tsx";

const dimensions = [
  { id: 1, key: "runechantCreation", label: "Runechant creation" },
  { id: 2, key: "gateCreation", label: "Gate creation" },
];
const variants = [
  { id: "red", pitch: 1 },
  { id: "blue", pitch: 3 },
];

function Harness(props: {
  chosenVariantId?: string;
  initial?: ScoreRow[];
  onSet?: (r: Omit<ScoreRow, "score">, s: number | null) => void;
}) {
  const [rows, setRows] = useState<ScoreRow[]>(props.initial ?? []);
  return (
    <ScoreEditor
      dimensions={dimensions}
      variants={variants}
      chosenVariantId={props.chosenVariantId}
      rows={rows}
      onSet={(key, score) => {
        props.onSet?.(key, score);
        setRows((rs) => {
          const rest = rs.filter(
            (r) =>
              !(
                r.variantId === key.variantId &&
                r.side === key.side &&
                r.dimensionId === key.dimensionId
              ),
          );
          return score === null ? rest : [...rest, { ...key, score }];
        });
      }}
    />
  );
}

describe("ScoreEditor", () => {
  it("shows one 'Not set' slider per dimension by default", () => {
    render(<Harness />);
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    expect(
      screen.getByRole("slider", { name: "Gate creation" }),
    ).toHaveAttribute("aria-valuetext", "Not set");
  });

  it("sets a card-level score for both sides", async () => {
    const onSet = vi.fn();
    render(<Harness onSet={onSet} />);
    const slider = screen.getByRole("slider", { name: "Gate creation" });
    slider.focus();
    await userEvent.setup().keyboard("{End}");
    expect(onSet).toHaveBeenLastCalledWith(
      { variantId: null, side: null, dimensionId: 2 },
      100,
    );
  });

  it("marks a dimension not relevant (an explicit 0) and clears it back to blank", async () => {
    const onSet = vi.fn();
    render(<Harness onSet={onSet} />);
    const user = userEvent.setup();
    const gate = screen.getByRole("group", { name: "Gate creation" });
    await user.click(
      within(gate).getByRole("button", { name: "Not relevant" }),
    );
    expect(onSet).toHaveBeenLastCalledWith(
      { variantId: null, side: null, dimensionId: 2 },
      0,
    );
    expect(within(gate).getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "0",
    );
    await user.click(within(gate).getByRole("button", { name: "Clear" }));
    expect(onSet).toHaveBeenLastCalledWith(
      { variantId: null, side: null, dimensionId: 2 },
      null,
    );
  });

  it("splits by side, showing what each side inherits", async () => {
    render(
      <Harness
        initial={[{ variantId: null, side: null, dimensionId: 2, score: 70 }]}
      />,
    );
    await userEvent.setup().click(
      screen.getByRole("checkbox", {
        name: "Same score for both sides: Gate creation",
      }),
    );
    const usurper = screen.getByRole("slider", {
      name: "Gate creation, Usurper",
    });
    expect(usurper).toHaveAttribute("aria-valuetext", "Not set");
    expect(
      within(screen.getByRole("group", { name: "Gate creation" })).getAllByText(
        "Inherits 70",
      ),
    ).toHaveLength(2);
  });

  it("only offers per-pitch scoring when the card has several pitches", () => {
    render(
      <ScoreEditor
        dimensions={dimensions}
        variants={[{ id: "only", pitch: 3 }]}
        rows={[]}
        onSet={() => {}}
      />,
    );
    expect(
      screen.queryByRole("checkbox", { name: /^Different score for/ }),
    ).not.toBeInTheDocument();
  });

  it("doesn't repeat the dimension name visibly under its heading", () => {
    render(<Harness />);
    const gate = screen.getByRole("group", { name: "Gate creation" });
    expect(within(gate).getAllByText("Gate creation")).toHaveLength(1);
    expect(
      within(gate).getByRole("slider", { name: "Gate creation" }),
    ).toBeInTheDocument();
  });

  it("labels split sliders with just the side or pitch", async () => {
    render(<Harness />);
    await userEvent.setup().click(
      screen.getByRole("checkbox", {
        name: "Same score for both sides: Gate creation",
      }),
    );
    const gate = screen.getByRole("group", { name: "Gate creation" });
    expect(within(gate).getByText("Forsaken")).toBeInTheDocument();
    expect(
      within(gate).getByRole("slider", { name: "Gate creation, Forsaken" }),
    ).toBeInTheDocument();
  });

  it("starts split by side when the preference says so", () => {
    render(
      <ScoreEditor
        dimensions={dimensions}
        variants={variants}
        rows={[]}
        onSet={() => {}}
        sidesTogetherByDefault={false}
      />,
    );
    expect(
      screen.getByRole("slider", { name: "Gate creation, Forsaken" }),
    ).toBeInTheDocument();
  });

  it("greys out locked dimensions with a reason, keeping their place", () => {
    render(
      <ScoreEditor
        dimensions={dimensions}
        variants={variants}
        rows={[]}
        onSet={() => {}}
        locked={{ ids: [2], reason: "Same as overall: no conditions." }}
      />,
    );
    const gate = screen.getByRole("group", { name: "Gate creation" });
    expect(within(gate).getByRole("slider")).toBeDisabled();
    expect(
      within(gate).getByRole("button", { name: "Not relevant" }),
    ).toBeDisabled();
    expect(
      within(gate).getByText("Same as overall: no conditions."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Runechant creation" }),
    ).toBeEnabled();
  });

  it("gives each rating its own both-sides toggle", async () => {
    render(<Harness />);
    await userEvent.setup().click(
      screen.getByRole("checkbox", {
        name: "Same score for both sides: Gate creation",
      }),
    );
    expect(
      screen.getByRole("slider", { name: "Gate creation, Forsaken" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Runechant creation" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("slider", { name: "Runechant creation, Forsaken" }),
    ).not.toBeInTheDocument();
  });

  it("opens a rating split by side when it already has per-side scores, so nothing is hidden", () => {
    render(
      <Harness
        initial={[
          { variantId: null, side: "forsaken", dimensionId: 2, score: 60 },
        ]}
      />,
    );
    expect(
      screen.getByRole("slider", { name: "Gate creation, Forsaken" }),
    ).toHaveAttribute("aria-valuetext", "60");
    expect(
      screen.getByRole("checkbox", {
        name: "Same score for both sides: Gate creation",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("slider", { name: "Runechant creation" }),
    ).toBeInTheDocument();
  });

  it("going back to one score for both sides removes that rating's per-side scores", async () => {
    const onSet = vi.fn();
    render(
      <Harness
        onSet={onSet}
        initial={[
          { variantId: null, side: null, dimensionId: 2, score: 70 },
          { variantId: null, side: "forsaken", dimensionId: 2, score: 60 },
          { variantId: null, side: "usurper", dimensionId: 2, score: 40 },
        ]}
      />,
    );
    await userEvent.setup().click(
      screen.getByRole("checkbox", {
        name: "Same score for both sides: Gate creation",
      }),
    );
    expect(onSet.mock.calls).toEqual([
      [{ variantId: null, side: "forsaken", dimensionId: 2 }, null],
      [{ variantId: null, side: "usurper", dimensionId: 2 }, null],
    ]);
    expect(
      screen.getByRole("slider", { name: "Gate creation" }),
    ).toHaveAttribute("aria-valuetext", "70");
  });

  it("scores the pitch being looked at separately with the same single slider", async () => {
    render(
      <Harness
        chosenVariantId="blue"
        initial={[{ variantId: null, side: null, dimensionId: 2, score: 70 }]}
      />,
    );
    await userEvent
      .setup()
      .click(
        screen.getByRole("checkbox", { name: "Different score for Blue" }),
      );
    const gate = within(screen.getByRole("group", { name: "Gate creation" }));
    // One slider per rating: now Blue's, falling back to the all-pitches score
    expect(gate.getAllByRole("slider")).toHaveLength(1);
    expect(
      gate.getByRole("slider", { name: "Gate creation, Blue" }),
    ).toHaveAttribute("aria-valuetext", "Not set");
    expect(gate.getByText("Inherits 70")).toBeInTheDocument();
    expect(gate.queryByText("All pitches")).not.toBeInTheDocument();
  });

  it("opens the pitch's own scores, and says which other pitches have their own", () => {
    const initial = [
      { variantId: "red", side: null, dimensionId: 1, score: 80 },
    ] as ScoreRow[];
    const { unmount } = render(
      <Harness chosenVariantId="red" initial={initial} />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Different score for Red" }),
    ).toBeChecked();
    expect(
      screen.getByRole("slider", { name: "Runechant creation, Red" }),
    ).toHaveAttribute("aria-valuetext", "80");
    unmount();
    render(<Harness chosenVariantId="blue" initial={initial} />);
    expect(
      screen.getByRole("checkbox", { name: "Different score for Blue" }),
    ).not.toBeChecked();
    expect(screen.getByText("Red has its own scores.")).toBeInTheDocument();
  });

  it("turning it off clears only that pitch's scores", async () => {
    const onSet = vi.fn();
    render(
      <Harness
        chosenVariantId="red"
        onSet={onSet}
        initial={[
          { variantId: "red", side: null, dimensionId: 1, score: 80 },
          { variantId: "blue", side: null, dimensionId: 1, score: 30 },
        ]}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("checkbox", { name: "Different score for Red" }));
    expect(onSet.mock.calls).toEqual([
      [{ variantId: "red", side: null, dimensionId: 1 }, null],
    ]);
  });

  it("only offers a pitch its own score once there's a score for all pitches", () => {
    const { unmount } = render(<Harness chosenVariantId="blue" />);
    expect(
      screen.getByRole("checkbox", { name: "Different score for Blue" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Score all pitches first, then give Blue its own score.",
      ),
    ).toBeInTheDocument();
    unmount();
    render(
      <Harness
        chosenVariantId="blue"
        initial={[{ variantId: null, side: null, dimensionId: 1, score: 70 }]}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Different score for Blue" }),
    ).toBeEnabled();
  });

  it("warns when only a pitch has scores, so the others would count as 0", () => {
    render(
      <Harness
        chosenVariantId="red"
        initial={[{ variantId: "red", side: null, dimensionId: 1, score: 80 }]}
      />,
    );
    expect(
      screen.getByText("Blue has no score yet, so it will count as 0."),
    ).toBeInTheDocument();
  });

  it("can move a pitch's scores up to all pitches in one click", async () => {
    const onSet = vi.fn();
    render(
      <Harness
        chosenVariantId="red"
        onSet={onSet}
        initial={[{ variantId: "red", side: null, dimensionId: 1, score: 80 }]}
      />,
    );
    await userEvent.setup().click(
      screen.getByRole("button", {
        name: "Use Red's scores for all pitches",
      }),
    );
    expect(onSet.mock.calls).toEqual([
      [{ variantId: null, side: null, dimensionId: 1 }, 80],
      [{ variantId: "red", side: null, dimensionId: 1 }, null],
    ]);
    expect(
      screen.getByRole("checkbox", { name: "Different score for Red" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("slider", { name: "Runechant creation" }),
    ).toHaveAttribute("aria-valuetext", "80");
  });

  it("can be rated with one tap on a touch screen", async () => {
    const onSet = vi.fn();
    render(<Harness onSet={onSet} />);
    const taps = within(
      screen.getByRole("group", { name: "Runechant creation, tap a score" }),
    );
    await userEvent.setup().click(taps.getByRole("button", { name: "70" }));
    expect(onSet).toHaveBeenCalledWith(
      expect.objectContaining({ dimensionId: 1, variantId: null, side: null }),
      70,
    );
  });
});
