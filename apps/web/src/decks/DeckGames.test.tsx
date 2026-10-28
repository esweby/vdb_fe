// Uploading a Talishar stats CSV onto a deck version (docs/test-loop.md, step 2).
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
): DeckVersion => ({
  id: `version-${number}`,
  deckId: "deck-1",
  number,
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

async function open(versions: DeckVersion[]) {
  const fake = fakeDeckRepository(
    [
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: [],
        pitchTargets: {},
      },
    ],
    { versions },
  );
  await renderApp({
    path: "/decks/deck-1?tab=versions",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fake.repository,
  });
  const user = userEvent.setup();
  const games = async (number: number) => {
    await user.click(
      await screen.findByText(`Version ${number}`, { selector: "summary" }),
    );
    return screen.findByRole("region", { name: `Games on version ${number}` });
  };
  return { fake, user, games };
}

const file = (text: string, name = FILE) =>
  new File([text], name, { type: "text/csv" });

describe("uploading a game onto a version", () => {
  it("parses the export, stores it with a note and lists it", async () => {
    const { fake, user, games } = await open([version(1, exported)]);
    const region = await games(1);
    expect(
      within(region).getByText("No games uploaded yet."),
    ).toBeInTheDocument();
    await user.upload(
      within(region).getByLabelText("Talishar stats CSV"),
      file(csv),
    );
    await user.type(within(region).getByLabelText("Note"), "Kept a slow hand");
    await user.click(
      within(region).getByRole("button", { name: "Upload game" }),
    );

    expect(
      await within(region).findByText(/Lost · went first · 6 turns/),
    ).toBeInTheDocument();
    expect(within(region).getByText(/Kept a slow hand/)).toBeInTheDocument();
    expect(fake.saved).toContain(`game version-1 ${FILE}`);
    const [game] = await fake.repository.listGames("version-1");
    expect(game!.stats.summary.turns).toBe(6);
  });

  it("says when the file isn't a Talishar stats export, and uploads nothing", async () => {
    const { fake, user, games } = await open([version(1, exported)]);
    const region = await games(1);
    await user.upload(
      within(region).getByLabelText("Talishar stats CSV"),
      file("name,score\nme,1\n", "scores.csv"),
    );
    expect(await within(region).findByRole("alert")).toHaveTextContent(
      "That file isn't a Talishar stats export.",
    );
    expect(
      within(region).queryByRole("button", { name: "Upload game" }),
    ).not.toBeInTheDocument();
    expect(fake.saved.filter((s) => s.startsWith("game"))).toEqual([]);
  });

  it("warns when the game's cards aren't in the version, and offers the version that fits", async () => {
    const withoutFirst = exported.slice(1);
    const { fake, user, games } = await open([
      version(2, exported),
      version(1, withoutFirst),
    ]);
    const region = await games(1);
    await user.upload(
      within(region).getByLabelText("Talishar stats CSV"),
      file(csv),
    );

    const warning = await within(region).findByRole("status");
    expect(warning).toHaveTextContent(
      `Version 1 doesn't have: ${exported[0]!.name}`,
    );
    expect(warning).toHaveTextContent("Version 2 has every card in this game.");
    await user.click(
      within(region).getByRole("button", { name: "Upload to version 2" }),
    );
    expect(fake.saved).toContain(`game version-2 ${FILE}`);
    expect(
      within(region).getByText("Uploaded to version 2."),
    ).toBeInTheDocument();
    // Version 2's list, already on the page, shows the game too.
    const other = await games(2);
    expect(
      await within(other).findByText(/Lost · went first · 6 turns/),
    ).toBeInTheDocument();
  });

  it("can still upload onto the chosen version after a warning", async () => {
    const { fake, user, games } = await open([version(1, exported.slice(1))]);
    const region = await games(1);
    await user.upload(
      within(region).getByLabelText("Talishar stats CSV"),
      file(csv),
    );
    expect(await within(region).findByRole("status")).toHaveTextContent(
      "No version has every card in this game.",
    );
    await user.click(
      within(region).getByRole("button", {
        name: "Upload to version 1 anyway",
      }),
    );
    expect(fake.saved).toContain(`game version-1 ${FILE}`);
  });

  it("deletes an uploaded game", async () => {
    const { fake, user, games } = await open([version(1, exported)]);
    const region = await games(1);
    await user.upload(
      within(region).getByLabelText("Talishar stats CSV"),
      file(csv),
    );
    await user.click(
      within(region).getByRole("button", { name: "Upload game" }),
    );
    await user.click(
      await within(region).findByRole("button", { name: /Delete the game/ }),
    );
    expect(
      await within(region).findByText("No games uploaded yet."),
    ).toBeInTheDocument();
    expect(await fake.repository.listGames("version-1")).toEqual([]);
  });
});
