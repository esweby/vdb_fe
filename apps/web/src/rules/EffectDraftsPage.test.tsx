import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDraftReviewRepository } from "../test/fakeDraftReviewRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import {
  fakeCardRepository,
  sampleCards,
  TEST_POCUS,
} from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
  "a@test.local": { id: "a1", password: "pw", role: "admin" as const },
};
/** The sample cards and an unverified one, as Hocus Pocus is now verified. */
const POOL = [...sampleCards, TEST_POCUS];
const signedInAs = (id: string, email: string) =>
  fakeAuthService({ users, signedIn: { id, email } }).service;

describe("effect drafts page", () => {
  it("lists each drafted card's rules in plain words, marked unverified", async () => {
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository(POOL),
      auth: signedInAs("s1", "s@test.local"),
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    const hocus = within(ready).getByRole("article", { name: "Test Pocus" });
    expect(hocus).toHaveTextContent("When this attacks: create 1 Runechant.");
    expect(hocus).toHaveTextContent("Pitch 1, 2, 3");
    expect(hocus).toHaveTextContent("Unverified");
  });

  // The maintainer, 20 Oct 2026: a magnifying glass over the card, to read it in the same window.
  it("enlarges the printed card in place from a magnifying glass", async () => {
    const withImages = POOL.map((c) => ({
      ...c,
      variants: c.variants.map((v) => ({
        ...v,
        imageUrl: `https://img.test/${v.id}.png`,
      })),
    }));
    await renderApp({
      path: "/needs-review/effects",
      auth: signedInAs("s1", "s@test.local"),
      cards: fakeCardRepository(withImages),
    });
    const user = userEvent.setup();
    const hocus = within(
      await screen.findByRole("article", { name: "Test Pocus" }),
    );
    await user.click(hocus.getByRole("button", { name: "Enlarge Test Pocus" }));
    const large = screen.getByRole("dialog", { name: "Test Pocus" });
    expect(within(large).getByRole("img")).toHaveAttribute(
      "src",
      "https://img.test/tp1.png",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // The maintainer, 20 Oct 2026: it wasn't clear what to do, and partly drafted cards looked
  // ready to accept.
  it("says what to do, and keeps the partly drafted cards folded away", async () => {
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository(POOL),
      auth: signedInAs("a1", "a@test.local"),
    });
    const guide = await screen.findByRole("region", { name: "What to do" });
    expect(guide).toHaveTextContent(/Ready to check/);
    expect(guide).toHaveTextContent(/doesn't change the game yet/);
    const partly = screen.getByRole("group", { name: /Partly drafted/ });
    expect(partly).not.toHaveAttribute("open");
  });

  // The maintainer, 20 Oct 2026: Dimenxxional Crossroads was hidden under Partly drafted only for
  // its note. A card whose only leftover is its note is ready, with the note shown to read first.
  it("lists a card whose only leftover is its note as ready, with the note to read first", async () => {
    const noted = {
      ...TEST_POCUS,
      id: "card-noted-pocus",
      name: "Noted Pocus",
      attributes: { ...TEST_POCUS.attributes, notes: "Mind the arcane ping." },
      variants: TEST_POCUS.variants.map((v) => ({
        ...v,
        id: v.id.replace("tp", "np"),
      })),
    };
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository([...POOL, noted]),
      auth: signedInAs("a1", "a@test.local"),
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    const card = within(ready).getByRole("article", { name: "Noted Pocus" });
    expect(card).toHaveTextContent(
      "Read the note first: Mind the arcane ping.",
    );
    expect(within(card).getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  it("shows cards with verified rules apart, so they aren't checked twice", async () => {
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository(POOL),
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
      cards: fakeCardRepository(POOL),
      auth: signedInAs("a1", "a@test.local"),
      draftReviews: reviews.repository,
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    const hocus = within(ready).getByRole("article", { name: "Test Pocus" });
    await userEvent.click(
      within(hocus).getByRole("button", { name: "Accept" }),
    );
    const hash = draftQueue(POOL).find((e) => e.card.name === "Test Pocus")!
      .drafts[0]!.hash;
    expect(reviews.saved).toEqual([`accepted card-test-pocus ${hash}`]);
    const reviewed = await screen.findByRole("region", { name: "Reviewed" });
    expect(
      within(reviewed).getByRole("article", { name: "Test Pocus" }),
    ).toHaveTextContent("Accepted");
  });

  // The maintainer, 20 Oct 2026: reviewed cards fold to the card picture's height, with a
  // chevron to open the rest.
  it("folds reviewed cards, with a chevron to open each", async () => {
    const reviews = fakeDraftReviewRepository();
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository(POOL),
      auth: signedInAs("a1", "a@test.local"),
      draftReviews: reviews.repository,
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    const hocus = within(ready).getByRole("article", { name: "Test Pocus" });
    expect(
      within(hocus).queryByRole("button", { name: /Show all/ }),
    ).toBeNull();
    await userEvent.click(
      within(hocus).getByRole("button", { name: "Accept" }),
    );
    const reviewed = within(
      await screen.findByRole("region", { name: "Reviewed" }),
    ).getByRole("article", { name: "Test Pocus" });
    const chevron = within(reviewed).getByRole("button", {
      name: "Show all of Test Pocus",
    });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(chevron);
    expect(chevron).toHaveAttribute("aria-expanded", "true");
  });

  it("lets an admin reject a draft with a note, and take a verdict back", async () => {
    const reviews = fakeDraftReviewRepository();
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository(POOL),
      auth: signedInAs("a1", "a@test.local"),
      draftReviews: reviews.repository,
    });
    const hocus = await screen.findByRole("article", { name: "Test Pocus" });
    await userEvent.type(
      within(hocus).getByRole("textbox", { name: "Note" }),
      "Wrong trigger",
    );
    await userEvent.click(
      within(hocus).getByRole("button", { name: "Reject" }),
    );
    const rejected = await screen.findByRole("article", {
      name: "Test Pocus",
    });
    await waitFor(() =>
      expect(rejected).toHaveTextContent("Rejected: Wrong trigger"),
    );
    await userEvent.click(
      within(screen.getByRole("article", { name: "Test Pocus" })).getByRole(
        "button",
        { name: "Undo" },
      ),
    );
    expect(reviews.saved[1]).toMatch(/^clear card-test-pocus /);
    expect(
      await screen.findByRole("region", { name: "Ready to check" }),
    ).toHaveTextContent("Test Pocus");
  });

  it("shows a scorer the verdicts but no buttons", async () => {
    const hash = draftQueue(POOL).find((e) => e.card.name === "Test Pocus")!
      .drafts[0]!.hash;
    await renderApp({
      path: "/needs-review/effects",
      cards: fakeCardRepository(POOL),
      auth: signedInAs("s1", "s@test.local"),
      draftReviews: fakeDraftReviewRepository([
        {
          cardId: "card-test-pocus",
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
      cards: fakeCardRepository(POOL),
      auth: signedInAs("s1", "s@test.local"),
      draftReviews: fakeDraftReviewRepository([
        {
          cardId: "card-test-pocus",
          draftHash: "00000000",
          verdict: "accepted",
          note: null,
        },
      ]).repository,
    });
    const ready = await screen.findByRole("region", { name: "Ready to check" });
    expect(
      within(ready).getByRole("article", { name: "Test Pocus" }),
    ).toHaveTextContent("The card's facts changed since its last verdict.");
  });
});
