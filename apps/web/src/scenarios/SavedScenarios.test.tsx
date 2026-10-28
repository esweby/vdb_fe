// Saved scenarios (README "Saved scenarios", phase two step 6, part 2): save from the builder,
// run them all against a deck with their inputs recorded, share by link, and the library.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScenarioDefinition } from "@esweby/fab-engine";
import { describe, expect, it } from "vitest";
import type { DeckCard } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeScenarioRepository } from "../test/fakeScenarioRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import type { AppRole } from "../auth/authService.ts";

const card = (variantId: string, quantity: number): DeckCard => ({
  variantId,
  quantity,
  sideboard: false,
});
const DECK = [card("hp1", 3), card("bsl3", 2), card("nb", 1)];

const blue = (name: string): ScenarioDefinition => ({
  version: 1,
  name,
  horizon: 0,
  turnModel: "fresh",
  access: ["hand"],
  condition: {
    all: [{ label: "at least 1 blue card", filter: { pitch: 3 }, min: 1 }],
  },
});

async function open(
  scenarios = fakeScenarioRepository(),
  path = "/decks/deck-1?tab=scenarios",
  role: AppRole = "user",
) {
  await renderApp({
    path,
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        cards: DECK,
        pitchTargets: {},
      },
    ]).repository,
    scenarios: scenarios.repository,
  });
  return { user: userEvent.setup(), scenarios };
}
const yours = async () =>
  within(await screen.findByRole("region", { name: "Your scenarios" }));
const builder = () =>
  within(screen.getByRole("region", { name: "Build a scenario" }));
/** Scenarios are run on one side of the tab and created on the other. */
const toCreate = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Add a new scenario" }));
const toRun = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Run" }));

describe("saved scenarios", () => {
  it("saves a built scenario, private by default, and lists it", async () => {
    const { user, scenarios } = await open();
    await toCreate(user);
    const name = builder().getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Blue in hand");
    await user.click(builder().getByRole("button", { name: "Save scenario" }));
    await toRun(user);
    const row = (await yours()).getByRole("row", { name: /Blue in hand/ });
    expect(row).toHaveTextContent("Private");
    expect(scenarios.saved).toEqual(["save Blue in hand private"]);
  });

  it("runs every saved scenario on the deck, recording each result with its inputs", async () => {
    const { user, scenarios } = await open(
      fakeScenarioRepository({
        scenarios: [
          {
            id: "s1",
            userId: "u1",
            definition: blue("Blue"),
            visibility: "private",
          },
        ],
      }),
    );
    const list = await yours();
    await user.click(list.getByRole("button", { name: "Run all" }));
    const row = list.getByRole("row", { name: /Blue/ });
    expect(await within(row).findByText(/^\d+\.\d%$/)).toBeInTheDocument();
    expect(scenarios.results[0]).toMatchObject({
      scenarioId: "s1",
      deckId: "deck-1",
      deckSnapshot: ["bsl3×2", "hp1×3", "nb×1"],
      runs: 10_000,
      engineVersion: expect.any(String),
    });
  });

  it("says when a recorded result's inputs have changed", async () => {
    await open(
      fakeScenarioRepository({
        scenarios: [
          {
            id: "s1",
            userId: "u1",
            definition: blue("Blue"),
            visibility: "private",
          },
        ],
        results: [
          {
            scenarioId: "s1",
            deckId: "deck-1",
            deckSnapshot: ["hp1×4"],
            definition: blue("Blue"),
            definitionVersion: 1,
            seed: 1,
            runs: 10_000,
            engineVersion: "0.1.0",
            outcome: { successRate: 0.25 },
            runAt: "2026-10-18T10:00:00Z",
          },
        ],
      }),
    );
    const row = (await yours()).getByRole("row", { name: /Blue/ });
    expect(row).toHaveTextContent("25.0%");
    expect(row).toHaveTextContent("Changed since: the deck");
  });

  it("edits a saved scenario in the builder, and saves the changes to it", async () => {
    const { user, scenarios } = await open(
      fakeScenarioRepository({
        scenarios: [
          {
            id: "s1",
            userId: "u1",
            definition: blue("Blue"),
            visibility: "private",
          },
        ],
      }),
    );
    await user.click(
      (await yours()).getByRole("button", { name: "Edit Blue" }),
    );
    const name = builder().getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Blue");
    await user.clear(name);
    await user.type(name, "Blue, renamed");
    await user.click(builder().getByRole("button", { name: "Save changes" }));
    expect(scenarios.saved).toEqual(["update s1 Blue, renamed private"]);
  });

  it("shares a scenario by link", async () => {
    const { user } = await open();
    await toCreate(user);
    await user.selectOptions(
      builder().getByLabelText("Who can see it"),
      "link",
    );
    await user.click(builder().getByRole("button", { name: "Save scenario" }));
    expect(
      (
        (await screen.findByRole("textbox", {
          name: "Share link",
        })) as HTMLInputElement
      ).value,
    ).toMatch(/\/scenarios\/scenario-1$/);
    await toRun(user);
    expect(
      (await yours()).getByRole("row", { name: /My scenario/ }),
    ).toHaveTextContent("Anyone with the link");
  });

  it("deletes a saved scenario", async () => {
    const { user, scenarios } = await open(
      fakeScenarioRepository({
        scenarios: [
          {
            id: "s1",
            userId: "u1",
            definition: blue("Blue"),
            visibility: "private",
          },
        ],
      }),
    );
    await user.click(
      (await yours()).getByRole("button", { name: "Delete Blue" }),
    );
    expect((await yours()).queryByRole("row", { name: /Blue/ })).toBeNull();
    expect(scenarios.saved).toEqual(["delete s1"]);
  });

  it("lists the library, runs it with the rest, and copies one to mine", async () => {
    const { user, scenarios } = await open(
      fakeScenarioRepository({
        scenarios: [
          {
            id: "lib",
            userId: "u9",
            definition: blue("Library blue"),
            visibility: "library",
          },
        ],
      }),
    );
    const library = within(
      await screen.findByRole("region", { name: "Library" }),
    );
    await user.click(
      library.getByRole("button", { name: "Copy Library blue to mine" }),
    );
    expect(scenarios.saved).toEqual(["save Library blue private"]);
    expect(
      (await yours()).getByRole("row", { name: /Library blue/ }),
    ).toBeInTheDocument();
  });
});

describe("a shared scenario's page", () => {
  const shared = () =>
    fakeScenarioRepository({
      scenarios: [
        {
          id: "s7",
          userId: "u9",
          definition: blue("Their blue"),
          visibility: "link",
        },
      ],
    });

  it("shows what it checks, and copies it to mine", async () => {
    const { user, scenarios } = await open(shared(), "/scenarios/s7");
    expect(
      await screen.findByRole("heading", { name: "Their blue" }),
    ).toBeInTheDocument();
    expect(screen.getByText("at least 1 blue card")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add to the library" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Copy to my scenarios" }),
    );
    expect(scenarios.saved).toEqual(["save Their blue private"]);
    expect(await screen.findByText(/Copied/)).toBeInTheDocument();
  });

  it("lists its steps", async () => {
    await open(
      fakeScenarioRepository({
        scenarios: [
          {
            id: "s8",
            userId: "u9",
            definition: {
              ...blue("With steps"),
              horizon: 2,
              steps: [{ turn: "each", do: "arsenal", filter: { pitch: 3 } }],
            },
            visibility: "link",
          },
        ],
      }),
      "/scenarios/s8",
    );
    expect(
      await screen.findByText(
        "Each turn, put the lowest-pitch blue card in arsenal",
      ),
    ).toBeInTheDocument();
  });

  it("lets a curator add it to the library", async () => {
    const { user, scenarios } = await open(
      shared(),
      "/scenarios/s7",
      "curator",
    );
    await user.click(
      await screen.findByRole("button", { name: "Add to the library" }),
    );
    expect(scenarios.saved).toEqual(["library s7 true"]);
  });

  it("says when a scenario isn't shared", async () => {
    await open(shared(), "/scenarios/nope");
    expect(
      await screen.findByText("This scenario isn't shared, or doesn't exist."),
    ).toBeInTheDocument();
  });
});
