import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDraftReviewRepository } from "../test/fakeDraftReviewRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "a@test.local": { id: "a1", password: "pw", role: "admin" as const },
};
const signedInAs = (id: string, email: string) =>
  fakeAuthService({ users, signedIn: { id, email } }).service;

describe("effect drafts page", () => {
  it("lists each drafted card's rules in plain words, marked unverified", async () => {
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("s1", "s@test.local"),
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    const hocus = within(ready).getByRole("article", { name: "Hocus Pocus" });
    expect(hocus).toHaveTextContent("When this attacks: create 1 Runechant.");
    expect(hocus).toHaveTextContent("Pitch 1, 2, 3");
    expect(hocus).toHaveTextContent("Unverified");
  });

  it("shows cards with verified rules apart, so they aren't checked twice", async () => {
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("s1", "s@test.local"),
    });
    const verified = await screen.findByRole("region", { name: "Verified" });
    expect(
      within(verified).getByRole("article", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("article", { name: "Fate Foreseen" }),
    ).not.toBeInTheDocument();
  });

  it("is linked from the needs review page", async () => {
    await renderApp({
      path: "/needs-review",
      auth: signedInAs("s1", "s@test.local"),
    });
    expect(
      await screen.findByRole("link", { name: "Check effect drafts" }),
    ).toHaveAttribute("href", "/needs-review/effects");
  });

  it("lets an admin accept a draft, which moves the card to reviewed", async () => {
    const reviews = fakeDraftReviewRepository();
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("a1", "a@test.local"),
      draftReviews: reviews.repository,
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    const hocus = within(ready).getByRole("article", { name: "Hocus Pocus" });
    await userEvent.click(
      within(hocus).getByRole("button", { name: "Accept" }),
    );
    const hash = draftQueue(sampleCards).find(
      (e) => e.card.name === "Hocus Pocus",
    )!.drafts[0]!.hash;
    expect(reviews.saved).toEqual([`accepted card-hocus-pocus ${hash}`]);
    const reviewed = await screen.findByRole("region", { name: "Reviewed" });
    expect(
      within(reviewed).getByRole("article", { name: "Hocus Pocus" }),
    ).toHaveTextContent("Accepted");
  });

  it("lets an admin reject a draft with a note, and take a verdict back", async () => {
    const reviews = fakeDraftReviewRepository();
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("a1", "a@test.local"),
      draftReviews: reviews.repository,
    });
    const hocus = await screen.findByRole("article", { name: "Hocus Pocus" });
    await userEvent.type(
      within(hocus).getByRole("textbox", { name: "Note" }),
      "Wrong trigger",
    );
    await userEvent.click(
      within(hocus).getByRole("button", { name: "Reject" }),
    );
    const rejected = await screen.findByRole("article", {
      name: "Hocus Pocus",
    });
    await waitFor(() =>
      expect(rejected).toHaveTextContent("Rejected: Wrong trigger"),
    );
    await userEvent.click(
      within(screen.getByRole("article", { name: "Hocus Pocus" })).getByRole(
        "button",
        { name: "Undo" },
      ),
    );
    expect(reviews.saved[1]).toMatch(/^clear card-hocus-pocus /);
    expect(
      await screen.findByRole("region", { name: "Ready to check" }),
    ).toHaveTextContent("Hocus Pocus");
  });

  it("shows a scorer the verdicts but no buttons", async () => {
    const hash = draftQueue(sampleCards).find(
      (e) => e.card.name === "Hocus Pocus",
    )!.drafts[0]!.hash;
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("s1", "s@test.local"),
      draftReviews: fakeDraftReviewRepository([
        {
          cardId: "card-hocus-pocus",
          draftHash: hash,
          verdict: "accepted",
          note: null,
        },
      ]).repository,
    });
    const reviewed = await screen.findByRole("region", { name: "Reviewed" });
    expect(reviewed).toHaveTextContent("Accepted");
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("says when the facts changed since the last verdict", async () => {
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("s1", "s@test.local"),
      draftReviews: fakeDraftReviewRepository([
        {
          cardId: "card-hocus-pocus",
          draftHash: "00000000",
          verdict: "accepted",
          note: null,
        },
      ]).repository,
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    expect(
      within(ready).getByRole("article", { name: "Hocus Pocus" }),
    ).toHaveTextContent("The card's facts changed since its last verdict.");
  });
});
