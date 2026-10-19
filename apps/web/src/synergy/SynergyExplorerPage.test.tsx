// The synergy explorer page (maintainer, 19 Oct 2026). The graph itself is drawn with WebGL,
// which tests can't run, so it's swapped for a list of its cards; the panel is the real one.
// Sample cards: Become the Shadow Lord → Hocus Pocus is the only rule link.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeSynergyRepository } from "../test/fakeSynergyRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { ExplorerNode } from "./explorer.ts";

vi.mock("./GraphCanvas.tsx", () => ({
  GraphCanvas: (props: {
    nodes: ExplorerNode[];
    onSelect: (id: string) => void;
  }) => (
    <ul aria-label="Graph">
      {props.nodes.map((n) => (
        <li key={n.id}>
          <button type="button" onClick={() => props.onSelect(n.id)}>
            {n.name}
            {n.inCore ? " (core)" : ""}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

const BTSL = "card-become-the-shadow-lord";
const HOCUS = "card-hocus-pocus";

async function open(path = "/synergies", synergy = fakeSynergyRepository()) {
  const app = await renderApp({
    path,
    auth: fakeAuthService().service,
    synergy: synergy.repository,
  });
  await screen.findByRole("heading", { name: "Synergies" });
  return { ...app, user: userEvent.setup() };
}
const graph = () =>
  within(screen.getByRole("list", { name: "Graph" }))
    .queryAllByRole("button")
    .map((b) => b.textContent);
const panel = () =>
  within(screen.getByRole("complementary", { name: "Explore" }));

describe("synergy explorer", () => {
  it("is in the navigation for everyone", async () => {
    await renderApp({ path: "/", auth: fakeAuthService().service });
    expect(
      await screen.findByRole("link", { name: "Synergies" }),
    ).toHaveAttribute("href", "/synergies");
  });

  it("starts from every card with a link, and says how much it shows", async () => {
    await open();
    await waitFor(() =>
      expect(graph()).toEqual(["Hocus Pocus", "Become the Shadow Lord"]),
    );
    expect(panel().getByText("2 cards · 1 link")).toBeInTheDocument();
  });

  it("finds a card and explains its links, with the rules' reasons", async () => {
    const { router, user } = await open();
    await user.type(
      panel().getByRole("combobox", { name: "Find a card" }),
      "Hocus Pocus",
    );
    await user.click(panel().getByRole("button", { name: "Go" }));
    expect(router.state.location.search).toMatchObject({ card: HOCUS });
    const selected = within(
      panel().getByRole("region", { name: "Hocus Pocus" }),
    );
    const helpedBy = within(selected.getByRole("list", { name: "Helped by" }));
    expect(helpedBy.getByRole("listitem")).toHaveTextContent(
      /Become the Shadow Lord.*0\.8.*rules.*Creates a Gate, which plays this blood debt card from banish.*enables traverse/,
    );
    expect(selected.getByText("Helps nothing yet.")).toBeInTheDocument();
  });

  it("selects a card by clicking it in the graph", async () => {
    const { router, user } = await open();
    await user.click(
      await within(screen.getByRole("list", { name: "Graph" })).findByRole(
        "button",
        {
          name: "Become the Shadow Lord",
        },
      ),
    );
    expect(router.state.location.search).toMatchObject({ card: BTSL });
  });

  it("walks from card to card, and Back goes to the last one", async () => {
    const { router, user } = await open(`/synergies?card=${HOCUS}`);
    const selected = within(
      await panel().findByRole("region", { name: "Hocus Pocus" }),
    );
    await user.click(
      selected.getByRole("button", { name: "Become the Shadow Lord" }),
    );
    expect(router.state.location.search).toMatchObject({ card: BTSL });
    await panel().findByRole("region", { name: "Become the Shadow Lord" });
    await user.click(panel().getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ card: HOCUS }),
    );
  });

  it("refines what's drawn, and keeps it in the URL", async () => {
    const { router, user } = await open();
    await user.selectOptions(
      panel().getByRole("combobox", { name: "Links from" }),
      "Rules only",
    );
    await user.click(panel().getByRole("checkbox", { name: "Gate" }));
    const min = panel().getByRole("slider", { name: "Minimum strength" });
    min.focus();
    await user.keyboard("{End}");
    expect(router.state.location.search).toMatchObject({
      src: "rule",
      eng: "gate",
      min: 100,
    });
    // At full strength, the 0.8 link is hidden.
    await waitFor(() => expect(graph()).toEqual([]));
  });

  it("starts from your core, marking its cards", async () => {
    const core = encodeURIComponent(JSON.stringify({ hp3: 3 }));
    await open(`/synergies?start=core&core=${core}`);
    await waitFor(() =>
      expect(graph()).toEqual(["Hocus Pocus (core)", "Become the Shadow Lord"]),
    );
  });

  it("shows the scoring group's own links", async () => {
    await open(
      `/synergies?card=${HOCUS}`,
      fakeSynergyRepository(
        {},
        {
          edges: [
            {
              fromCardId: "card-fate-foreseen",
              toCardId: HOCUS,
              weight: 0.6,
              ratingCount: 2,
              totalWeight: 2,
            },
          ],
          feedback: [],
        },
      ),
    );
    const helpedBy = within(
      within(
        await panel().findByRole("region", { name: "Hocus Pocus" }),
      ).getByRole("list", { name: "Helped by" }),
    );
    await waitFor(() =>
      expect(helpedBy.getAllByRole("listitem")[1]).toHaveTextContent(
        /Fate Foreseen.*0\.6.*scoring group/,
      ),
    );
  });
});
