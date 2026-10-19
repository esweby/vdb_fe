// The confirm-suggestions queue: scorers go through the links the rules propose, one at a time,
// from the keyboard like quick review. Sample cards: Become the Shadow Lord → Hocus Pocus is the
// only derived link (a Gate maker and a hand banisher helping a Gate target).
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeSynergyRepository } from "../test/fakeSynergyRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "u@test.local": { id: "u1", password: "pw", role: "user" as const },
};
const auth = (email: keyof typeof users) =>
  fakeAuthService({ users, signedIn: { id: users[email].id, email } }).service;
const BTSL = "card-become-the-shadow-lord";
const HOCUS = "card-hocus-pocus";
const question = "Does Become the Shadow Lord help Hocus Pocus?";

async function open(synergy = fakeSynergyRepository()) {
  const app = await renderApp({
    path: "/needs-review/synergies",
    auth: auth("s@test.local"),
    synergy: synergy.repository,
  });
  return { ...app, synergy, user: userEvent.setup() };
}

describe("confirm synergies", () => {
  it("is for scorers: anyone else goes home", async () => {
    const { router } = await renderApp({
      path: "/needs-review/synergies",
      auth: auth("u@test.local"),
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("is linked from Needs review", async () => {
    await renderApp({ path: "/needs-review", auth: auth("s@test.local") });
    expect(
      await screen.findByRole("link", { name: "Confirm synergies" }),
    ).toHaveAttribute("href", "/needs-review/synergies");
  });

  it("asks about one link at a time, with the rules' reasons and weight", async () => {
    await open();
    expect(
      await screen.findByRole("heading", { name: question }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Creates a Gate, which plays this blood debt card from banish",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Rule weight 0.8")).toBeInTheDocument();
    expect(screen.getByText("1 link left")).toBeInTheDocument();
  });

  it("Y confirms the link for every rule behind it", async () => {
    const { synergy, user } = await open();
    await screen.findByRole("heading", { name: question });
    await user.keyboard("y");
    await waitFor(() =>
      expect(synergy.saved).toEqual([
        `feedback confirm gate-feeds-gate-target ${BTSL}→${HOCUS}`,
        `feedback confirm hand-banish-feeds-gate-target ${BTSL}→${HOCUS}`,
      ]),
    );
    expect(
      await screen.findByText("You've answered every suggestion."),
    ).toBeInTheDocument();
  });

  it("N rejects it", async () => {
    const { synergy, user } = await open();
    await screen.findByRole("heading", { name: question });
    await user.keyboard("n");
    await waitFor(() =>
      expect(synergy.saved).toContain(
        `feedback reject gate-feeds-gate-target ${BTSL}→${HOCUS}`,
      ),
    );
  });

  it("a number reweights it: 1 to 9 for 0.1 to 0.9, 0 for 1", async () => {
    const { synergy, user } = await open();
    await screen.findByRole("heading", { name: question });
    await user.keyboard("4");
    await waitFor(() =>
      expect(synergy.saved).toContain(
        `feedback reweight 0.4 gate-feeds-gate-target ${BTSL}→${HOCUS}`,
      ),
    );
  });

  it("the buttons do the same as the keys", async () => {
    const { synergy, user } = await open();
    await screen.findByRole("heading", { name: question });
    await user.click(screen.getByRole("button", { name: /^No/ }));
    await waitFor(() =>
      expect(synergy.saved).toContain(
        `feedback reject gate-feeds-gate-target ${BTSL}→${HOCUS}`,
      ),
    );
  });

  it("S skips without saving anything", async () => {
    const { synergy, user } = await open();
    await screen.findByRole("heading", { name: question });
    await user.keyboard("s");
    expect(
      await screen.findByText("You've answered every suggestion."),
    ).toBeInTheDocument();
    expect(synergy.saved).toEqual([]);
  });

  it("Backspace takes the last answer back", async () => {
    const { synergy, user } = await open();
    await screen.findByRole("heading", { name: question });
    await user.keyboard("y");
    await screen.findByText("You've answered every suggestion.");
    await user.keyboard("{Backspace}");
    expect(
      await screen.findByRole("heading", { name: question }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(synergy.saved).toContain(`clear feedback ${BTSL}→${HOCUS}`),
    );
  });

  it("leaves out links you've already answered", async () => {
    await open(
      fakeSynergyRepository({}, undefined, [
        {
          ruleId: "gate-feeds-gate-target",
          fromCardId: BTSL,
          toCardId: HOCUS,
          verdict: "confirm",
          weight: null,
        },
      ]),
    );
    expect(
      await screen.findByText("You've answered every suggestion."),
    ).toBeInTheDocument();
  });
});
