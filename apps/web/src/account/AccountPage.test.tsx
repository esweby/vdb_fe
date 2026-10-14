import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("account page", () => {
  it("shows who you're signed in as and your role", async () => {
    await renderApp({ path: "/account", auth: auth() });
    expect(await screen.findByText("s@test.local")).toBeInTheDocument();
    expect(screen.getByText("Scorer")).toBeInTheDocument();
  });

  it("saves the both-sides-together preference", async () => {
    const fake = fakeScoreRepository();
    await renderApp({
      path: "/account",
      auth: auth(),
      scores: fake.repository,
    });
    const box = await screen.findByRole("checkbox", {
      name: "Score both sides together by default",
    });
    expect(box).toBeChecked();
    await userEvent.setup().click(box);
    await waitFor(() =>
      expect(fake.saved).toContain("preferences scoreSidesTogether=false"),
    );
  });

  it("the card page starts split by side when the preference is off", async () => {
    const fake = fakeScoreRepository([], {
      preferences: { scoreSidesTogether: false },
    });
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: auth(),
      scores: fake.repository,
    });
    expect(
      await screen.findByRole("slider", {
        name: "Overall, Forsaken",
      }),
    ).toBeInTheDocument();
  });
});
