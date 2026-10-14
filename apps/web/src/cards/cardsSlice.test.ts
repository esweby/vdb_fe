import { describe, expect, it } from "vitest";
import { createStore } from "../store.ts";
import { fakeCardRepository } from "../test/fakeCardRepository.ts";
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
});
