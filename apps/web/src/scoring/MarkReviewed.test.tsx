import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "u@test.local": { id: "u1", password: "pw", role: "user" as const },
};
const signedIn = (email: "s@test.local" | "u@test.local") =>
  fakeAuthService({ users, signedIn: { id: users[email].id, email } }).service;

describe("Mark reviewed", () => {
  it("shows the summary before confirming, highlighting blanks that count as 0", async () => {
    const fake = fakeScoreRepository([
      { variantId: "hp1", side: null, dimensionId: 3, score: 80 },
    ]);
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: signedIn("s@test.local"),
      scores: fake.repository,
    });
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Mark reviewed" }));
    const dialog = screen.getByRole("dialog", { name: "Mark reviewed" });
    expect(
      within(dialog).getAllByText("80 (inherited)").length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("0 (blank)").length).toBeGreaterThan(0);
    // Pitches are named by colour
    expect(within(dialog).getAllByText("Red, Forsaken").length).toBeGreaterThan(
      0,
    );
  });

  it("records the review and runs the community score job for scorers", async () => {
    const fake = fakeScoreRepository();
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: signedIn("s@test.local"),
      scores: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Mark reviewed" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm review" }));
    await waitFor(() =>
      expect(fake.saved).toEqual(["review card-hocus-pocus", "job"]),
    );
    expect(await screen.findByText(/^Reviewed/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("doesn't run the job for users without a scoring role", async () => {
    const fake = fakeScoreRepository();
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: signedIn("u@test.local"),
      scores: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Mark reviewed" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm review" }));
    await waitFor(() =>
      expect(fake.saved).toEqual(["review card-hocus-pocus"]),
    );
  });

  it("applies the one-click fix for the blank-pitch trap", async () => {
    const fake = fakeScoreRepository([
      { variantId: "hp1", side: null, dimensionId: 3, score: 80 },
    ]);
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: signedIn("s@test.local"),
      scores: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Mark reviewed" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Overall: Use 80 for the whole card, so blank pitches and sides inherit it",
      }),
    );
    await waitFor(() => expect(fake.saved).toContain("save 3:card:both=80"));
    expect(
      within(screen.getByRole("dialog")).queryAllByText("0 (blank)"),
    ).toHaveLength(
      // Hocus Pocus has no conditions, so only overall is asked and nothing is left blank.
      0,
    );
  });

  it("highlights a blank floor and ceiling on a card with conditions, until confirmed as the same as overall", async () => {
    const fake = fakeScoreRepository([
      { variantId: null, side: null, dimensionId: 3, score: 70 },
    ]);
    await renderApp({
      path: "/cards/card-become-the-shadow-lord",
      auth: signedIn("s@test.local"),
      scores: fake.repository,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Mark reviewed" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Mark reviewed" }),
    );
    const flagged = () =>
      dialog
        .getAllByText("70 (same as overall)")
        .filter((cell) => cell.getAttribute("data-attention") === "true");
    // Floor and ceiling, both sides
    expect(flagged()).toHaveLength(4);
    expect(
      dialog.getByText(
        "Floor and ceiling are blank, so they'll count as the same as overall. This card has conditions: check that's right.",
      ),
    ).toBeInTheDocument();
    await user.click(
      dialog.getByRole("button", { name: "Yes, same as overall" }),
    );
    expect(flagged()).toHaveLength(0);
    expect(
      dialog.queryByRole("button", { name: "Yes, same as overall" }),
    ).not.toBeInTheDocument();
    // Confirming the review isn't blocked either way
    expect(
      dialog.getByRole("button", { name: "Confirm review" }),
    ).toBeEnabled();
  });

  it("shows an existing review", async () => {
    const fake = fakeScoreRepository([], {
      reviewedAt: "2026-10-14T10:00:00Z",
    });
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: signedIn("s@test.local"),
      scores: fake.repository,
    });
    expect(await screen.findByText("Reviewed 14 Oct 2026")).toBeInTheDocument();
  });
});
