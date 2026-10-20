import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "./test/fakeAuthService.ts";
import { fakeCardRepository } from "./test/fakeCardRepository.ts";
import { fakeDeckRepository } from "./test/fakeDeckRepository.ts";
import { fakeScoreRepository } from "./test/fakeScoreRepository.ts";
import { failsOnce } from "./test/flaky.ts";
import { renderApp } from "./test/renderApp.tsx";

// M8 "every state is designed": a failed load says so in plain words, with a retry, instead of
// "Loading…" for ever.
const scorer = () =>
  fakeAuthService({
    users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
    signedIn: { id: "s1", email: "s@test.local" },
  }).service;
const flakyCards = () => {
  const cards = fakeCardRepository();
  return { listCards: failsOnce(cards.listCards) };
};

async function retries(what: string) {
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(`Couldn't load ${what}.`);
  await userEvent
    .setup()
    .click(within(alert).getByRole("button", { name: "Try again" }));
}

describe("loading and load errors", () => {
  it("shows loading as a status, not bare text", async () => {
    await renderApp({
      path: "/needs-review",
      auth: scorer(),
      cards: { listCards: () => new Promise(() => {}) },
      scores: fakeScoreRepository().repository,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading the cards",
    );
  });

  it("Needs review: cards that fail to load can be retried", async () => {
    await renderApp({
      path: "/needs-review",
      auth: scorer(),
      cards: flakyCards(),
      scores: fakeScoreRepository().repository,
    });
    await retries("the cards");
    expect(
      await screen.findByRole("region", { name: "Runeblade and Shadow" }),
    ).toBeInTheDocument();
  });

  it("Needs review: your reviews failing to load can be retried", async () => {
    const scores = fakeScoreRepository().repository;
    await renderApp({
      path: "/needs-review",
      auth: scorer(),
      scores: {
        ...scores,
        listMyReviewedCardIds: failsOnce(scores.listMyReviewedCardIds),
      },
    });
    await retries("your reviews");
    expect(
      await screen.findByRole("region", { name: "Runeblade and Shadow" }),
    ).toBeInTheDocument();
  });

  it("Core: cards that fail to load can be retried", async () => {
    await renderApp({
      path: "/core",
      auth: scorer(),
      cards: flakyCards(),
      scores: fakeScoreRepository().repository,
    });
    await retries("the cards");
    expect(
      await screen.findByRole("heading", { name: "Build a core" }),
    ).toBeInTheDocument();
  });

  it("Core: scores that fail to load can be retried", async () => {
    const scores = fakeScoreRepository().repository;
    await renderApp({
      path: "/core",
      auth: scorer(),
      scores: {
        ...scores,
        listCommunityScores: failsOnce(scores.listCommunityScores),
      },
    });
    await retries("the scores");
    expect(
      await screen.findByRole("heading", { name: "Build a core" }),
    ).toBeInTheDocument();
  });

  it("a deck that fails to load says so, rather than 'not found', and can be retried", async () => {
    const decks = fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        ownerId: "s1",
        cards: [],
        pitchTargets: {},
      },
    ]).repository;
    await renderApp({
      path: "/decks/deck-1",
      auth: scorer(),
      decks: { ...decks, getDeck: failsOnce(decks.getDeck) },
    });
    await retries("this deck");
    expect(screen.queryByText("Deck not found")).toBeNull();
    expect(
      await screen.findByRole("heading", { name: "Gate tempo" }),
    ).toBeInTheDocument();
  });

  it("a card's scoring view that fails to load can be retried", async () => {
    const scores = fakeScoreRepository().repository;
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: scorer(),
      scores: { ...scores, getCard: failsOnce(scores.getCard) },
    });
    await retries("this card");
    expect(
      await screen.findByRole("heading", { name: "Hocus Pocus" }),
    ).toBeInTheDocument();
  });

  it("your ratings failing to load can be retried, with no raw error left behind", async () => {
    const scores = fakeScoreRepository().repository;
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: scorer(),
      scores: { ...scores, listMyScores: failsOnce(scores.listMyScores) },
    });
    await retries("your ratings");
    expect(
      await screen.findByRole("slider", { name: "Overall" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a deck waits for the cards rather than showing an empty, illegal deck", async () => {
    const decks = fakeDeckRepository([
      {
        id: "deck-1",
        name: "Gate tempo",
        updatedAt: "2026-10-14T10:00:00Z",
        ownerId: "s1",
        cards: [{ variantId: "hp1", quantity: 3, sideboard: false }],
        pitchTargets: {},
      },
    ]).repository;
    await renderApp({
      path: "/decks/deck-1",
      auth: scorer(),
      decks,
      cards: flakyCards(),
    });
    await retries("the cards");
    expect(screen.queryByText(/^0 deck cards/)).toBeNull();
    expect(
      await screen.findByText("3 deck cards · 0 sideboard · 3 in the pool"),
    ).toBeInTheDocument();
  });

  it("shows a deck as loading until the cards are in", async () => {
    await renderApp({
      path: "/decks/deck-1",
      auth: scorer(),
      decks: fakeDeckRepository([
        {
          id: "deck-1",
          name: "Gate tempo",
          updatedAt: "2026-10-14T10:00:00Z",
          ownerId: "s1",
          cards: [{ variantId: "hp1", quantity: 3, sideboard: false }],
          pitchTargets: {},
        },
      ]).repository,
      cards: { listCards: () => new Promise(() => {}) },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading the cards",
    );
    expect(screen.queryByText(/The deck has 0 cards/)).toBeNull();
  });
});
