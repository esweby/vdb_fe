// FaBlazing in the app (docs/fablazing-plan.md, step 3; next step 4): real-game evidence on card
// pages, Viserai's matchups and Effect drafts. Guardrails: n >= 50, Wilson intervals, matchup
// context, the data's freshness, associations in neutral words, and FaBlazing credited.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import {
  fakeCardRepository,
  sampleCards,
  TEST_POCUS,
} from "../test/fakeCardRepository.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import {
  cardStat,
  fakeFablazingRepository,
  matchupStat,
  WINDOW,
} from "../test/fakeFablazingRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { MatchupStat } from "./fablazingRepository.ts";

const CCC_WINDOW = {
  format: 1 as const,
  startsOn: "2026-10-05",
  latest: "2026-10-29",
};

async function cardPage(fablazing = fakeFablazingRepository()) {
  await renderApp({
    path: "/cards/card-become-the-shadow-lord?tab=real-games",
    auth: fakeAuthService().service,
    fablazing,
  });
  return within(await screen.findByRole("region", { name: "In real games" }));
}

describe("In real games, on the card page", () => {
  it("shows how decks with the card did, against Viserai's baseline, with intervals", async () => {
    const panel = await cardPage(
      fakeFablazingRepository({ windows: [WINDOW], cards: [cardStat()] }),
    );
    expect(
      await panel.findByText(
        "In 40% of Viserai's decks, 2.8 copies on average",
      ),
    ).toBeInTheDocument();
    const value = (name: string) =>
      within(
        panel.getByRole("row", { name: new RegExp(`^${name}`) }),
      ).getByRole("cell").textContent;
    expect(value("Plays per game")).toBe("1.7");
    expect(value("Pitches per game")).toBe("0.3");
    expect(value("Blocks per game")).toBe("0.1");
    expect(value("Hits per play")).toBe("0.32");
    expect(
      panel.getByText("Decks with this card won 50% (±12)"),
    ).toBeInTheDocument();
    expect(
      panel.getByText("All of Viserai's decks won 45% (±8)"),
    ).toBeInTheDocument();
    expect(panel.getByText(/n = 58 games/)).toBeInTheDocument();
    // Matchup context: an average over the heroes Viserai faced.
    expect(
      panel.getByText(/Across every hero Viserai faced/),
    ).toBeInTheDocument();
  });

  it("calls the two rates different only when their intervals don't overlap", async () => {
    const close = await cardPage(
      fakeFablazingRepository({ windows: [WINDOW], cards: [cardStat()] }),
    );
    expect(
      await close.findByText(
        "No clear difference from all of Viserai's decks.",
      ),
    ).toBeInTheDocument();
  });

  it("names the higher rate when the intervals are apart", async () => {
    const apart = await cardPage(
      fakeFablazingRepository({
        windows: [WINDOW],
        cards: [cardStat({ wins: 50 })],
      }),
    );
    expect(
      await apart.findByText(
        "Higher than all of Viserai's decks: the intervals don't overlap.",
      ),
    ).toBeInTheDocument();
  });

  it("won't compare with a baseline under 50 games", async () => {
    const thin = await cardPage(
      fakeFablazingRepository({
        windows: [WINDOW],
        cards: [cardStat({ baseResultDecks: 40, baseWins: 20 })],
      }),
    );
    expect(
      await thin.findByText(
        "Not enough data to compare with all of Viserai's decks.",
      ),
    ).toBeInTheDocument();
  });

  it("says where the numbers come from and how fresh they are", async () => {
    const panel = await cardPage(
      fakeFablazingRepository({ windows: [WINDOW], cards: [cardStat()] }),
    );
    const note = await panel.findByText(/FaBlazing/);
    expect(note).toHaveTextContent(
      "From FaBlazing's public Talishar games, 1–30 Oct 2026 (latest day 30 Oct 2026).",
    );
  });

  it("holds back numbers below 50 games", async () => {
    const panel = await cardPage(
      fakeFablazingRepository({
        windows: [WINDOW],
        cards: [cardStat({ resultDecks: 49, wins: 30 })],
      }),
    );
    expect(
      await panel.findByText("Not enough games yet (n = 49)"),
    ).toBeInTheDocument();
    expect(panel.queryByText(/won/)).toBeNull();
    expect(panel.queryByRole("table")).toBeNull();
  });

  it("counts a card no one has played as not enough games", async () => {
    const panel = await cardPage(
      fakeFablazingRepository({ windows: [WINDOW] }),
    );
    expect(
      await panel.findByText("Not enough games yet (n = 0)"),
    ).toBeInTheDocument();
  });

  it("keeps Competitive CC apart", async () => {
    const panel = await cardPage(
      fakeFablazingRepository({
        windows: [WINDOW, CCC_WINDOW],
        cards: [
          cardStat(),
          cardStat({
            format: 1,
            startsOn: CCC_WINDOW.startsOn,
            latest: CCC_WINDOW.latest,
            resultDecks: 12,
            wins: 6,
          }),
        ],
      }),
    );
    await panel.findByText("Decks with this card won 50% (±12)");
    await userEvent
      .setup()
      .click(panel.getByRole("button", { name: "Competitive CC" }));
    expect(
      await panel.findByText("Not enough games yet (n = 12)"),
    ).toBeInTheDocument();
    expect(panel.getByText(/5–29 Oct 2026/)).toBeInTheDocument();
  });

  it("says so before the first run", async () => {
    const panel = await cardPage();
    expect(
      await panel.findByText("No real games loaded yet."),
    ).toBeInTheDocument();
  });
});

const HEROES = [
  {
    id: "h1",
    name: "Example Hero",
    classes: [],
    talents: [],
    imageUrl: null,
  },
];

async function matchupsTab(signedIn: boolean, extra: MatchupStat[] = []) {
  const fake = fakeDeckRepository(
    [
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: [{ variantId: "bsl3", quantity: 2, sideboard: false }],
        pitchTargets: {},
        visibility: "public",
      },
    ],
    { heroes: HEROES, userId: "u1" },
  );
  await renderApp({
    path: "/decks/deck-1?tab=matchups",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: signedIn ? { id: "u1", email: "u@test.local" } : undefined,
    }).service,
    decks: fake.repository,
    cards: fakeCardRepository(sampleCards),
    fablazing: fakeFablazingRepository({
      windows: [WINDOW],
      matchups: [
        matchupStat(),
        matchupStat({
          opponent: "mystery_hero",
          heroId: null,
          games: 30,
          wins: 20,
        }),
        ...extra,
      ],
    }),
  });
  if (signedIn)
    await userEvent
      .setup()
      .click(
        screen.getByText("Matchups in real games", { selector: "summary" }),
      );
  return within(
    await screen.findByRole("region", { name: "Viserai in real games" }),
  );
}

describe("Viserai's real matchups, on a deck's Matchups tab", () => {
  it("shows Viserai's win rate against each hero with an interval, and meta share", async () => {
    const real = await matchupsTab(true);
    const cells = (name: string) =>
      within(real.getByRole("row", { name: new RegExp(`^${name}`) }))
        .getAllByRole("cell")
        .map((c) => c.textContent);
    expect(
      await real.findByRole("row", { name: /^Example Hero/ }),
    ).toBeTruthy();
    expect(cells("Example Hero")).toEqual(["34% (±9)", "25%", "100"]);
    // Meta share needs no minimum: it's a share of all 400 games.
    expect(cells("Mystery Hero")).toEqual([
      "Not enough games yet (n = 30)",
      "7.5%",
      "30",
    ]);
    expect(
      real.getByText(/From FaBlazing's public Talishar games/),
    ).toBeInTheDocument();
  });

  it("shows them to anyone who can see the deck, not only its owner", async () => {
    const real = await matchupsTab(false);
    expect(
      await real.findByRole("row", { name: /^Example Hero/ }),
    ).toBeInTheDocument();
  });
});

describe("Viserai's real matchups, a long list", () => {
  it("shows the 12 most-faced heroes, and the rest on request", async () => {
    const extra = Array.from({ length: 12 }, (_, i) =>
      matchupStat({ opponent: `hero_${i + 1}`, heroId: null, games: 20 - i }),
    );
    const real = await matchupsTab(true, extra);
    await real.findByRole("row", { name: /^Example Hero/ });
    // A header row and 12 heroes; the least-faced are held back.
    expect(real.getAllByRole("row")).toHaveLength(13);
    expect(real.queryByRole("row", { name: /^Hero 12/ })).toBeNull();
    await userEvent
      .setup()
      .click(real.getByRole("button", { name: "Show all 14 heroes" }));
    expect(real.getAllByRole("row")).toHaveLength(15);
  });
});

describe("Effect drafts, by real plays", () => {
  it("orders the cards by real plays per Viserai game", async () => {
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository([...sampleCards, TEST_POCUS]),
      auth: fakeAuthService({
        users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      fablazing: fakeFablazingRepository({
        windows: [WINDOW],
        cards: [
          cardStat({
            card: "test_pocus_red",
            variantId: "tp1",
            cardId: TEST_POCUS.id,
            played: 29,
          }),
        ],
      }),
    });
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByLabelText("Order"),
      "Real plays per game",
    );
    const ready = within(
      screen.getByRole("region", { name: "Ready to check" }),
    );
    const first = ready.getAllByRole("article")[0]!;
    expect(first).toHaveAccessibleName("Test Pocus");
    expect(first).toHaveTextContent("0.2 real plays per Viserai game");
    expect(
      screen.getByText(/From FaBlazing's public Talishar games/),
    ).toBeInTheDocument();
  });
});
