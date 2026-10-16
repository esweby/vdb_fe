import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

// Quick review (maintainer, 16 Oct 2026): one keystroke per card. 1-9 and 0 score 1 to 10
// (saved as 10 to 100). A card with conditions asks Floor and Ceiling too; Enter means "same
// as overall". Each card is marked reviewed as soon as it's rated.
const auth = () =>
  fakeAuthService({
    users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
    signedIn: { id: "s1", email: "s@test.local" },
  }).service;

async function open(scores = fakeScoreRepository()) {
  await renderApp({
    path: "/needs-review/quick",
    auth: auth(),
    scores: scores.repository,
  });
  const user = userEvent.setup();
  const review = within(
    await screen.findByRole("region", { name: "Quick review" }),
  );
  return { user, review, saved: scores.saved };
}

const current = () => screen.getByRole("heading", { level: 2 }).textContent;

describe("quick review", () => {
  it("is offered from Needs review", async () => {
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository().repository,
    });
    expect(
      await screen.findByRole("link", { name: "Quick review" }),
    ).toHaveAttribute("href", "/needs-review/quick");
  });

  it("rates a card with conditions in three keys: overall, floor, then Enter for same as overall", async () => {
    const { user, review, saved } = await open();
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    expect(review.getByText("Overall")).toBeInTheDocument();
    await user.keyboard("7");
    expect(review.getByText("Floor")).toBeInTheDocument();
    await user.keyboard("5");
    expect(review.getByText("Ceiling")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(current()).toBe("Hocus Pocus"));
    expect(saved).toEqual([
      "save 3:card:both=70",
      "save 1:card:both=50",
      "review card-become-the-shadow-lord",
    ]);
  });

  it("rates a card without conditions in one key, 0 meaning 10", async () => {
    const { user, saved } = await open();
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    await user.keyboard("8{Enter}{Enter}");
    await waitFor(() => expect(current()).toBe("Hocus Pocus"));
    await user.keyboard("0");
    await waitFor(() => expect(current()).toBe("Nebula Blade"));
    expect(saved.slice(-2)).toEqual([
      "save 3:card:both=100",
      "review card-hocus-pocus",
    ]);
  });

  it("rates by tapping a score too", async () => {
    const { user, review, saved } = await open();
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    await user.keyboard("6{Enter}{Enter}");
    await waitFor(() => expect(current()).toBe("Hocus Pocus"));
    await user.click(review.getByRole("button", { name: "Score 4" }));
    await waitFor(() => expect(current()).toBe("Nebula Blade"));
    expect(saved).toContain("save 3:card:both=40");
  });

  it("undoes the last card with Backspace, back to its first rating", async () => {
    const { user, review, saved } = await open();
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    await user.keyboard("6{Enter}{Enter}");
    await waitFor(() => expect(current()).toBe("Hocus Pocus"));
    expect(
      review.getByText(/Rated Become the Shadow Lord 6/),
    ).toBeInTheDocument();
    await user.keyboard("{Backspace}");
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    expect(review.getByText("Overall")).toBeInTheDocument();
    expect(saved.slice(-2)).toEqual([
      "clear 3:card:both",
      "unreview card-become-the-shadow-lord",
    ]);
  });

  it("skips a card with S, saving nothing", async () => {
    const { user, saved } = await open();
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    await user.keyboard("s");
    await waitFor(() => expect(current()).toBe("Hocus Pocus"));
    expect(saved).toEqual([]);
  });

  it("shows progress, and says when the list is done, updating community scores", async () => {
    const { user, review, saved } = await open();
    await waitFor(() => expect(current()).toBe("Become the Shadow Lord"));
    expect(review.getByText("0 rated · 4 to go")).toBeInTheDocument();
    await user.keyboard("5{Enter}{Enter}");
    await waitFor(() => expect(current()).toBe("Hocus Pocus"));
    expect(review.getByText("1 rated · 3 to go")).toBeInTheDocument();
    await user.keyboard("5");
    await waitFor(() => expect(current()).toBe("Nebula Blade"));
    await user.keyboard("5");
    await waitFor(() => expect(current()).toBe("Fate Foreseen"));
    await user.keyboard("5");
    expect(
      await review.findByText("All done: 4 cards rated."),
    ).toBeInTheDocument();
    expect(saved).toContain("job");
  });
});
