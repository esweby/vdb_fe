// The occasional synergy question: one link at a time, small and out of the way, on the home
// page and on card pages. Sample cards: Become the Shadow Lord → Hocus Pocus is the only link.
import { screen, waitFor, within } from "@testing-library/react";
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
// The card names are in bold, so the question is matched as a whole paragraph.
const asks = (_: string, el: Element | null) =>
  el?.tagName === "P" && el.textContent === question;

async function open(path = "/", synergy = fakeSynergyRepository()) {
  await renderApp({
    path,
    auth: auth("s@test.local"),
    synergy: synergy.repository,
  });
  const box = await screen.findByRole("complementary", {
    name: "Quick question",
  });
  return { box, synergy, user: userEvent.setup() };
}

describe("the synergy question", () => {
  it("asks a scorer about a link on the home page, with the rules' reasons", async () => {
    const { box } = await open();
    expect(await within(box).findByText(asks)).toBeInTheDocument();
    expect(
      within(box).getByText(
        "Creates a Gate, which plays this blood debt card from banish",
      ),
    ).toBeInTheDocument();
  });

  it("Yes confirms the link for every rule behind it", async () => {
    const { box, synergy, user } = await open();
    await within(box).findByText(asks);
    await user.click(within(box).getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(synergy.saved).toEqual([
        `feedback confirm gate-feeds-gate-target ${BTSL}→${HOCUS}`,
        `feedback confirm hand-banish-feeds-gate-target ${BTSL}→${HOCUS}`,
      ]),
    );
    // Nothing else to ask, so it goes.
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "Quick question" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("No rejects it", async () => {
    const { box, synergy, user } = await open();
    await within(box).findByText(asks);
    await user.click(within(box).getByRole("button", { name: "No" }));
    await waitFor(() =>
      expect(synergy.saved).toContain(
        `feedback reject gate-feeds-gate-target ${BTSL}→${HOCUS}`,
      ),
    );
  });

  it("Not sure and dismiss save nothing", async () => {
    const { box, synergy, user } = await open();
    await within(box).findByText(asks);
    await user.click(within(box).getByRole("button", { name: "Not sure" }));
    expect(
      screen.queryByRole("complementary", { name: "Quick question" }),
    ).not.toBeInTheDocument();
    expect(synergy.saved).toEqual([]);
  });

  it("doesn't ask about a link already answered", async () => {
    const synergy = fakeSynergyRepository({}, undefined, [
      {
        ruleId: "gate-feeds-gate-target",
        fromCardId: BTSL,
        toCardId: HOCUS,
        verdict: "confirm",
        weight: null,
      },
    ]);
    await renderApp({
      path: "/",
      auth: auth("s@test.local"),
      synergy: synergy.repository,
    });
    await screen.findByRole("heading", { name: "Your reviews" });
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole("complementary", { name: "Quick question" }),
    ).not.toBeInTheDocument();
  });

  it("isn't shown to people who don't score", async () => {
    await renderApp({ path: "/", auth: auth("u@test.local") });
    await screen.findByRole("heading", { name: "Viserai Deck Builder" });
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole("complementary", { name: "Quick question" }),
    ).not.toBeInTheDocument();
  });

  it("on a card page, asks about that card's links", async () => {
    const { box } = await open(`/cards/${HOCUS}?tab=synergy`);
    expect(await within(box).findByText(asks)).toBeInTheDocument();
  });

  it("on a card page with no unanswered links, asks nothing", async () => {
    await renderApp({
      path: "/cards/card-nebula-blade?tab=synergy",
      auth: auth("s@test.local"),
    });
    await screen.findByRole("heading", { name: "Nebula Blade" });
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole("complementary", { name: "Quick question" }),
    ).not.toBeInTheDocument();
  });
});
