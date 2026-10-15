import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Deck } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
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
const gateTempo = (over: Partial<Deck> = {}): Deck => ({
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
    decks?: Deck[];
    scores?: ReturnType<typeof scores>;
  } = {},
) {
  const fake = fakeDeckRepository(opts.decks ?? [gateTempo()]);
  const app = await renderApp({
    path,
    auth: opts.signedIn ? signedIn() : fakeAuthService().service,
    scores: opts.scores ?? scores(),
    decks: fake.repository,
  });
  await screen.findByRole("region", { name: "Your core" });
  return { ...app, fake, user: userEvent.setup() };
}
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

  it("shows a card's value and its floor-to-ceiling range", async () => {
    await open();
    const [bsl] = lane("Make Gates");
    expect(bsl).toHaveTextContent("70");
    expect(
      within(bsl!).getByRole("img", {
        name: "Floor 20, overall 70, ceiling 100",
      }),
    ).toBeInTheDocument();
  });

  it("re-orders the lanes by play style", async () => {
    const { user, router } = await open();
    expect(laneNames("Make Runechants")[0]).toBe("Become the Shadow Lord");
    await user.click(
      within(screen.getByRole("group", { name: "Play style" })).getByRole(
        "button",
        { name: "Consistent" },
      ),
    );
    // 70 − 0.5 × (70 − 20) = 45, under Hocus Pocus (red) at 50
    expect(laneNames("Make Runechants")[0]).toBe("Hocus Pocus (red)");
    expect(router.state.location.search).toMatchObject({ risk: -50 });
  });

  it("puts the chosen side's engine first", async () => {
    const { user } = await open();
    const engines = () =>
      screen
        .getAllByRole("region")
        .map((r) => r.getAttribute("aria-label"))
        .filter((n) => n?.endsWith(" engine"));
    expect(engines()[0]).toBe("Runechant engine");
    await user.click(
      within(screen.getByRole("group", { name: "Side" })).getByRole("button", {
        name: "Usurper",
      }),
    );
    expect(engines()[0]).toBe("Gate engine");
  });

  it("narrows the board with search and pitch", async () => {
    const { user } = await open();
    await user.click(
      within(screen.getByRole("group", { name: "Pitch" })).getByRole("button", {
        name: "Yellow",
      }),
    );
    expect(laneNames("Gate targets")).toEqual(["Hocus Pocus (yellow)"]);
    await user.type(
      screen.getByRole("searchbox", { name: "Find a card" }),
      "shadow",
    );
    expect(screen.queryByRole("list", { name: "Gate targets" })).toBeNull();
  });

  it("keeps the rarer filters behind More filters", async () => {
    const { user } = await open();
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "More filters" }));
    expect(
      screen.getByRole("complementary", { name: "Filters" }),
    ).toBeInTheDocument();
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
    await open();
    expect(screen.queryByRole("group", { name: "Whose scores" })).toBeNull();
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

  it("weighs each engine and says what's missing", async () => {
    await open(`/ranking?${core({ bsl3: 3 })}`);
    const gate = within(tray().getByRole("group", { name: "Gate engine" }));
    expect(gate.getByText("3 make")).toBeInTheDocument();
    expect(gate.getByText("0 targets")).toBeInTheDocument();
    expect(gate.getByText("No Gate targets yet.")).toBeInTheDocument();
  });

  it("counts deck cards and compares pitch with the targets", async () => {
    await open(`/ranking?${core({ bsl3: 3, hp1: 2 })}`);
    expect(tray().getByText("5 of 60 deck cards")).toBeInTheDocument();
    expect(tray().getByText("Blue 3 of 22")).toBeInTheDocument();
    expect(tray().getByText("Red 2 of 18")).toBeInTheDocument();
  });

  it("fills each pitch to its target", async () => {
    const { user } = await open();
    for (const [name, n] of [
      ["Red target", "3"],
      ["Yellow target", "0"],
      ["Blue target", "3"],
    ] as const) {
      const input = tray().getByRole("spinbutton", { name });
      await user.clear(input);
      await user.type(input, n);
    }
    await user.click(tray().getByRole("button", { name: "Fill to targets" }));
    expect(trayCards()).toEqual([
      "3 × Hocus Pocus (red)",
      "3 × Become the Shadow Lord",
    ]);
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
    expect(await tray().findByRole("status")).toHaveTextContent(
      "Added 3 cards to Gate tempo",
    );
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
    await waitFor(() =>
      expect(fake.saved).toEqual(["create Red core", "set deck-2 hp1 3 main"]),
    );
    expect(router.state.location.search).toMatchObject({ deck: "deck-2" });
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
