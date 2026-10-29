// The Results tab: Talishar stats CSVs uploaded onto the deck, each optionally tied to a
// version (docs/test-loop.md, step 2; the maintainer, 28 Oct 2026).
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { parseGameStats } from "@vdb/talishar";
import csv from "../../../../packages/talishar/test/fixtures/game-stats-2026-10-22T14-46-08.csv?raw";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { DeckVersion } from "./deckRepository.ts";

const FILE = "game-stats-2026-10-22T14-46-08.csv";

/** Every card the real export lists, as a version's main deck. */
const exported = parseGameStats(csv).cardPlays.map((card) => ({
  variantId: `${card.name}-${card.pitch}`,
  quantity: 3,
  sideboard: false,
  externalId: `${card.name}-${card.pitch}`,
  name: card.name,
  pitch: card.pitch,
  type: "action",
  subtypes: [],
}));

const version = (
  number: number,
  cards: DeckVersion["snapshot"]["cards"],
  name: string | null = null,
): DeckVersion => ({
  id: `version-${number}`,
  deckId: "deck-1",
  number,
  name,
  createdAt: `2026-10-2${number}T12:00:00Z`,
  fabraryUrl: null,
  snapshot: {
    schemaVersion: 1,
    name: "Gate tempo",
    hero: "Viserai, the Forsaken",
    format: "Classic Constructed",
    pitchTargets: {},
    cards,
    loadouts: [],
  },
});

async function open(versions: DeckVersion[], signedIn = "u1") {
  const fake = fakeDeckRepository(
    [
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: [],
        pitchTargets: {},
        visibility: "public",
      },
    ],
    { versions },
  );
  await renderApp({
    path: "/decks/deck-1?tab=results",
    auth: fakeAuthService({
      users: {
        "u@test.local": { id: "u1", password: "pw", role: "user" },
        "o@test.local": { id: "u2", password: "pw", role: "user" },
      },
      signedIn: { id: signedIn, email: "u@test.local" },
    }).service,
    decks: fake.repository,
  });
  return { fake, user: userEvent.setup() };
}

const file = (text: string, name = FILE) =>
  new File([text], name, { type: "text/csv" });

async function choose(user: ReturnType<typeof userEvent.setup>, text = csv) {
  const upload = await screen.findByRole("region", { name: "Upload a game" });
  await user.upload(
    within(upload).getByLabelText("Talishar stats CSV"),
    file(text),
  );
  return upload;
}

describe("the Results tab", () => {
  it("is only the owner's", async () => {
    await open([version(1, exported)], "u2");
    await screen.findByRole("tab", { name: "Cards" });
    expect(
      screen.queryByRole("tab", { name: "Results" }),
    ).not.toBeInTheDocument();
  });

  it("uploads a game onto the version that has all its cards, chosen for you", async () => {
    const { fake, user } = await open([
      version(2, exported.slice(1), "Levia tech"),
      version(1, exported),
    ]);
    expect(
      await screen.findByText(/^No games uploaded yet\./),
    ).toBeInTheDocument();
    const upload = await choose(user);
    // The file is read before uploading, so you can see which game it is.
    expect(within(upload).getByText(FILE)).toBeInTheDocument();
    expect(within(upload).getByText("Lost")).toBeInTheDocument();
    expect(
      within(upload).getByText("Went first · 6 turns"),
    ).toBeInTheDocument();
    expect(within(upload).getByLabelText("Version")).toHaveDisplayValue(
      "Version 1",
    );
    await user.type(within(upload).getByLabelText("Note"), "Kept a slow hand");
    await user.click(
      within(upload).getByRole("button", { name: "Upload game" }),
    );

    const table = await screen.findByRole("table", { name: "Games" });
    const [, row] = within(table).getAllByRole("row");
    expect(
      within(row!)
        .getAllByRole("cell")
        .slice(0, 7)
        .map((cell) => cell.textContent),
    ).toEqual(["Lost", "First", "6", "49", "27", "−18", "Kept a slow hand"]);
    expect(fake.saved).toContain(`game deck-1 version-1 ${FILE}`);
  });

  it("sums up the record: played, won, win rate, and by who went first", async () => {
    const { user } = await open([version(1, exported)]);
    for (const text of [csv, csv.replace("Result,Loser", "Result,Winner")]) {
      await choose(user, text);
      await user.click(screen.getByRole("button", { name: "Upload game" }));
      await screen.findByText("Game uploaded.");
    }
    const record = await screen.findByRole("region", { name: "Record" });
    expect(within(record).getByText("Played").nextSibling).toHaveTextContent(
      "2",
    );
    expect(within(record).getByText("Won").nextSibling).toHaveTextContent("1");
    expect(within(record).getByText("Win rate").nextSibling).toHaveTextContent(
      "50%",
    );
    expect(
      within(record).getByText("Going first").nextSibling,
    ).toHaveTextContent("1 of 2");
    expect(
      within(record).getByText("Going second").nextSibling,
    ).toHaveTextContent("–");
  });

  it("names the cards a chosen version doesn't have, and still uploads", async () => {
    const { fake, user } = await open([
      version(2, exported.slice(1), "Levia tech"),
      version(1, exported),
    ]);
    const upload = await choose(user);
    await user.selectOptions(
      within(upload).getByLabelText("Version"),
      "Version 2 · Levia tech",
    );
    expect(within(upload).getByRole("status")).toHaveTextContent(
      `Version 2 doesn't have: ${exported[0]!.name}`,
    );
    await user.click(
      within(upload).getByRole("button", { name: "Upload game" }),
    );
    expect(fake.saved).toContain(`game deck-1 version-2 ${FILE}`);
  });

  it("uploads with no version when the deck has none", async () => {
    const { fake, user } = await open([]);
    const upload = await choose(user);
    expect(within(upload).getByLabelText("Version")).toHaveDisplayValue(
      "No version",
    );
    await user.click(
      within(upload).getByRole("button", { name: "Upload game" }),
    );
    expect(fake.saved).toContain(`game deck-1 none ${FILE}`);
  });

  it("says when the file isn't a Talishar stats export, and uploads nothing", async () => {
    const { fake, user } = await open([version(1, exported)]);
    const upload = await choose(user, "name,score\nme,1\n");
    expect(await within(upload).findByRole("alert")).toHaveTextContent(
      "That file isn't a Talishar stats export.",
    );
    expect(
      within(upload).queryByRole("button", { name: "Upload game" }),
    ).not.toBeInTheDocument();
    expect(fake.saved.filter((s) => s.startsWith("game"))).toEqual([]);
  });

  it("moves a game to another version, or to none", async () => {
    const { fake, user } = await open([
      version(2, exported, "Levia tech"),
      version(1, exported),
    ]);
    await choose(user);
    await user.click(screen.getByRole("button", { name: "Upload game" }));
    const games = await screen.findByRole("table", { name: "Games" });
    const select = await within(games).findByLabelText(
      /^Version for the game uploaded/,
    );
    expect(select).toHaveDisplayValue("Version 2 · Levia tech");
    await user.selectOptions(select, "Version 1");
    expect(fake.saved).toContain("game version game-1 version-1");
    await user.selectOptions(select, "No version");
    expect(fake.saved).toContain("game version game-1 none");
  });

  it("deletes a game", async () => {
    const { fake, user } = await open([version(1, exported)]);
    await choose(user);
    await user.click(screen.getByRole("button", { name: "Upload game" }));
    await user.click(
      await screen.findByRole("button", { name: /^Delete the game uploaded/ }),
    );
    expect(
      await screen.findByText(/^No games uploaded yet\./),
    ).toBeInTheDocument();
    expect(await fake.repository.listGames("deck-1")).toEqual([]);
  });
});
