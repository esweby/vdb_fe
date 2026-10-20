import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Dialog,
  ErrorBoundary,
  Slider,
  Table,
  Tag,
  TextField,
} from "./index.ts";

describe("Button", () => {
  it("is a non-submitting button by default and calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.setup().click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can submit forms", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});

describe("TextField", () => {
  it("labels its input", () => {
    render(<TextField label="Email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("links an error to the input and marks it invalid", () => {
    render(
      <TextField label="Email" value="" onChange={() => {}} error="Required" />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Required");
  });
});

describe("Slider", () => {
  function Harness(props: { initial: number | null }) {
    const [value, setValue] = useState(props.initial);
    return <Slider label="Gate creation" value={value} onChange={setValue} />;
  }

  it("shows 'Not set' rather than 0 when there's no value", () => {
    render(<Harness initial={null} />);
    expect(
      screen.getByRole("slider", { name: "Gate creation" }),
    ).toHaveAttribute("aria-valuetext", "Not set");
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  // Stored 0-100, shown out of 10 (scoring group feedback, 16 Oct 2026).
  it("shows the value out of 10", () => {
    render(<Harness initial={70} />);
    const slider = screen.getByRole("slider", { name: "Gate creation" });
    expect(slider).toHaveAttribute("aria-valuetext", "7");
    expect(slider).toHaveValue("70");
  });

  it("shows the value, including an explicit 0", () => {
    render(<Harness initial={0} />);
    expect(
      screen.getByRole("slider", { name: "Gate creation" }),
    ).toHaveAttribute("aria-valuetext", "0");
  });

  it("shows a tick and label for every step above the track, hidden from screen readers", () => {
    render(<Harness initial={50} />);
    const scale = screen.getByTestId("slider-scale");
    expect(scale).toHaveAttribute("aria-hidden", "true");
    expect(
      [...scale.querySelectorAll("span")].map((s) => s.textContent),
    ).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("highlights the tick for the current value", () => {
    render(<Harness initial={70} />);
    const current = screen
      .getByTestId("slider-scale")
      .querySelector("[data-current]");
    expect(current).toHaveTextContent("7");
  });

  it("moves in steps of 10 with the keyboard", async () => {
    render(<Harness initial={50} />);
    const slider = screen.getByRole("slider", { name: "Gate creation" });
    slider.focus();
    await userEvent.setup().keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuetext", "6");
  });

  // Like quick review: 1-9 are 1 to 9 and 0 is 10 (maintainer, 19 Oct 2026: number keys did nothing).
  it("sets the value from a number key, with 0 as 10", async () => {
    render(<Harness initial={null} />);
    const slider = screen.getByRole("slider", { name: "Gate creation" });
    slider.focus();
    const user = userEvent.setup();
    await user.keyboard("7");
    expect(slider).toHaveAttribute("aria-valuetext", "7");
    await user.keyboard("0");
    expect(slider).toHaveAttribute("aria-valuetext", "10");
  });

  it("ignores number keys on a slider that isn't scored out of 10", async () => {
    const onChange = vi.fn();
    render(
      <Slider
        label="Risk"
        value={0}
        onChange={onChange}
        min={-100}
        step={25}
      />,
    );
    screen.getByRole("slider", { name: "Risk" }).focus();
    await userEvent.setup().keyboard("7");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Table", () => {
  const rows = [
    { id: "a", name: "Hocus Pocus", pitch: 1 },
    { id: "b", name: "Arcane Cussing", pitch: 2 },
  ];
  const columns = [
    { key: "name", header: "Name" },
    {
      key: "pitch",
      header: "Pitch",
      render: (r: (typeof rows)[number]) => `P${r.pitch}`,
    },
  ];

  it("renders a captioned table with headers and cells", () => {
    render(
      <Table
        caption="Cards"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByRole("table", { name: "Cards" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "P2" })).toBeInTheDocument();
  });

  it("shows a message when there are no rows", () => {
    render(
      <Table
        caption="Cards"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty="No cards"
      />,
    );
    expect(screen.getByText("No cards")).toBeInTheDocument();
  });
});

describe("Tag", () => {
  it("renders its text", () => {
    render(<Tag>Blood debt</Tag>);
    expect(screen.getByText("Blood debt")).toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("is a labelled dialog only while open, and closes", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          title="Mark reviewed"
          open={open}
          onClose={() => setOpen(false)}
        >
          <p>Summary</p>
        </Dialog>
      );
    }
    render(<Harness />);
    expect(
      screen.getByRole("dialog", { name: "Mark reviewed" }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Slider scale on a wide range", () => {
  it("labels every other step when there would be more than 11 labels", () => {
    render(
      <Slider
        label="Risk"
        min={-100}
        max={100}
        value={0}
        onChange={() => {}}
      />,
    );
    const labels = [
      ...screen.getByTestId("slider-scale").querySelectorAll("span"),
    ]
      .map((t) => t.textContent)
      .filter(Boolean);
    expect(labels).toEqual([
      "-10",
      "-8",
      "-6",
      "-4",
      "-2",
      "0",
      "2",
      "4",
      "6",
      "8",
      "10",
    ]);
  });
});

describe("Slider without a scale", () => {
  it("leaves out the numbers for narrow places where they'd crowd together", () => {
    render(
      <Slider
        label="Risk"
        min={-100}
        max={100}
        value={0}
        onChange={() => {}}
        noScale
      />,
    );
    expect(screen.queryByTestId("slider-scale")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Risk" })).toBeInTheDocument();
  });
});

describe("Slider tap targets (touch screens)", () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return (
      <Slider label="Overall" value={value} onChange={setValue} tapTargets />
    );
  }

  it("offers a button for every step, setting the value in one tap", async () => {
    render(<Harness />);
    const taps = within(
      screen.getByRole("group", { name: "Overall, tap a score" }),
    );
    expect(taps.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    await userEvent.setup().click(taps.getByRole("button", { name: "6" }));
    expect(taps.getByRole("button", { name: "6" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const slider = screen.getByRole("slider", { name: "Overall" });
    expect(slider).toHaveAttribute("aria-valuetext", "6");
    // Stored as 60.
    expect(slider).toHaveValue("60");
  });

  it("has none unless asked for", () => {
    render(<Slider label="Risk" value={0} onChange={() => {}} />);
    expect(
      screen.queryByRole("group", { name: "Risk, tap a score" }),
    ).toBeNull();
  });
});

// The maintainer, 20 Oct 2026: "Synergies sometimes crashes". A crash in one part shouldn't blank
// the page: it says so, shows the error to report, and offers to try again.
describe("ErrorBoundary", () => {
  it("catches a crash, shows the error, and tries again", async () => {
    let broken = true;
    const Flaky = () => {
      if (broken) throw new Error("graph went wrong");
      return <p>Working again</p>;
    };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary what="The synergy graph">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The synergy graph hit a problem",
    );
    expect(screen.getByText(/graph went wrong/)).toBeInTheDocument();
    broken = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Working again")).toBeInTheDocument();
    quiet.mockRestore();
  });
});
