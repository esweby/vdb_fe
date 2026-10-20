// The synergy explorer page (maintainer, 19 Oct 2026). The graph itself is drawn with WebGL,
// which tests can't run, so it's swapped for a list of its cards; the panel is the real one.
// Sample cards: Become the Shadow Lord → Hocus Pocus is the only rule link.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { fakeSynergyRepository } from "../test/fakeSynergyRepository.ts";
import { sampleCommunity } from "../test/sampleCommunity.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { ExplorerNode } from "./explorer.ts";

vi.mock("./GraphCanvas.tsx", () => ({
  GraphCanvas: (props: {
    nodes: ExplorerNode[];
    onSelect: (id: string) => void;
    onHover: (id: string | null) => void;
    highlight?: { cards: string[] };
  }) => (
    <ul aria-label="Graph">
      {props.nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => props.onSelect(n.id)}
            onMouseEnter={() => props.onHover(n.id)}
            onMouseLeave={() => props.onHover(null)}
          >
            {n.name}
            {n.inCore ? " (core)" : ""}
            {props.highlight?.cards.includes(n.id) ? " (picked)" : ""}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

const BTSL = "card-become-the-shadow-lord";
const HOCUS = "card-hocus-pocus";

async function open(
  path = "/synergies",
  synergy = fakeSynergyRepository(),
  scores?: ReturnType<typeof fakeScoreRepository>["repository"],
) {
  const app = await renderApp({
    path,
    auth: fakeAuthService().service,
    synergy: synergy.repository,
    scores,
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

  // Maintainer, 19 Oct 2026: say plainly what the links are, and aren't.
  it("explains at the top that links are unchecked suggestions from the rules", async () => {
    await open();
    expect(
      screen.getByText(/show cards that can work together, not how well/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Confirm synergies" }),
    ).toHaveAttribute("href", "/needs-review/synergies");
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
      /Become the Shadow Lord.*0\.8.*suggested.*Creates a Gate, which plays this blood debt card from banish.*enables traverse/,
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

  // Maintainer, 19 Oct 2026: the core and deck views belong in Build a core and the deck page.
  it("offers a card or everything, not your core", async () => {
    await open();
    const show = panel().getByRole("combobox", { name: "Show" });
    expect(
      within(show)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Everything", "The selected card and its neighbours"]);
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

  // Maintainer, 19 Oct 2026: preview the card being pointed at.
  it("previews the card you point at in the graph, and hides it when you move off", async () => {
    const { user } = await open();
    const node = await within(
      screen.getByRole("list", { name: "Graph" }),
    ).findByRole("button", { name: "Hocus Pocus" });
    await user.hover(node);
    expect(
      within(screen.getByRole("figure", { name: "Card preview" })).getByText(
        "Hocus Pocus",
      ),
    ).toBeInTheDocument();
    await user.unhover(node);
    expect(screen.queryByRole("figure", { name: "Card preview" })).toBeNull();
  });

  it("previews a partner you point at in the panel", async () => {
    const { user } = await open(`/synergies?card=${HOCUS}`);
    const selected = within(
      await panel().findByRole("region", { name: "Hocus Pocus" }),
    );
    await user.hover(
      selected.getByRole("button", { name: "Become the Shadow Lord" }),
    );
    expect(
      within(screen.getByRole("figure", { name: "Card preview" })).getByText(
        "Become the Shadow Lord",
      ),
    ).toBeInTheDocument();
  });

  it("shows the card's red version when it has an image", async () => {
    const [hocus, ...rest] = sampleCards;
    const withArt = {
      ...hocus!,
      variants: hocus!.variants.map((v) => ({
        ...v,
        imageUrl: `https://img.test/${v.id}.webp`,
      })),
    };
    await renderApp({
      path: "/synergies",
      auth: fakeAuthService().service,
      cards: fakeCardRepository([withArt, ...rest]),
    });
    const user = userEvent.setup();
    await user.hover(
      await within(
        await screen.findByRole("list", { name: "Graph" }),
      ).findByRole("button", {
        name: "Hocus Pocus",
      }),
    );
    expect(
      within(screen.getByRole("figure", { name: "Card preview" })).getByRole(
        "img",
        {
          name: "Hocus Pocus",
        },
      ),
    ).toHaveAttribute("src", "https://img.test/hp1.webp");
  });

  // Lines (maintainer, 19 Oct 2026): three-card chains where each card helps the next.
  describe("lines", () => {
    // The scoring group links Hocus Pocus → Nebula Blade, so Become the Shadow Lord →
    // Hocus Pocus → Nebula Blade is a line.
    const withLine = () =>
      fakeSynergyRepository(
        {},
        {
          edges: [
            {
              fromCardId: HOCUS,
              toCardId: "card-nebula-blade",
              weight: 0.6,
              ratingCount: 2,
              totalWeight: 2,
            },
          ],
          feedback: [],
        },
      );

    it("lists the lines through the selected card, weakest link and traverse shown", async () => {
      await open(`/synergies?card=${HOCUS}`, withLine());
      const selected = within(
        await panel().findByRole("region", { name: "Hocus Pocus" }),
      );
      const lines = within(
        await selected.findByRole("list", { name: "Lines through this card" }),
      );
      expect(lines.getByRole("listitem")).toHaveTextContent(
        /Become the Shadow Lord → Hocus Pocus → Nebula Blade.*weakest link 0\.6.*enables traverse/,
      );
    });

    it("highlights a line in the graph, and hides it again", async () => {
      const { user } = await open(`/synergies?card=${HOCUS}`, withLine());
      const selected = within(
        await panel().findByRole("region", { name: "Hocus Pocus" }),
      );
      await user.click(
        await selected.findByRole("button", { name: "Show in graph" }),
      );
      await waitFor(() =>
        expect(graph()).toContain("Become the Shadow Lord (picked)"),
      );
      await user.click(selected.getByRole("button", { name: "Hide" }));
      await waitFor(() => expect(graph()).toContain("Become the Shadow Lord"));
    });

    it("says when there are no lines yet", async () => {
      await open(`/synergies?card=${HOCUS}`);
      const selected = within(
        await panel().findByRole("region", { name: "Hocus Pocus" }),
      );
      expect(
        selected.getByText("No lines through this card yet."),
      ).toBeInTheDocument();
    });
  });

  // Explorer feature 2 (maintainer, 19 Oct 2026).
  describe("packages", () => {
    it("lists cards that work as a unit, why, and picks them out in the graph", async () => {
      const { user } = await open(
        "/synergies",
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
      const list = within(
        await panel().findByRole("list", { name: "Packages" }),
      );
      const item = list.getByRole("listitem");
      expect(item).toHaveTextContent(
        /Fate Foreseen.*2 cards.*Fate Foreseen: the scoring group links them/,
      );
      await user.click(
        within(item).getByRole("button", { name: "Show in graph" }),
      );
      await waitFor(() =>
        expect(graph()).toEqual(
          expect.arrayContaining([
            "Hocus Pocus (picked)",
            "Fate Foreseen (picked)",
          ]),
        ),
      );
    });

    it("says when there are none yet", async () => {
      await open();
      expect(await panel().findByText(/No packages yet/)).toBeInTheDocument();
    });
  });

  describe("hidden gems", () => {
    it("lists low-rated cards linked strongly to high-rated ones", async () => {
      await open(
        "/synergies",
        undefined,
        fakeScoreRepository([], { community: sampleCommunity() }).repository,
      );
      const gems = within(
        await panel().findByRole("list", { name: "Hidden gems" }),
      );
      // Hocus Pocus is rated 5; Become the Shadow Lord, rated 7, helps it (0.8).
      expect(gems.getByRole("listitem")).toHaveTextContent(
        /Hocus Pocus.*rated 5.*works with 1 card rated 7 or more: Become the Shadow Lord/,
      );
    });

    it("says when there are none yet", async () => {
      await open();
      expect(
        await panel().findByText(/No hidden gems yet/),
      ).toBeInTheDocument();
    });

    // The maintainer, 20 Oct 2026: clicking a gem revealed nothing.
    it("picks a gem and its partners out in the graph", async () => {
      const { user } = await open(
        "/synergies",
        undefined,
        fakeScoreRepository([], { community: sampleCommunity() }).repository,
      );
      const gem = within(
        await panel().findByRole("list", { name: "Hidden gems" }),
      ).getByRole("listitem");
      await user.click(
        within(gem).getByRole("button", { name: "Show in graph" }),
      );
      await waitFor(() =>
        expect(graph()).toEqual(
          expect.arrayContaining([
            "Hocus Pocus (picked)",
            "Become the Shadow Lord (picked)",
          ]),
        ),
      );
    });
  });

  // The maintainer, 20 Oct 2026: the Discover column buried the controls.
  describe("the rail", () => {
    it("puts Refine above Discover", async () => {
      await open();
      await panel().findByRole("heading", { name: "Discover" });
      const order = panel()
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent);
      expect(order.indexOf("Refine")).toBeLessThan(order.indexOf("Discover"));
    });
  });

  // Feature 3 (maintainer, 19 Oct 2026): how sure we are, and the best partners.
  describe("how sure we are", () => {
    const confirmed = () =>
      fakeSynergyRepository(
        {},
        {
          edges: [],
          feedback: [
            {
              ruleId: "gate-feeds-gate-target",
              fromCardId: BTSL,
              toCardId: HOCUS,
              confirmShare: 1,
              fixedPart: 0,
              ratingCount: 3,
              totalWeight: 3,
            },
          ],
        },
      );

    it("marks a link the scoring group has confirmed", async () => {
      await open(`/synergies?card=${HOCUS}`, confirmed());
      const helpedBy = within(
        within(
          await panel().findByRole("region", { name: "Hocus Pocus" }),
        ).getByRole("list", { name: "Helped by" }),
      );
      await waitFor(() =>
        expect(helpedBy.getByRole("listitem")).toHaveTextContent(
          /confirmed by 3/,
        ),
      );
    });

    it("opens a card with its best partners in a sentence", async () => {
      await open(`/synergies?card=${HOCUS}`);
      const selected = within(
        await panel().findByRole("region", { name: "Hocus Pocus" }),
      );
      expect(selected.getByText(/^Best with:/)).toHaveTextContent(
        "Best with: Become the Shadow Lord (Creates a Gate, which plays this blood debt card from banish · suggested).",
      );
    });

    it("can show disputed links, kept in the URL", async () => {
      const { router, user } = await open();
      await user.click(
        panel().getByRole("checkbox", { name: "Show disputed links" }),
      );
      expect(router.state.location.search).toMatchObject({ disp: 1 });
    });
  });
});
