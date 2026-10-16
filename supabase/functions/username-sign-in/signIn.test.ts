// Signing in with a username (maintainer, 16 Oct 2026). The server looks up the account's email
// and signs in with it, so emails never reach the browser.
import { describe, expect, it } from "vitest";
import { signInWithUsername } from "./signIn.ts";

const accounts: Record<string, { email: string; password: string }> = {
  edd_99: { email: "edd@test.local", password: "right" },
};
const failures: string[] = [];
const deps = {
  ip: "203.0.113.7",
  recentFailures: async (username: string, ip: string) =>
    failures.filter((f) => f === `${username.toLowerCase()}|${ip}`).length,
  recordFailure: async (username: string, ip: string) => {
    failures.push(`${username.toLowerCase()}|${ip}`);
  },
  findEmail: async (username: string) =>
    accounts[username.toLowerCase()]?.email ?? null,
  signIn: async (email: string, password: string) =>
    Object.values(accounts).some(
      (a) => a.email === email && a.password === password,
    )
      ? { access_token: "access", refresh_token: "refresh" }
      : null,
};

describe("signInWithUsername", () => {
  it("signs in with the username's account, ignoring case", async () => {
    expect(
      await signInWithUsername({ username: "EDD_99", password: "right" }, deps),
    ).toEqual({
      ok: true,
      session: { access_token: "access", refresh_token: "refresh" },
    });
  });

  it("gives the same answer for an unknown username and a wrong password", async () => {
    const wrong = {
      ok: false,
      status: 401,
      error: "Wrong username or password.",
    };
    expect(
      await signInWithUsername({ username: "edd_99", password: "nope" }, deps),
    ).toEqual(wrong);
    expect(
      await signInWithUsername({ username: "nobody", password: "right" }, deps),
    ).toEqual(wrong);
  });

  it("refuses a malformed request without looking anything up", async () => {
    let looked = false;
    const watching = {
      ...deps,
      findEmail: async (u: string) => {
        looked = true;
        return deps.findEmail(u);
      },
    };
    for (const body of [
      { username: "no spaces!", password: "right" },
      { username: "edd_99", password: "" },
      { username: 7, password: "right" },
      null,
    ])
      expect(await signInWithUsername(body, watching)).toEqual({
        ok: false,
        status: 400,
        error: "Enter your username and password.",
      });
    expect(looked).toBe(false);
  });

  // Security review, 16 Oct 2026: sign-ins arrive from this function's address, so Supabase's
  // per-address limit can't tell guessers apart. This limits them per username and address.
  it("refuses more guesses after 5 wrong passwords for a username from one address", async () => {
    failures.length = 0;
    for (let i = 0; i < 5; i++)
      await signInWithUsername({ username: "edd_99", password: "guess" }, deps);
    const blocked = {
      ok: false,
      status: 429,
      error: "Too many attempts. Wait 15 minutes, or sign in with your email.",
    };
    // Even the right password, until the window passes.
    expect(
      await signInWithUsername({ username: "EDD_99", password: "right" }, deps),
    ).toEqual(blocked);
    // Someone else, elsewhere, isn't affected.
    expect(
      (
        await signInWithUsername(
          { username: "edd_99", password: "right" },
          { ...deps, ip: "198.51.100.2" },
        )
      ).ok,
    ).toBe(true);
  });
});
