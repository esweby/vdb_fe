import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Deck } from "../decks/deckRepository.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { sampleCommunity } from "../test/sampleCommunity.ts";

// Ranked deck cards in the sample: Become the Shadow Lord (blue, 70), then Hocus Pocus
// red (50), yellow (40) and blue (30).
const scores = () =>
  fakeScoreRepository([], { community: sampleCommunity() }).repository;
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

async function openBuilder(path = "/ranking", decks = [gateTempo()]) {
  const fake = fakeDeckRepository(decks);
  const app = await renderApp({
    path,
    auth: signedIn(),
    scores: scores(),
    decks: fake.repository,
  });
  const user = userEvent.setup();
  await screen.findByRole("table", { name: "Ranked by your priorities" });
  await user.click(screen.getByRole("button", { name: "Build a core" }));
  const panel = screen.getByRole("region", { name: "Build a core" });
  return { ...app, fake, user, panel: within(panel), panelEl: panel };
}

const setTargets = async (
  user: ReturnType<typeof userEvent.setup>,
  panel: ReturnType<typeof within>,
  targets: { red: number; yellow: number; blue: number },
) => {
  for (const [name, n] of [
    ["Red target", targets.red],
    ["Yellow target", targets.yellow],
    ["Blue target", targets.blue],
  ] as const) {
    const input = panel.getByRole("spinbutton", { name });
    await user.clear(input);
    await user.type(input, String(n));
  }
};
const picks = (panel: ReturnType<typeof within>) =>
  panel
    .getAllByRole("listitem")
    .map((li: HTMLElement) => li.getAttribute("aria-label"))
    .filter(Boolean);

describe("core builder", () => {
  it("starts from example pitch targets when there's no deck", async () => {
    const { panel } = await openBuilder();
    expect(panel.getByRole("spinbutton", { name: "Red target" })).toHaveValue(
      18,
    );
    expect(
      panel.getByRole("spinbutton", { name: "Yellow target" }),
    ).toHaveValue(5);
    expect(panel.getByRole("spinbutton", { name: "Blue target" })).toHaveValue(
      22,
    );
  });

  it("starts from the chosen deck's pitch targets", async () => {
    const { panel } = await openBuilder("/ranking?deck=deck-1", [
      gateTempo({ pitchTargets: { 1: 3, 3: 6 } }),
    ]);
    await waitFor(() =>
      expect(
        panel.getByRole("spinbutton", { name: "Blue target" }),
      ).toHaveValue(6),
    );
    expect(panel.getByRole("spinbutton", { name: "Red target" })).toHaveValue(
      3,
    );
  });

  it("fills each pitch to its target from the ranking", async () => {
    const { user, panel } = await openBuilder();
    await setTargets(user, panel, { red: 3, yellow: 0, blue: 6 });
    expect(picks(panel)).toEqual([
      "3 × Hocus Pocus (red)",
      "3 × Become the Shadow Lord",
      "3 × Hocus Pocus (blue)",
    ]);
    expect(panel.getByText("Blue 6 of 6")).toBeInTheDocument();
  });

  it("says how short a pitch is after removing a card", async () => {
    const { user, panel } = await openBuilder();
    await setTargets(user, panel, { red: 0, yellow: 0, blue: 6 });
    await user.click(
      panel.getByRole("button", { name: "Remove Become the Shadow Lord" }),
    );
    expect(picks(panel)).toEqual(["3 × Hocus Pocus (blue)"]);
    expect(panel.getByText("Blue 3 of 6 · 3 short")).toBeInTheDocument();
  });

  it("swaps a card for the next best of the same pitch", async () => {
    const { user, panel } = await openBuilder();
    await setTargets(user, panel, { red: 0, yellow: 0, blue: 3 });
    await user.click(
      panel.getByRole("button", { name: "Swap Become the Shadow Lord" }),
    );
    await user.click(
      panel.getByRole("button", { name: "Use Hocus Pocus (blue) instead" }),
    );
    expect(picks(panel)).toEqual(["3 × Hocus Pocus (blue)"]);
  });

  it("changes copies of a card, which locks it", async () => {
    const { user, panel } = await openBuilder();
    await setTargets(user, panel, { red: 0, yellow: 0, blue: 3 });
    await user.click(
      panel.getByRole("button", { name: "Fewer Become the Shadow Lord" }),
    );
    expect(picks(panel)).toEqual([
      "2 × Become the Shadow Lord",
      "1 × Hocus Pocus (blue)",
    ]);
    expect(
      panel.getByRole("button", { name: "Unlock Become the Shadow Lord" }),
    ).toBeInTheDocument();
  });

  it("takes fewer copies of each card when asked", async () => {
    const { user, panel } = await openBuilder();
    await setTargets(user, panel, { red: 0, yellow: 0, blue: 4 });
    await user.click(
      within(
        panel.getByRole("group", { name: "Copies of each card" }),
      ).getByRole("button", { name: "2" }),
    );
    expect(picks(panel)).toEqual([
      "2 × Become the Shadow Lord",
      "2 × Hocus Pocus (blue)",
    ]);
  });

  it("adds the core to the chosen deck", async () => {
    const { user, panel, fake } = await openBuilder("/ranking?deck=deck-1");
    await setTargets(user, panel, { red: 3, yellow: 0, blue: 0 });
    await user.click(
      await panel.findByRole("button", { name: "Add core to Gate tempo" }),
    );
    expect(fake.saved).toEqual(["set deck-1 hp1 3 main"]);
    expect(await panel.findByRole("status")).toHaveTextContent(
      "Added 3 cards to Gate tempo",
    );
  });

  it("saves the core as a new deck", async () => {
    const { user, panel, fake, router } = await openBuilder();
    await setTargets(user, panel, { red: 3, yellow: 0, blue: 0 });
    await user.type(
      panel.getByRole("textbox", { name: "New deck name" }),
      "Red core",
    );
    await user.click(panel.getByRole("button", { name: "Save as new deck" }));
    await waitFor(() =>
      expect(fake.saved).toEqual(["create Red core", "set deck-2 hp1 3 main"]),
    );
    expect(router.state.location.search).toMatchObject({ deck: "deck-2" });
  });
});
