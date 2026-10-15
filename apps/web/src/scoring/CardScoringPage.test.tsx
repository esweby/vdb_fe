import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { fakeCardRepository } from "../test/fakeCardRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const path = "/cards/card-become-the-shadow-lord";
const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};

describe("card page", () => {
  it("shows the card's text and verified attributes in plain English", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
      cards: fakeCardRepository(sampleCards),
    });
    expect(
      await screen.findByRole("heading", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Banish a card from your hand/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Creates 1 Runechant when played, if the banished card is Runeblade.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("asks signed-out visitors to sign in to score", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
    });
    expect(
      await screen.findByRole("link", { name: "Sign in to score this card" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("saves a score as soon as it's set, and clears it", async () => {
    const fake = fakeScoreRepository();
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fake.repository,
    });
    const gate = await screen.findByRole("group", { name: "Ceiling" });
    const user = userEvent.setup();
    await user.click(
      within(gate).getByRole("button", { name: "Not relevant" }),
    );
    await waitFor(() => expect(fake.saved).toEqual(["save 2:card:both=0"]));
    await user.click(within(gate).getByRole("button", { name: "Clear" }));
    await waitFor(() =>
      expect(fake.saved).toEqual(["save 2:card:both=0", "clear 2:card:both"]),
    );
  });

  it("loads my existing scores", async () => {
    const fake = fakeScoreRepository([
      { variantId: null, side: null, dimensionId: 1, score: 80 },
    ]);
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fake.repository,
    });
    expect(
      await screen.findByRole("slider", { name: "Floor" }),
    ).toHaveAttribute("aria-valuetext", "80");
  });

  it("describes each pitch's own attributes", async () => {
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByText("Pitch 1: Creates 1 Runechant when it attacks."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pitch 3: Creates 3 Runechants when it attacks."),
    ).toBeInTheDocument();
  });

  it("shows floor and ceiling on every card, greyed out when the card has no conditions", async () => {
    await renderApp({
      path: "/cards/card-nebula-blade",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository().repository,
    });
    const floor = await screen.findByRole("group", { name: "Floor" });
    expect(within(floor).getByRole("slider")).toBeDisabled();
    expect(
      within(floor).getByText("Same as overall: this card has no conditions."),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Ceiling" })).getByRole(
        "slider",
      ),
    ).toBeDisabled();
    expect(
      within(screen.getByRole("group", { name: "Overall" })).getByRole(
        "slider",
      ),
    ).toBeEnabled();
    expect(
      screen.queryByRole("checkbox", { name: "Rate floor and ceiling too" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Floor and ceiling same as overall",
      }),
    ).not.toBeInTheDocument();
  });

  it("asks floor, ceiling and overall for a card with conditions, and can make floor and ceiling the same as overall", async () => {
    const fake = fakeScoreRepository([
      { variantId: null, side: null, dimensionId: 1, score: 40 },
      { variantId: null, side: null, dimensionId: 2, score: 90 },
      { variantId: null, side: null, dimensionId: 3, score: 70 },
    ]);
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fake.repository,
    });
    for (const name of ["Floor", "Ceiling", "Overall"]) {
      expect(await screen.findByRole("group", { name })).toBeInTheDocument();
    }
    await userEvent.setup().click(
      screen.getByRole("button", {
        name: "Floor and ceiling same as overall",
      }),
    );
    await waitFor(() =>
      expect(fake.saved).toEqual(["clear 1:card:both", "clear 2:card:both"]),
    );
  });

  it("flags an overall outside the floor and ceiling, without rejecting it", async () => {
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository([
        { variantId: null, side: null, dimensionId: 1, score: 50 },
        { variantId: null, side: null, dimensionId: 2, score: 60 },
        { variantId: null, side: null, dimensionId: 3, score: 80 },
      ]).repository,
    });
    expect(
      await screen.findByText(
        "Overall (80) is above the ceiling (60). That's allowed, but check it.",
      ),
    ).toBeInTheDocument();
  });

  it("shows each pitch's cost, power and defense", async () => {
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByText("Pitch 1: cost 0 · power 4 · defense 3"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pitch 3: cost 0 · power 2 · defense 3"),
    ).toBeInTheDocument();
  });

  it("lays the card, its details and scoring side by side", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
    });
    await screen.findByRole("heading", { name: "Become the Shadow Lord" });
    for (const name of ["Card", "Details", "Scores"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("puts overall at the top", async () => {
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository().repository,
    });
    const scoresRegion = await screen.findByRole("region", { name: "Scores" });
    await within(scoresRegion).findByRole("group", { name: "Overall" });
    expect(
      within(scoresRegion)
        .getAllByRole("group")
        .map((g) => g.querySelector("legend")?.textContent)
        .filter(Boolean),
    ).toEqual(["Overall", "Floor", "Ceiling"]);
  });
});
