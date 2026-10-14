import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};
const auth = () =>
  fakeAuthService({ users, signedIn: { id: "s1", email: "s@test.local" } })
    .service;
const names = (section: HTMLElement) =>
  within(section)
    .getAllByRole("link")
    .map((l) => l.textContent);

describe("needs review page", () => {
  it("lists unreviewed Runeblade and Shadow cards first, then generics", async () => {
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fakeScoreRepository().repository,
    });
    const classCards = await screen.findByRole("region", {
      name: "Runeblade and Shadow",
    });
    expect(names(classCards)).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
      "Nebula Blade",
    ]);
    expect(names(screen.getByRole("region", { name: "Generic" }))).toEqual([
      "Fate Foreseen",
    ]);
  });

  it("leaves out cards I've reviewed and shows how many are left", async () => {
    const fake = fakeScoreRepository([], {
      reviewedCardIds: ["card-hocus-pocus"],
    });
    await renderApp({
      path: "/needs-review",
      auth: auth(),
      scores: fake.repository,
    });
    const classCards = await screen.findByRole("region", {
      name: "Runeblade and Shadow",
    });
    expect(names(classCards)).toEqual([
      "Become the Shadow Lord",
      "Nebula Blade",
    ]);
    expect(screen.getByText("3 cards left to review")).toBeInTheDocument();
  });
});
