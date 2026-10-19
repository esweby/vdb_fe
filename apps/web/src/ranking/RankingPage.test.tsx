import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import {
  fakeDeckRepository,
  type DeckFixture,
} from "../test/fakeDeckRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { fakeStrategyRepository } from "../test/fakeStrategyRepository.ts";
import { fakeSynergyRepository } from "../test/fakeSynergyRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { sampleCommunity } from "../test/sampleCommunity.ts";

// The sample, ranked at Balanced: Become the Shadow Lord (blue) 70, Hocus Pocus red 50,
// yellow 40, blue 30; Nebula Blade 40. Fate Foreseen is unrated.
// Become the Shadow Lord makes Runechants and Gates and banishes from hand; Hocus Pocus
// makes Runechants and is a Gate target.
const scores = (over = {}) =>
  fakeScoreRepository([], { community: sampleCommunity(), ...over }).repository;
const signedIn = () =>
  fakeAuthService({
    users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
    signedIn: { id: "u1", email: "u@test.local" },
  }).service;
const gateTempo = (over: Partial<DeckFixture> = {}): DeckFixture => ({
  id: "deck-1",
  name: "Gate tempo",
  updatedAt: "2026-10-14T10:00:00Z",
  cards: [],
  pitchTargets: {},
  ...over,
});
const core = (entries: Record<string, number>) =>
  `core=${encodeURIComponent(JSON.stringify(entries))}`;

async function open(
  path = "/ranking",
  opts: {
    signedIn?: boolean;
    onlyScorer?: boolean;
    decks?: DeckFixture[];
    scores?: ReturnType<typeof scores>;
    /** Open exactly this path; otherwise a path without a tab opens the Board. */
    asIs?: boolean;
    synergy?: ReturnType<typeof fakeSynergyRepository>;
  } = {},
) {
  const fake = fakeDeckRepository(opts.decks ?? [gateTempo()]);
  const strategy = fakeStrategyRepository(
    opts.onlyScorer
      ? { onlyScorer: true }
      : { community: { traverse_to_usurper: { average: 7.5, answers: 2 } } },
  );
  const app = await renderApp({
    path:
      opts.asIs || path.includes("tab=")
        ? path
        : `${path}${path.includes("?") ? "&" : "?"}tab=board`,
    auth: opts.signedIn ? signedIn() : fakeAuthService().service,
    scores: opts.scores ?? scores(),
    decks: fake.repository,
    strategy: strategy.repository,
    synergy: opts.synergy?.repository,
  });
  await screen.findByRole("tablist", { name: "Build steps" });
  const user = userEvent.setup();
  return { ...app, fake, strategy, user };
}
const goTab = (name: string) =>
  userEvent.setup().click(screen.getByRole("tab", { name: new RegExp(name) }));
const panel = () => within(screen.getByRole("tabpanel"));
const lane = (name: string) =>
  within(screen.getByRole("list", { name })).getAllByRole("listitem");
const laneNames = (name: string) =>
  lane(name).map((li) => li.getAttribute("aria-label"));
const tray = () => within(screen.getByRole("region", { name: "Your core" }));
const trayCards = () =>
  within(tray().getByRole("list", { name: "Cards in your core" }))
    .queryAllByRole("listitem")
    .map((li) => li.getAttribute("aria-label"));

describe("engine board", () => {
  it("lays the ranked cards out by engine, makers beside what uses them", async () => {
    await open();
    for (const engine of [
      "Runechant engine",
      "Gate engine",
      "Banish engine",
      "Aura engine",
    ]) {
      expect(screen.getByRole("region", { name: engine })).toBeInTheDocument();
    }
    // Nothing ranked does tempo, so that engine isn't shown.
    expect(screen.queryByRole("region", { name: "Tempo engine" })).toBeNull();
    expect(laneNames("Make Gates")).toEqual(["Become the Shadow Lord"]);
    expect(laneNames("Gate targets")).toEqual([
      "Hocus Pocus (red)",
      "Hocus Pocus (yellow)",
      "Hocus Pocus (blue)",
    ]);
  });

  it("shows only the Runechant makers: nothing is linked as using them", async () => {
    await open();
    const runechant = within(
      screen.getByRole("region", { name: "Runechant engine" }),
    );
    expect(
      runechant.getByRole("list", { name: "Make Runechants" }),
    ).toBeInTheDocument();
    expect(runechant.queryByText("Use Runechants")).toBeNull();
  });

  it("shows a card's value and its floor-to-ceiling range", async () => {
    await open();
    const [bsl] = lane("Make Gates");
    // 70, shown out of 10.
    expect(bsl).toHaveTextContent("7");
    expect(
      within(bsl!).getByRole("img", {
        name: "Floor 2, overall 7, ceiling 10",
      }),
    ).toBeInTheDocument();
  });

  it("re-orders the lanes by play style", async () => {
    const { user, router } = await open();
    expect(laneNames("Make Runechants")[0]).toBe("Become the Shadow Lord");
    await goTab("Set up");
    await user.click(
      within(panel().getByRole("group", { name: "Play style" })).getByRole(
        "button",
        { name: "Consistent" },
      ),
    );
    await goTab("Board");
    // 70 − 0.5 × (70 − 20) = 45, under Hocus Pocus (red) at 50
    expect(laneNames("Make Runechants")[0]).toBe("Hocus Pocus (red)");
    expect(router.state.location.search).toMatchObject({ risk: -50 });
  });

  it("floats preferred cards and their companions, without changing scores", async () => {
    // At Consistent, Hocus Pocus (red) 50 leads Become the Shadow Lord 45. Avoiding Gate
    // targets sinks Hocus Pocus by 25 and Become the Shadow Lord (a Gate maker) by half that.
    await open(
      `/ranking?risk=-50&pref=${encodeURIComponent(JSON.stringify({ gateTargets: 0 }))}`,
    );
    expect(laneNames("Make Runechants")[0]).toBe("Become the Shadow Lord");
    expect(lane("Make Runechants")[0]).toHaveTextContent("4.5");
  });

  it("marks preferred cards on the board", async () => {
    await open(
      `/ranking?pref=${encodeURIComponent(JSON.stringify({ gateTargets: 100 }))}`,
    );
    for (const li of lane("Gate targets")) {
      expect(li).toHaveTextContent("preferred");
    }
  });

  it("sets preferences with sliders in Set up", async () => {
    const { user, router } = await open();
    await goTab("Set up");
    const slider = panel().getByRole("slider", { name: "Usurp cards" });
    slider.focus();
    await user.keyboard("{End}");
    expect(router.state.location.search).toMatchObject({
      pref: { usurp: 100 },
    });
    for (const name of ["Rune Gate cards", "Gate targets", "Disruption"]) {
      expect(panel().getByRole("slider", { name })).toBeInTheDocument();
    }
  });

  it("puts the chosen side's engine first", async () => {
    const { user } = await open();
    const engines = () =>
      screen
        .getAllByRole("region")
        .map((r) => r.getAttribute("aria-label"))
        .filter((n) => n?.endsWith(" engine"));
    expect(engines()[0]).toBe("Runechant engine");
    await goTab("Set up");
    await user.click(
      within(panel().getByRole("group", { name: "Side" })).getByRole("button", {
        name: "Usurper",
      }),
    );
    await goTab("Board");
    expect(engines()[0]).toBe("Gate engine");
  });

  it("finds a card by name", async () => {
    const { user } = await open();
    await user.type(
      screen.getByRole("searchbox", { name: "Find a card" }),
      "shadow",
    );
    expect(laneNames("Make Gates")).toEqual(["Become the Shadow Lord"]);
    expect(screen.queryByRole("list", { name: "Gate targets" })).toBeNull();
  });

  it("has no filters: the core's priorities and targets do that job", async () => {
    await open();
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Pitch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More filters" })).toBeNull();
  });

  it("explains an empty board and points to Needs review", async () => {
    await open("/ranking", { scores: scores({ community: [] }) });
    expect(screen.getByText("Nothing ranked yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review cards" })).toHaveAttribute(
      "href",
      "/needs-review",
    );
  });

  it("shows weapons and equipment by slot", async () => {
    await open();
    const gear = screen.getByRole("region", { name: "Weapons and equipment" });
    expect(within(gear).getByText("Nebula Blade")).toBeInTheDocument();
  });

  it("opens a card in the pop-over and steps through the board in order", async () => {
    const { user, router } = await open();
    await user.click(
      screen.getAllByRole("button", {
        name: "Open Become the Shadow Lord",
      })[0]!,
    );
    expect(
      await screen.findByRole("dialog", { name: /Become the Shadow Lord/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(
      await screen.findByRole("dialog", { name: /Hocus Pocus/ }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ variant: "hp1" });
  });

  it("offers whose scores to use only when signed in", async () => {
    await open("/ranking?tab=setup");
    expect(screen.queryByRole("group", { name: "Whose scores" })).toBeNull();
  });

  it("keeps the priorities in Set up", async () => {
    await open("/ranking", { signedIn: true });
    await goTab("Set up");
    for (const name of ["Play style", "Side", "Whose scores"]) {
      expect(panel().getByRole("group", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Your core" })).toBeNull();
  });
});

describe("tabs", () => {
  it("opens on Set up, step 1, and keeps the other tabs in the URL", async () => {
    const { router } = await open("/ranking", { asIs: true });
    expect(screen.getByRole("tab", { name: /Set up/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(router.state.location.search).not.toHaveProperty("tab");
    await goTab("Board");
    expect(router.state.location.search).toMatchObject({ tab: "board" });
    await goTab("Readings");
    expect(router.state.location.search).toMatchObject({ tab: "readings" });
    await goTab("Set up");
    expect(router.state.location.search).not.toHaveProperty("tab");
  });

  it("opens on the tab in the URL", async () => {
    await open("/ranking?tab=board");
    expect(screen.getByRole("tab", { name: /Board/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

// README "Phase Two" step 2: the core and the cards nearest it, rules' and scoring group's
// links drawn differently. The sample's only rule link is Become the Shadow Lord → Hocus Pocus.
describe("synergy graph", () => {
  const items = (name: string) =>
    within(panel().getByRole("list", { name }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);

  it("asks for a core first", async () => {
    await open("/ranking?tab=graph");
    expect(
      panel().getByText("Add cards to your core to see how they link."),
    ).toBeInTheDocument();
  });

  it("shows the core and the cards linked to it, with each link and where it comes from", async () => {
    const synergy = fakeSynergyRepository(
      {},
      {
        edges: [
          {
            fromCardId: "card-fate-foreseen",
            toCardId: "card-hocus-pocus",
            weight: 0.4,
            ratingCount: 2,
            totalWeight: 2,
          },
        ],
        feedback: [],
      },
    );
    await open(`/ranking?tab=graph&${core({ hp3: 3 })}`, { synergy });
    expect(
      await panel().findByRole("img", { name: "Synergy graph" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(items("Cards shown")).toEqual([
        "Hocus Pocus (in your core)",
        "Become the Shadow Lord",
        "Fate Foreseen",
      ]),
    );
    expect(items("Links shown")).toEqual([
      "Become the Shadow Lord helps Hocus Pocus · rules · 0.8 · enables traverse",
      "Fate Foreseen helps Hocus Pocus · scoring group · 0.4",
    ]);
  });
});

describe("strategy questions", () => {
  it("saves your answer and shows the scoring group's average beside it", async () => {
    const { user, strategy } = await open("/ranking?tab=setup", {
      signedIn: true,
    });
    const question = within(
      await panel().findByRole("group", {
        name: "How important is traversing to Usurper?",
      }),
    );
    expect(
      question.getByText("Scoring group 7.5 · 2 answers"),
    ).toBeInTheDocument();
    await user.click(question.getByRole("button", { name: "8" }));
    expect(strategy.saved).toEqual(["traverse_to_usurper 8"]);
    expect(question.getByRole("button", { name: "8" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("updates the scoring group's average after you answer", async () => {
    const { user } = await open("/ranking?tab=setup", {
      signedIn: true,
      onlyScorer: true,
    });
    const question = within(
      await panel().findByRole("group", {
        name: "How important is traversing to Usurper?",
      }),
    );
    await user.click(question.getByRole("button", { name: "6" }));
    expect(
      await question.findByText("Scoring group 6.0 · 1 answer"),
    ).toBeInTheDocument();
  });

  it("says when the scoring group hasn't answered yet", async () => {
    await open("/ranking?tab=setup", { signedIn: true });
    const question = within(
      await panel().findByRole("group", {
        name: "Once on Usurper, how keen are you to flip back to Forsaken?",
      }),
    );
    expect(
      question.getByText("No answers from the scoring group yet"),
    ).toBeInTheDocument();
  });

  it("asks signed-out visitors to sign in to answer", async () => {
    await open("/ranking?tab=setup");
    const question = within(
      await panel().findByRole("group", {
        name: "How important is traversing to Usurper?",
      }),
    );
    expect(question.getByRole("button", { name: "8" })).toBeDisabled();
    expect(panel().getAllByText("Sign in to answer.")[0]).toBeInTheDocument();
  });
});

describe("the core", () => {
  it("adds a card at the copy limit, keeps it in the URL and shows what fits it", async () => {
    const { user, router } = await open();
    await user.click(
      screen.getAllByRole("button", {
        name: "Add Become the Shadow Lord to your core",
      })[0]!,
    );
    expect(trayCards()).toEqual(["3 × Become the Shadow Lord"]);
    expect(router.state.location.search).toMatchObject({ core: { bsl3: 3 } });
    for (const li of lane("Gate targets")) {
      expect(li).toHaveTextContent("fits 1");
    }
  });

  it("changes copies and removes cards", async () => {
    const { user } = await open(`/ranking?${core({ bsl3: 3 })}`);
    await user.click(
      tray().getByRole("button", { name: "Fewer Become the Shadow Lord" }),
    );
    expect(trayCards()).toEqual(["2 × Become the Shadow Lord"]);
    await user.click(
      tray().getByRole("button", { name: "Remove Become the Shadow Lord" }),
    );
    expect(trayCards()).toEqual([]);
  });

  it("can order lanes by best fit", async () => {
    const { user, router } = await open(`/ranking?${core({ hp1: 3 })}`);
    await user.click(
      within(screen.getByRole("group", { name: "Order" })).getByRole("button", {
        name: "Best fits first",
      }),
    );
    expect(router.state.location.search).toMatchObject({ order: "fits" });
    expect(lane("Make Gates")[0]).toHaveTextContent("fits 1");
  });

  it("weighs each engine in Readings and says what's missing", async () => {
    await open(`/ranking?tab=readings&${core({ bsl3: 3 })}`);
    const gate = within(panel().getByRole("group", { name: "Gate engine" }));
    expect(gate.getByText("3 make")).toBeInTheDocument();
    expect(gate.getByText("0 targets")).toBeInTheDocument();
    expect(gate.getByText("No Gate targets yet.")).toBeInTheDocument();
  });

  it("weighs the Runechant engine by its makers alone", async () => {
    await open(`/ranking?tab=readings&${core({ bsl3: 3 })}`);
    const runechant = within(
      panel().getByRole("group", { name: "Runechant engine" }),
    );
    expect(runechant.getByText("3 make")).toBeInTheDocument();
    expect(runechant.queryByText(/use/)).toBeNull();
  });

  it("only weighs engines that have cards in the core", async () => {
    await open("/ranking?tab=readings");
    expect(panel().queryByRole("group", { name: "Gate engine" })).toBeNull();
    expect(
      panel().getByText("Add cards to see how each engine balances."),
    ).toBeInTheDocument();
  });

  it("counts deck cards and compares pitch with the targets", async () => {
    await open(`/ranking?${core({ bsl3: 3, hp1: 2 })}`);
    // The count is in the header, on every tab.
    expect(screen.getByText("5 of 60 deck cards")).toBeInTheDocument();
    await goTab("Set up");
    expect(screen.getByText("5 of 60 deck cards")).toBeInTheDocument();
    expect(panel().getByText("Blue 3 of 22")).toBeInTheDocument();
    expect(panel().getByText("Red 2 of 18")).toBeInTheDocument();
  });

  const setTargets = async (
    user: ReturnType<typeof userEvent.setup>,
    targets: [string, string][],
  ) => {
    for (const [name, n] of targets) {
      const input = panel().getByRole("spinbutton", { name });
      await user.clear(input);
      await user.type(input, n);
    }
  };

  it("finishing Set up builds the core to the pitch targets and shows the board", async () => {
    const { user } = await open("/ranking?tab=setup");
    await setTargets(user, [
      ["Red target", "3"],
      ["Yellow target", "0"],
      ["Blue target", "3"],
    ]);
    await user.click(panel().getByRole("button", { name: "Build the core →" }));
    expect(screen.getByRole("tab", { name: /Board/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(trayCards()).toEqual([
      "3 × Hocus Pocus (red)",
      "3 × Become the Shadow Lord",
    ]);
  });

  // docs/synergy-rules.md "Synergy in the ranking": off until the scoring group agrees a default.
  it("sets synergy strength in Set up, off by default", async () => {
    const { user, router } = await open();
    await goTab("Set up");
    const slider = panel().getByRole("slider", { name: "Synergy strength" });
    expect(slider).toHaveAttribute("aria-valuetext", "0");
    slider.focus();
    await user.keyboard("{End}");
    expect(router.state.location.search).toMatchObject({ syn: 100 });
  });

  it("with synergy on, building uses the scoring group's links and still fills to the targets", async () => {
    const synergy = fakeSynergyRepository();
    const { user } = await open("/ranking?tab=setup&syn=100", { synergy });
    await setTargets(user, [
      ["Red target", "3"],
      ["Yellow target", "0"],
      ["Blue target", "3"],
    ]);
    await user.click(panel().getByRole("button", { name: "Build the core →" }));
    expect(trayCards()).toEqual([
      "3 × Hocus Pocus (red)",
      "3 × Become the Shadow Lord",
    ]);
    expect(synergy.loads).toBeGreaterThan(0);
  });

  it("keeps the cards already in the core when building", async () => {
    const { user } = await open(`/ranking?tab=setup&${core({ hp3: 2 })}`);
    await setTargets(user, [
      ["Red target", "3"],
      ["Yellow target", "0"],
      ["Blue target", "5"],
    ]);
    await user.click(panel().getByRole("button", { name: "Build the core →" }));
    expect(trayCards()).toEqual([
      "3 × Hocus Pocus (red)",
      "3 × Become the Shadow Lord",
      "2 × Hocus Pocus (blue)",
    ]);
  });

  it("can go to the board without adding cards", async () => {
    const { user } = await open("/ranking?tab=setup");
    await user.click(
      panel().getByRole("button", {
        name: "Go to the board without adding cards",
      }),
    );
    expect(screen.getByRole("tab", { name: /Board/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(trayCards()).toEqual([]);
  });

  it("adds the core to the chosen deck", async () => {
    const { user, fake } = await open(
      `/ranking?deck=deck-1&${core({ hp1: 3 })}`,
      { signedIn: true },
    );
    await user.click(
      await tray().findByRole("button", { name: "Add core to Gate tempo" }),
    );
    expect(fake.saved).toEqual(["set deck-1 hp1 3 main"]);
    expect(
      await tray().findByText("Added 3 cards to Gate tempo"),
    ).toBeInTheDocument();
    expect(
      tray().getByRole("link", { name: "Open Gate tempo" }),
    ).toHaveAttribute("href", "/decks/deck-1");
  });

  it("saves the core as a new deck", async () => {
    const { user, fake, router } = await open(`/ranking?${core({ hp1: 3 })}`, {
      signedIn: true,
    });
    await user.type(
      tray().getByRole("textbox", { name: "New deck name" }),
      "Red core",
    );
    await user.click(tray().getByRole("button", { name: "Save as new deck" }));
    // The Set up pitch targets go with it, so the deck's Stats compare against them.
    await waitFor(() =>
      expect(fake.saved).toEqual([
        "create Red core",
        "set deck-2 hp1 3 main",
        "targets deck-2 1:18,2:5,3:22",
      ]),
    );
    expect(router.state.location.search).toMatchObject({ deck: "deck-2" });
    // And the way forward: open the deck to finish it.
    expect(
      await tray().findByRole("link", { name: "Open Red core" }),
    ).toHaveAttribute("href", "/decks/deck-2");
  });

  it("marks cards already in the chosen deck", async () => {
    await open("/ranking?deck=deck-1", {
      signedIn: true,
      decks: [
        gateTempo({
          cards: [{ variantId: "hp3", quantity: 2, sideboard: false }],
        }),
      ],
    });
    await waitFor(() =>
      expect(
        lane("Gate targets").find(
          (li) => li.getAttribute("aria-label") === "Hocus Pocus (blue)",
        ),
      ).toHaveTextContent("2 in deck"),
    );
  });

  it("asks signed-out visitors to sign in to save", async () => {
    await open(`/ranking?${core({ hp1: 3 })}`);
    expect(
      tray().getByText("Sign in to save the core as a deck."),
    ).toBeInTheDocument();
  });
});

describe("scenarios", () => {
  it("lists the built-in scenarios before they've run", async () => {
    await open(`/ranking?tab=readings&${core({ bsl3: 3, hp1: 3 })}`);
    const scenarios = within(screen.getByRole("region", { name: "Scenarios" }));
    expect(
      scenarios.getByText("Opening hand creates 3 or more Runechants"),
    ).toBeInTheDocument();
    expect(scenarios.getAllByText("Not run yet").length).toBeGreaterThan(3);
  });

  it("runs them all with one button and reports success rates and why runs failed", async () => {
    const { user } = await open(
      `/ranking?tab=readings&${core({ bsl3: 3, hp1: 3 })}`,
    );
    await user.click(screen.getByRole("button", { name: "Run scenarios" }));
    const scenarios = within(
      await screen.findByRole("region", { name: "Scenarios" }),
    );
    const row = within(
      await scenarios.findByRole("listitem", {
        name: "Opening hand creates 3 or more Runechants",
      }),
    );
    // To a tenth of a percent, so a new seed's small differences show.
    expect(row.getByText(/^\d+\.\d%$/)).toBeInTheDocument();
    expect(row.getByText(/^Fails without/)).toBeInTheDocument();
    expect(
      scenarios.getByText(
        "10,000 runs each · seed 1 · 6 core cards + 54 blanks (60)",
      ),
    ).toBeInTheDocument();
  });

  it("says plainly what a run fails without when there's only one reason", async () => {
    const { user } = await open(
      `/ranking?tab=readings&${core({ bsl3: 3, hp1: 3 })}`,
    );
    await user.click(screen.getByRole("button", { name: "Run scenarios" }));
    const row = within(
      await screen.findByRole("listitem", {
        name: "Opening hand has a blue card to pitch",
      }),
    );
    expect(row.getByText("Fails without a blue card")).toBeInTheDocument();
  });

  it("doesn't run a scenario the core can't meet, and says why in a note below the list", async () => {
    const { user } = await open(`/ranking?tab=readings&${core({ hp1: 3 })}`);
    await user.click(screen.getByRole("button", { name: "Run scenarios" }));
    const scenarios = within(
      await screen.findByRole("region", { name: "Scenarios" }),
    );
    const note = within(
      await scenarios.findByRole("list", { name: "Can't run with this core" }),
    );
    // A named card that isn't in the core, and a role no card in the core has.
    expect(
      note.getByRole("listitem", {
        name: "Opening hand has Become the Shadow Lord and another Shadow card",
      }),
    ).toHaveTextContent("needs Become the Shadow Lord");
    expect(
      note.getByRole("listitem", {
        name: "Opening hand has a Gate maker and a Gate target",
      }),
    ).toHaveTextContent("needs a Gate maker");
    // They aren't shown as 0% in the main list.
    expect(
      within(scenarios.getByRole("list", { name: "Results" })).queryByRole(
        "listitem",
        { name: "Opening hand has a Gate maker and a Gate target" },
      ),
    ).toBeNull();
  });

  it("gives slightly different results for a new seed", async () => {
    const { user } = await open(
      `/ranking?tab=readings&${core({ bsl3: 3, hp1: 3 })}`,
    );
    const scenarios = within(screen.getByRole("region", { name: "Scenarios" }));
    const rate = () =>
      within(
        scenarios.getByRole("listitem", {
          name: "Opening hand has a blue card to pitch",
        }),
      ).getByText(/%$/).textContent;
    await user.click(screen.getByRole("button", { name: "Run scenarios" }));
    await scenarios.findByText(/seed 1 ·/);
    const first = rate();
    await user.click(screen.getByRole("button", { name: "New seed" }));
    await scenarios.findByText(/seed 2 ·/);
    expect(rate()).not.toBe(first);
  });

  it("draws the traverse timeline when run", async () => {
    const { user } = await open(
      `/ranking?tab=readings&${core({ bsl3: 3, hp1: 3 })}`,
    );
    await user.click(screen.getByRole("button", { name: "Run scenarios" }));
    const timeline = within(
      await screen.findByRole("region", { name: "Traverse timeline" }),
    );
    expect(
      timeline.getByRole("img", { name: /On Usurper by turn 1: \d+%/ }),
    ).toBeInTheDocument();
    expect(
      timeline.getByText("never reach Usurper in 6 turns"),
    ).toBeInTheDocument();
  });

  it("says when the core has changed since the last run", async () => {
    const { user } = await open(
      `/ranking?tab=readings&${core({ bsl3: 3, hp1: 3 })}`,
    );
    await user.click(screen.getByRole("button", { name: "Run scenarios" }));
    await screen.findByRole("region", { name: "Traverse timeline" });
    await goTab("Board");
    await user.click(
      tray().getByRole("button", { name: "Remove Become the Shadow Lord" }),
    );
    await goTab("Readings");
    expect(
      screen.getByText(
        "Your core has changed since this run. Run again to update.",
      ),
    ).toBeInTheDocument();
  });
});
