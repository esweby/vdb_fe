// The related-cards picker (README "Synergy graph", community edges): on a card's page, a scorer
// adds "this card helps…" and "is helped by…" links, with an optional note and a "works both
// ways" tick. Their links count once 2 or more scorers agree (docs/synergy-rules.md).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeSynergyRepository } from "../test/fakeSynergyRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const BTSL = "card-become-the-shadow-lord";
const HOCUS = "card-hocus-pocus";
const FATE = "card-fate-foreseen";
const NEBULA = "card-nebula-blade";
const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};
const scorer = () =>
  fakeAuthService({ users, signedIn: { id: "s1", email: "s@test.local" } })
    .service;
const repo = () =>
  fakeSynergyRepository(
    {},
    undefined,
    [],
    [
      { fromCardId: BTSL, toCardId: HOCUS, weight: 0.6, note: "Gate plays it" },
      { fromCardId: NEBULA, toCardId: BTSL, weight: 0.3, note: null },
    ],
  );

async function open(synergy = repo()) {
  await renderApp({
    path: `/cards/${BTSL}?tab=synergy`,
    auth: scorer(),
    synergy: synergy.repository,
  });
  const region = within(
    await screen.findByRole("region", { name: "Related cards" }),
  );
  return { synergy, region, user: userEvent.setup() };
}

const list = (
  region: ReturnType<typeof within>,
  name: "Helps" | "Is helped by",
) =>
  Array.from(
    (region.getByRole("list", { name }) as HTMLElement).querySelectorAll("li"),
    (li) => li.textContent?.replace(/Remove.*$/, "").trim(),
  );

describe("related cards", () => {
  it("isn't shown to visitors who can't score", async () => {
    await renderApp({
      path: `/cards/${BTSL}?tab=synergy`,
      auth: fakeAuthService().service,
    });
    await screen.findByRole("heading", { name: "Become the Shadow Lord" });
    expect(screen.queryByRole("region", { name: "Related cards" })).toBeNull();
  });

  it("lists your links both ways round", async () => {
    const { region } = await open();
    await waitFor(() =>
      expect(list(region, "Helps")).toEqual([
        "Hocus Pocus 0.6 · Gate plays it",
      ]),
    );
    expect(list(region, "Is helped by")).toEqual(["Nebula Blade 0.3"]);
  });

  it("adds a card this one helps, with a weight and a note", async () => {
    const { synergy, region, user } = await open();
    await user.type(
      region.getByRole("combobox", { name: "Card" }),
      "Fate Foreseen",
    );
    const weight = region.getByRole("spinbutton", {
      name: "How much (0 to 1)",
    });
    await user.clear(weight);
    await user.type(weight, "0.7");
    await user.type(
      region.getByRole("textbox", { name: "Note (optional)" }),
      "Blocks for it",
    );
    await user.click(region.getByRole("button", { name: "Add link" }));
    await waitFor(() =>
      expect(synergy.saved).toEqual([`link ${BTSL}→${FATE} 0.7 Blocks for it`]),
    );
    expect(list(region, "Helps")).toContain(
      "Fate Foreseen 0.7 · Blocks for it",
    );
  });

  it("adds a card that helps this one", async () => {
    const { synergy, region, user } = await open();
    await user.selectOptions(
      region.getByRole("combobox", { name: "Direction" }),
      "Is helped by",
    );
    await user.type(
      region.getByRole("combobox", { name: "Card" }),
      "Fate Foreseen",
    );
    await user.click(region.getByRole("button", { name: "Add link" }));
    await waitFor(() =>
      expect(synergy.saved).toEqual([`link ${FATE}→${BTSL} 0.5`]),
    );
  });

  it("saves both directions when it works both ways", async () => {
    const { synergy, region, user } = await open();
    await user.type(
      region.getByRole("combobox", { name: "Card" }),
      "Fate Foreseen",
    );
    await user.click(region.getByRole("checkbox", { name: "Works both ways" }));
    await user.click(region.getByRole("button", { name: "Add link" }));
    await waitFor(() =>
      expect(synergy.saved).toEqual([
        `link ${BTSL}→${FATE} 0.5`,
        `link ${FATE}→${BTSL} 0.5`,
      ]),
    );
  });

  it("only links to a card from the list, and not to itself", async () => {
    const { synergy, region, user } = await open();
    const card = region.getByRole("combobox", { name: "Card" });
    await user.type(card, "Not a card");
    await user.click(region.getByRole("button", { name: "Add link" }));
    expect(region.getByText("Pick a card from the list.")).toBeInTheDocument();
    await user.clear(card);
    await user.type(card, "Become the Shadow Lord");
    await user.click(region.getByRole("button", { name: "Add link" }));
    expect(region.getByText("A card can't help itself.")).toBeInTheDocument();
    expect(synergy.saved).toEqual([]);
  });

  it("removes a link", async () => {
    const { synergy, region, user } = await open();
    await waitFor(() => expect(list(region, "Helps")).toHaveLength(1));
    await user.click(
      region.getByRole("button", { name: "Remove Hocus Pocus" }),
    );
    await waitFor(() =>
      expect(synergy.saved).toEqual([`unlink ${BTSL}→${HOCUS}`]),
    );
    expect(list(region, "Helps")).toEqual([]);
  });
});
