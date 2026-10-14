import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, Dialog, Slider, Table, Tag, TextField } from "./index.ts";

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
    ).toEqual([
      "0",
      "10",
      "20",
      "30",
      "40",
      "50",
      "60",
      "70",
      "80",
      "90",
      "100",
    ]);
  });

  it("highlights the tick for the current value", () => {
    render(<Harness initial={70} />);
    const current = screen
      .getByTestId("slider-scale")
      .querySelector("[data-current]");
    expect(current).toHaveTextContent("70");
  });

  it("moves in steps of 10 with the keyboard", async () => {
    render(<Harness initial={50} />);
    const slider = screen.getByRole("slider", { name: "Gate creation" });
    slider.focus();
    await userEvent.setup().keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuetext", "60");
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
