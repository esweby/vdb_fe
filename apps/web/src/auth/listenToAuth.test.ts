import { describe, expect, it } from "vitest";
import { createStore } from "../store.ts";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { listenToAuth } from "./listenToAuth.ts";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("listenToAuth", () => {
  it("marks the store signed out when there's no session", async () => {
    const store = createStore();
    listenToAuth(store, fakeAuthService().service);
    await flush();
    expect(store.getState().auth.status).toBe("signedOut");
  });

  it("signs in and loads the user's role", async () => {
    const store = createStore();
    const { service } = fakeAuthService({
      users: { "s@test.local": { id: "s1", password: "pw", role: "scorer" } },
      signedIn: { id: "s1", email: "s@test.local" },
    });
    listenToAuth(store, service);
    await flush();
    expect(store.getState().auth).toEqual({
      status: "signedIn",
      user: { id: "s1", email: "s@test.local" },
      role: "scorer",
    });
  });

  it("follows later sign-outs", async () => {
    const store = createStore();
    const fake = fakeAuthService({ signedIn: { id: "u1", email: null } });
    listenToAuth(store, fake.service);
    await flush();
    fake.emit(null);
    expect(store.getState().auth.status).toBe("signedOut");
  });
});
