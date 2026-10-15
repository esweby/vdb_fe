import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { sampleCommunity } from "../test/sampleCommunity.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import type { DeckCard } from "../decks/deckRepository.ts";

const scores = (over = {}) =>
  fakeScoreRepository([], { community: sampleCommunity(), ...over }).repository;
const ranked = () =>
  within(screen.getByRole("table", { name: "Ranked by your priorities" }));
const rankedNames = () =>
  ranked()
    .getAllByRole("row")
    .slice(1)
    .filter((r) => within(r).queryByRole("link"))
    .map((r) => within(r).getByRole("link").textContent);
const openTab = (name: RegExp) =>
  userEvent.setup().click(screen.getByRole("tab", { name }));

describe("ranking page", () => {
  it("ranks deck cards by overall when balanced, leaving out unrated cards and weapons", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    expect(rankedNames()).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus (red)",
      "Hocus Pocus (yellow)",
      "Hocus Pocus (blue)",
    ]);
    expect(ranked().getAllByRole("row")[1]).toHaveTextContent("70");
  });

  it("re-ranks when the risk slider moves", async () => {
    const { router } = await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const risk = screen.getByRole("slider", {
      name: "Risk (floor ← → ceiling)",
    });
    risk.focus();
    await userEvent.setup().keyboard("{Home}");
    // At full consistent, Become the Shadow Lord drops to its floor (20).
    await waitFor(() => expect(rankedNames()[0]).toBe("Hocus Pocus (red)"));
    expect(rankedNames().at(-1)).toBe("Become the Shadow Lord");
    expect(router.state.location.search).toMatchObject({ risk: -100 });
  });

  it("has Consistent, Balanced and High-roll presets", async () => {
    const { router } = await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    expect(screen.getByRole("button", { name: "Balanced" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Consistent" }));
    // 70 − 0.5 × (70 − 20) = 45, under Hocus Pocus (red) at 50
    await waitFor(() => expect(rankedNames()[0]).toBe("Hocus Pocus (red)"));
    expect(router.state.location.search).toMatchObject({ risk: -50 });
    expect(screen.getByRole("button", { name: "Consistent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("marks the top N as the core with a cut-off line, not a tag on every row", async () => {
    await renderApp({
      path: "/ranking?core=2",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const rows = ranked().getAllByRole("row").slice(1);
    expect(rows[2]).toHaveTextContent("Core cut-off");
    expect(ranked().queryByText("Core")).not.toBeInTheDocument();
  });

  it("sums up the core: how many cards, how many pinned, and its pitch mix", async () => {
    await renderApp({
      path: `/ranking?core=2&pin=${encodeURIComponent(JSON.stringify(["hp3"]))}`,
      auth: fakeAuthService().service,
      scores: scores(),
    });
    const core = await screen.findByRole("region", { name: "Suggested core" });
    expect(core).toHaveTextContent("2 cards");
    expect(core).toHaveTextContent("1 pinned");
    // Hocus Pocus (blue) pinned first, then Become the Shadow Lord (blue)
    expect(
      within(core).getByRole("img", { name: "Pitch mix: 2 blue" }),
    ).toBeInTheDocument();
  });

  it("shows each card's floor, overall and ceiling as a range", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const row = ranked().getAllByRole("row")[1]!;
    expect(
      within(row).getByRole("img", {
        name: "Floor 20, overall 70, ceiling 100",
      }),
    ).toBeInTheDocument();
    expect(row).toHaveTextContent("3 ratings");
  });

  it("opens a card in the pop-over and steps through the ranking in order", async () => {
    const { router } = await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const user = userEvent.setup();
    await user.click(
      ranked().getByRole("link", { name: "Become the Shadow Lord" }),
    );
    expect(
      await screen.findByRole("dialog", { name: /Become the Shadow Lord/ }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({
      card: "card-become-the-shadow-lord",
    });
    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(
      await screen.findByRole("dialog", { name: /Hocus Pocus/ }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ variant: "hp1" });
  });

  it("has Forsaken, Both and Usurper side presets", async () => {
    const { router } = await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const side = within(screen.getByRole("group", { name: "Side" }));
    expect(side.getByRole("button", { name: "Both" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent
      .setup()
      .click(side.getByRole("button", { name: "Usurper" }));
    expect(router.state.location.search).toMatchObject({ side: 100 });
  });

  it("changes the core size with a stepper", async () => {
    const { router } = await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "More core cards" }));
    expect(router.state.location.search).toMatchObject({ core: 21 });
    expect(screen.getByRole("status", { name: "Core size" })).toHaveTextContent(
      "21",
    );
  });

  it("explains an empty ranking and points to Needs review", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores({ community: [] }),
    });
    expect(await screen.findByText("Nothing ranked yet")).toBeInTheDocument();
    expect(
      ranked().getByRole("link", { name: "Review cards" }),
    ).toHaveAttribute("href", "/needs-review");
  });

  it("pins and excludes cards", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Pin Hocus Pocus (blue)" }),
    );
    expect(rankedNames()[0]).toBe("Hocus Pocus (blue)");
    await user.click(
      screen.getByRole("button", { name: "Exclude Become the Shadow Lord" }),
    );
    expect(rankedNames()).not.toContain("Become the Shadow Lord");
    await user.click(screen.getByRole("tab", { name: /Excluded/ }));
    await user.click(
      screen.getByRole("button", { name: "Restore Become the Shadow Lord" }),
    );
    await user.click(screen.getByRole("tab", { name: /Deck cards/ }));
    expect(rankedNames()).toContain("Become the Shadow Lord");
  });

  it("ranks weapons and equipment separately, by slot, in their own tab", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    expect(screen.queryByRole("table", { name: "Weapons" })).toBeNull();
    await openTab(/Weapons and equipment/);
    const weapons = screen.getByRole("table", { name: "Weapons" });
    expect(
      within(weapons).getByRole("link", { name: "Nebula Blade" }),
    ).toBeInTheDocument();
  });

  it("narrows candidates with the filter sidebar", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const user = userEvent.setup();
    const cls = within(screen.getByRole("group", { name: "Class" }));
    await user.click(cls.getByRole("button", { name: "Shadow" }));
    expect(rankedNames()).toEqual(["Become the Shadow Lord"]);
  });

  it("shows only the selected pitch's rows", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    await userEvent
      .setup()
      .click(
        within(screen.getByRole("group", { name: "Pitch" })).getByRole(
          "button",
          { name: "Yellow" },
        ),
      );
    expect(rankedNames()).not.toContain("Hocus Pocus (red)");
    expect(rankedNames()).toContain("Hocus Pocus (yellow)");
  });

  it("offers the mine/community blend only when signed in", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    expect(
      screen.queryByRole("slider", { name: /Whose scores/ }),
    ).not.toBeInTheDocument();
  });

  it("uses my reviewed scores when the blend favours mine", async () => {
    const users = {
      "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
    };
    await renderApp({
      path: "/ranking?blend=0",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: scores({
        reviewedCardIds: ["card-hocus-pocus"],
        allMyScores: [
          {
            cardId: "card-hocus-pocus",
            variantId: null,
            side: null,
            dimensionId: 3,
            score: 60,
          },
        ],
      }),
    });
    expect(
      await screen.findByRole("slider", { name: /Whose scores/ }),
    ).toBeInTheDocument();
    // Mine: every Hocus Pocus pitch has overall 60, under BSL's community 70
    await waitFor(() =>
      expect(rankedNames()[0]).toBe("Become the Shadow Lord"),
    );
    expect(ranked().getAllByRole("row")[2]).toHaveTextContent("60");
  });
});

describe("adding ranked cards to a deck", () => {
  const signedIn = () =>
    fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service;
  const decks = (cards: DeckCard[] = []) =>
    fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards,
        pitchTargets: {},
      },
    ]);

  it("adds cards to the chosen deck, keeping the choice in the URL", async () => {
    const fake = decks();
    const { router } = await renderApp({
      path: "/ranking",
      auth: signedIn(),
      scores: scores(),
      decks: fake.repository,
    });
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByLabelText("Add to deck"),
      "Gate tempo",
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ deck: "deck-1" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Add Hocus Pocus (red) to Gate tempo",
      }),
    );
    expect(fake.saved).toEqual(["set deck-1 hp1 1 main"]);
    expect(ranked().getByText("1 in deck")).toBeInTheDocument();
    await user.click(
      screen.getByRole("tab", { name: /Weapons and equipment/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add Nebula Blade to Gate tempo" }),
    );
    expect(fake.saved).toEqual([
      "set deck-1 hp1 1 main",
      "set deck-1 nb 1 main",
    ]);
  });

  it("treats cards already in the deck as pinned", async () => {
    await renderApp({
      path: "/ranking?deck=deck-1",
      auth: signedIn(),
      scores: scores(),
      decks: decks([{ variantId: "hp3", quantity: 2, sideboard: false }])
        .repository,
    });
    await screen.findByRole("button", {
      name: "Add Hocus Pocus (blue) to Gate tempo",
    });
    expect(rankedNames()[0]).toBe("Hocus Pocus (blue)");
    expect(ranked().getByText("2 in deck")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Suggested core" }),
    ).toHaveTextContent("2 of 60 deck cards");
  });

  it("can't add more than the copy limit", async () => {
    await renderApp({
      path: "/ranking?deck=deck-1",
      auth: signedIn(),
      scores: scores(),
      decks: decks([{ variantId: "hp3", quantity: 3, sideboard: false }])
        .repository,
    });
    expect(
      await screen.findByRole("button", {
        name: "Add Hocus Pocus (blue) to Gate tempo",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Add Hocus Pocus (red) to Gate tempo",
      }),
    ).toBeEnabled();
  });

  it("isn't offered to signed-out visitors", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    expect(screen.queryByLabelText("Add to deck")).not.toBeInTheDocument();
  });
});

describe("priorities rail", () => {
  it("has no slider scales: the rail is too narrow for the numbers", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const priorities = screen.getByRole("region", { name: "Priorities" });
    expect(within(priorities).queryAllByTestId("slider-scale")).toHaveLength(0);
  });
});
