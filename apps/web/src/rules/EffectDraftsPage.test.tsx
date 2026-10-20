import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
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
});
