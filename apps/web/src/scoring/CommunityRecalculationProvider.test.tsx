import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { roleLoaded, sessionChanged } from "../auth/authSlice.ts";
import { ServicesProvider, type Services } from "../services.tsx";
import { createStore } from "../store.ts";
import { fakeCardRepository } from "../test/fakeCardRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import {
  CommunityRecalculationProvider,
  useCommunityRecalculation,
} from "./CommunityRecalculationProvider.tsx";
import type { AppRole } from "../auth/authService.ts";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setup(role: AppRole = "scorer") {
  const fake = fakeScoreRepository();
  const store = createStore({ cards: fakeCardRepository() });
  store.dispatch(sessionChanged({ id: "one", email: "one@test.local" }));
  store.dispatch(roleLoaded(role, "one"));
  let captured!: ReturnType<typeof useCommunityRecalculation>;
  function Consumer({ name }: { name: string }) {
    const actions = useCommunityRecalculation();
    captured = actions;
    return (
      <>
        <button onClick={actions.changed}>Change {name}</button>
        <button onClick={actions.flush}>Flush {name}</button>
      </>
    );
  }
  const services = { scores: fake.repository } as Services;
  const tree = (show = true) => (
    <Provider store={store}>
      <ServicesProvider services={services}>
        <CommunityRecalculationProvider>
          {show && (
            <>
              <Consumer name="one" />
              <Consumer name="two" />
            </>
          )}
        </CommunityRecalculationProvider>
      </ServicesProvider>
    </Provider>
  );
  const view = render(tree());
  return { fake, store, view, tree, actions: () => captured };
}

describe("shared community recalculation provider", () => {
  it("shares one resettable countdown across consumers", async () => {
    const { fake } = setup();
    fireEvent.click(screen.getByText("Change one"));
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    fireEvent.click(screen.getByText("Change two"));
    await act(() => vi.advanceTimersByTimeAsync(29_999));
    expect(fake.saved).toEqual([]);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fake.saved).toEqual(["job"]);
  });

  it("does not schedule requests without a scoring role", async () => {
    const { fake } = setup("user");
    fireEvent.click(screen.getByText("Change one"));
    fireEvent.click(screen.getByText("Flush one"));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fake.saved).toEqual([]);
  });

  it("discards pending work and ignores an old save callback after account change", async () => {
    const { fake, store, actions } = setup();
    const old = actions();
    act(() => old.changed());
    act(() => {
      store.dispatch(sessionChanged({ id: "two", email: "two@test.local" }));
      store.dispatch(roleLoaded("scorer", "two"));
    });
    act(() => {
      old.changed();
      old.flush();
    });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fake.saved).toEqual([]);
    act(() => actions().changed());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(fake.saved).toEqual(["job"]);
  });

  it("keeps a refused final flush retry after its route consumer unmounts", async () => {
    const { fake, view, tree } = setup();
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        status: "deferred",
        reason: "running",
        retryAfter: 30,
      })
      .mockResolvedValue({ status: "completed" });
    fake.repository.runCommunityJob = run;
    fireEvent.click(screen.getByText("Change one"));
    fireEvent.click(screen.getByText("Flush one"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    view.rerender(tree(false));
    await act(() => vi.advanceTimersByTimeAsync(31_000));
    expect(run).toHaveBeenCalledTimes(2);
  });
});
