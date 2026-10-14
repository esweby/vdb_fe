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
    const gate = await screen.findByRole("group", { name: "Gate creation" });
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
      await screen.findByRole("slider", { name: "Runechant creation" }),
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
});
