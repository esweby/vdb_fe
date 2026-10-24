import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "u@test.local": { id: "u1", password: "pw", role: "user" as const },
};
const signedIn = (email: "s@test.local" | "u@test.local") =>
  fakeAuthService({ users, signedIn: { id: users[email].id, email } }).service;

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

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
    // 80, shown out of 10.
    expect(within(dialog).getAllByText("8").length).toBeGreaterThan(0);
    expect(
      within(dialog).getAllByText("0 · no score, counts as 0").length,
    ).toBeGreaterThan(0);
    // Pitches are named by colour
    expect(within(dialog).getAllByText("Yellow, Blue").length).toBeGreaterThan(
      0,
    );
  });

  it("records the review immediately and debounces community recalculation", async () => {
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
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm review" }));
    });
    expect(fake.saved).toEqual(["review card-hocus-pocus"]);
    await act(() => vi.advanceTimersByTimeAsync(29_999));
    expect(fake.saved).not.toContain("job");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fake.saved).toEqual(["review card-hocus-pocus", "job"]);
    vi.useRealTimers();
    expect(await screen.findByText(/^Reviewed/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("doesn't run the job for users without a scoring role", async () => {
    const fake = fakeScoreRepository();
    await renderApp({
      path: "/cards/card-hocus-pocus?tab=scoring",
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
      within(screen.getByRole("dialog")).queryAllByText(
        "0 · no score, counts as 0",
      ),
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
        .getAllByText("7 · same as overall")
        .filter((cell) => cell.getAttribute("data-attention") === "true");
    // Floor and ceiling, one line each ("Both sides")
    expect(flagged()).toHaveLength(2);
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

describe("changes affecting community scores", () => {
  it.each([
    { reviewed: false, fails: false, expected: false },
    { reviewed: true, fails: false, expected: true },
    { reviewed: true, fails: true, expected: false },
  ])(
    "schedules only successful edits to reviewed cards: %j",
    async ({ reviewed, fails, expected }) => {
      const fake = fakeScoreRepository([], {
        reviewedAt: reviewed ? "2026-10-14T10:00:00Z" : null,
      });
      if (fails)
        fake.repository.saveScore = async () => {
          throw new Error("offline");
        };
      await renderApp({
        path: "/cards/card-hocus-pocus?tab=scoring",
        auth: signedIn("s@test.local"),
        scores: fake.repository,
      });
      const group = await screen.findByRole("group", { name: "Overall" });
      vi.useFakeTimers();
      await act(async () => {
        fireEvent.click(
          within(group).getByRole("button", { name: "Not relevant" }),
        );
      });
      expect(fake.saved).not.toContain("job");
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(fake.saved.includes("job")).toBe(expected);
      vi.useRealTimers();
    },
  );
});
