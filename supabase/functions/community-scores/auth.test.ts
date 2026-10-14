// Who may run the community score job: the server, or a signed-in scorer, curator or admin.
import { describe, expect, it } from "vitest";
import { authorizeJobCaller } from "./auth.ts";

const serverKeys = ["server-secret"];
const users: Record<string, string> = {
  "token-scorer": "scorer",
  "token-curator": "curator",
  "token-admin": "admin",
  "token-user": "user",
};
const getUserRole = async (token: string) => users[token] ?? null;

const check = (authorization: string | null) =>
  authorizeJobCaller({ authorization, serverKeys, getUserRole });

describe("authorizeJobCaller", () => {
  it("allows the server (the daily schedule)", async () => {
    expect(await check("Bearer server-secret")).toEqual({
      ok: true,
      caller: "server",
    });
  });

  it.each(["token-scorer", "token-curator", "token-admin"])(
    "allows a signed-in %s",
    async (token) => {
      expect(await check(`Bearer ${token}`)).toEqual({
        ok: true,
        caller: "user",
      });
    },
  );

  it("refuses a signed-in user without a scoring role", async () => {
    expect(await check("Bearer token-user")).toEqual({
      ok: false,
      status: 403,
    });
  });

  it("refuses an unknown or invalid token, including the public anon key", async () => {
    expect(await check("Bearer the-public-anon-key")).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("refuses a request with no token", async () => {
    expect(await check(null)).toEqual({ ok: false, status: 401 });
    expect(await check("Basic abc")).toEqual({ ok: false, status: 401 });
  });

  it("ignores empty server keys", async () => {
    expect(
      await authorizeJobCaller({
        authorization: "Bearer ",
        serverKeys: ["", undefined],
        getUserRole,
      }),
    ).toEqual({ ok: false, status: 401 });
  });
});
