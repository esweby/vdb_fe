// Synergy rule weights, set by admins (maintainer, 19 Oct 2026; docs/synergy-rules.md "Weights").
import { deriveSynergies, SYNERGY_RULES } from "@vdb/cards";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { fakeSynergyRepository } from "../test/fakeSynergyRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "a@test.local": { id: "a1", password: "pw", role: "admin" as const },
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};
const auth = (email: keyof typeof users) =>
  fakeAuthService({ users, signedIn: { id: users[email].id, email } }).service;

// The row holding a rule's weight field (labelled exactly, as one id can contain another).
const row = async (ruleId: string) =>
  (
    await screen.findByRole("spinbutton", { name: `Weight for ${ruleId}` })
  ).closest("tr") as HTMLElement;

describe("synergy weights page", () => {
  it("is for admins only: anyone else goes home, with no link to it", async () => {
    const { router } = await renderApp({
      path: "/admin/synergy",
      auth: auth("s@test.local"),
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(
      screen.queryByRole("link", { name: "Synergy weights" }),
    ).not.toBeInTheDocument();
  });

  it("lists every rule with its default weight, linked from the navigation for admins", async () => {
    await renderApp({ path: "/", auth: auth("a@test.local") });
    await userEvent
      .setup()
      .click(await screen.findByRole("link", { name: "Synergy weights" }));
    for (const rule of SYNERGY_RULES) {
      const r = await row(rule.id);
      expect(within(r).getByText(rule.description)).toBeInTheDocument();
      expect(within(r).getByRole("spinbutton")).toHaveValue(rule.weight);
    }
  });

  it("shows an admin's weight in place of the default, and the default beside it", async () => {
    const fake = fakeSynergyRepository({ "gate-feeds-gate-target": 0.5 });
    await renderApp({
      path: "/admin/synergy",
      auth: auth("a@test.local"),
      synergy: fake.repository,
    });
    const r = await row("gate-feeds-gate-target");
    await waitFor(() =>
      expect(within(r).getByRole("spinbutton")).toHaveValue(0.5),
    );
    expect(within(r).getByText("Default 0.8")).toBeInTheDocument();
  });

  it("saves a new weight when you leave the field", async () => {
    const fake = fakeSynergyRepository();
    await renderApp({
      path: "/admin/synergy",
      auth: auth("a@test.local"),
      synergy: fake.repository,
    });
    const user = userEvent.setup();
    const input = within(await row("gate-feeds-gate-target")).getByRole(
      "spinbutton",
    );
    await user.clear(input);
    await user.type(input, "0.45");
    await user.tab();
    await waitFor(() =>
      expect(fake.saved).toContain("set gate-feeds-gate-target 0.45"),
    );
  });

  it("rejects a weight outside 0 to 1 without saving it", async () => {
    const fake = fakeSynergyRepository();
    await renderApp({
      path: "/admin/synergy",
      auth: auth("a@test.local"),
      synergy: fake.repository,
    });
    const user = userEvent.setup();
    const r = await row("gate-feeds-gate-target");
    const input = within(r).getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "1.5");
    await user.tab();
    expect(await within(r).findByText("From 0 to 1")).toBeInTheDocument();
    expect(fake.saved).toEqual([]);
  });

  it("a weight of 0 turns the rule off", async () => {
    const fake = fakeSynergyRepository({ "usurp-feeds-usurp-payoff": 0 });
    await renderApp({
      path: "/admin/synergy",
      auth: auth("a@test.local"),
      synergy: fake.repository,
    });
    expect(
      await within(await row("usurp-feeds-usurp-payoff")).findByText("Off"),
    ).toBeInTheDocument();
  });

  it("goes back to the default", async () => {
    const fake = fakeSynergyRepository({ "gate-feeds-gate-target": 0.5 });
    await renderApp({
      path: "/admin/synergy",
      auth: auth("a@test.local"),
      synergy: fake.repository,
    });
    const r = await row("gate-feeds-gate-target");
    await userEvent
      .setup()
      .click(await within(r).findByRole("button", { name: "Use default" }));
    await waitFor(() =>
      expect(fake.saved).toContain("reset gate-feeds-gate-target"),
    );
    await waitFor(() =>
      expect(within(r).getByRole("spinbutton")).toHaveValue(0.8),
    );
  });

  it("shows how many links each rule makes in the card pool", async () => {
    await renderApp({ path: "/admin/synergy", auth: auth("a@test.local") });
    const pool = sampleCards.map((c) => ({
      ...c,
      variantAttributes: c.variants.map((v) => v.attributes),
    }));
    const edges = deriveSynergies(pool);
    const rule = SYNERGY_RULES.find((r) => r.id === "aura-feeds-aura-payoff")!;
    const links = edges.filter((e) => e.reasons.includes(rule.id)).length;
    expect(
      await within(await row(rule.id)).findByText(
        `${links} link${links === 1 ? "" : "s"}`,
      ),
    ).toBeInTheDocument();
  });
});
