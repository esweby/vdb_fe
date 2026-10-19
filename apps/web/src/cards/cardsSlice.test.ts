import { describe, expect, it } from "vitest";
import { createStore } from "../store.ts";
import { fakeCardRepository, sampleCards } from "../test/fakeCardRepository.ts";
import { loadCards } from "./cardsSlice.ts";

describe("cardsSlice", () => {
  it("loads cards from the repository", async () => {
    const store = createStore({ cards: fakeCardRepository() });
    expect(store.getState().cards.status).toBe("idle");
    await store.dispatch(loadCards());
    expect(store.getState().cards.status).toBe("loaded");
    expect(store.getState().cards.items.length).toBeGreaterThan(0);
  });

  it("records a failure", async () => {
    const store = createStore({
      cards: {
        listCards: async () => {
          throw new Error("offline");
        },
      },
    });
    await store.dispatch(loadCards());
    expect(store.getState().cards).toMatchObject({
      status: "failed",
      error: "offline",
    });
  });

  it("loads only once", async () => {
    let calls = 0;
    const repo = fakeCardRepository();
    const store = createStore({
      cards: { listCards: async () => (calls++, repo.listCards()) },
    });
    await store.dispatch(loadCards());
    await store.dispatch(loadCards());
    expect(calls).toBe(1);
  });

  // Maintainer, 19 Oct 2026: cards opened on the blue version may be affecting scores.
  it("puts each card's red version first, then yellow, then blue, then no pitch", async () => {
    const hocus = sampleCards[0]!;
    const mixed = {
      ...hocus,
      variants: [
        { ...hocus.variants[2]!, id: "blue", pitch: 3 },
        { ...hocus.variants[0]!, id: "none", pitch: null },
        { ...hocus.variants[0]!, id: "red", pitch: 1 },
        { ...hocus.variants[1]!, id: "yellow", pitch: 2 },
      ],
    };
    const store = createStore({ cards: fakeCardRepository([mixed]) });
    await store.dispatch(loadCards());
    expect(store.getState().cards.items[0]!.variants.map((v) => v.id)).toEqual([
      "red",
      "yellow",
      "blue",
      "none",
    ]);
  });
});
