import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardText } from "./CardText.tsx";

// The dataset writes card symbols as codes ({r} resource, {p} power…); show them as symbols.
describe("CardText", () => {
  it("shows symbol codes as labelled symbols, not raw braces", () => {
    const { container } = render(
      <CardText text="Pay up to 3{h}: create that many Runechants. This costs {r} less, +1{p}." />,
    );
    expect(container.textContent).not.toMatch(/[{}]/);
    expect(screen.getByRole("img", { name: "life" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "resource" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "power" })).toBeInTheDocument();
  });

  it("knows defense, intellect, chi, tap and untap", () => {
    render(<CardText text="{d} {i} {c} {t} {u}" />);
    for (const name of ["defense", "intellect", "chi", "tap", "untap"])
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
  });

  // Maintainer, 16 Oct 2026: printed as a red circle with an X; {r} is the minimum cost and each
  // {x} is a resource you may also pay (e.g. Beckoning Haunt's "{x}{x}{r}").
  it("shows {x} as an optional resource", () => {
    render(<CardText text="Action - {x}{x}{r}, destroy this" />);
    expect(
      screen.getAllByRole("img", { name: "optional resource" }),
    ).toHaveLength(2);
  });

  it("puts keywords in bold, as they're printed", () => {
    render(
      <CardText text="Usurp. Go again" keywords={["Go again", "Usurp"]} />,
    );
    expect(screen.getByText("Go again").tagName).toBe("STRONG");
    expect(screen.getByText("Usurp").tagName).toBe("STRONG");
  });

  it("leaves an unknown code as written", () => {
    const { container } = render(<CardText text="Costs {q} more" />);
    expect(container.textContent).toBe("Costs {q} more");
  });
});
