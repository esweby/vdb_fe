import { describe, expect, it } from "vitest";
import {
  authReducer,
  roleLoaded,
  selectCanScore,
  selectIsSignedIn,
  selectRole,
  sessionChanged,
  type AuthState,
} from "./authSlice.ts";

const initial = authReducer(undefined, { type: "init" });
const state = (auth: AuthState) => ({ auth });

describe("authSlice", () => {
  it("starts loading, until the first session check", () => {
    expect(initial).toEqual({ status: "loading", user: null, role: null });
  });

  it("signs in on a session, then loads the role", () => {
    const signedIn = authReducer(
      initial,
      sessionChanged({ id: "u1", email: "a@test.local" }),
    );
    expect(signedIn).toEqual({
      status: "signedIn",
      user: { id: "u1", email: "a@test.local" },
      role: null,
    });
    expect(authReducer(signedIn, roleLoaded("scorer")).role).toBe("scorer");
  });

  it("signs out, forgetting the user and role", () => {
    const signedIn = authReducer(
      authReducer(initial, sessionChanged({ id: "u1", email: null })),
      roleLoaded("admin"),
    );
    expect(authReducer(signedIn, sessionChanged(null))).toEqual({
      status: "signedOut",
      user: null,
      role: null,
    });
  });

  it("ignores a role that arrives for a different user", () => {
    const signedIn = authReducer(
      initial,
      sessionChanged({ id: "u2", email: null }),
    );
    expect(authReducer(signedIn, roleLoaded("admin", "u1")).role).toBeNull();
    expect(authReducer(signedIn, roleLoaded("admin", "u2")).role).toBe("admin");
  });

  it.each([
    ["user", false],
    ["scorer", true],
    ["curator", true],
    ["admin", true],
  ] as const)("a %s can score: %s", (role, canScore) => {
    const s = authReducer(
      authReducer(initial, sessionChanged({ id: "u1", email: null })),
      roleLoaded(role),
    );
    expect(selectCanScore(state(s))).toBe(canScore);
    expect(selectRole(state(s))).toBe(role);
    expect(selectIsSignedIn(state(s))).toBe(true);
  });
});
