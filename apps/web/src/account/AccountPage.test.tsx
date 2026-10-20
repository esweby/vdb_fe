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

  // The maintainer, 20 Oct 2026: "Usernames shouldn't be changeable after registration".
  it("shows a username that's set, but doesn't let it change", async () => {
    await renderApp({
      path: "/account",
      auth: fakeAuthService({
        users: {
          "s@test.local": { ...users["s@test.local"], username: "Edd_99" },
        },
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
    });
    expect(await screen.findByText("Edd_99")).toBeInTheDocument();
    expect(screen.getByText(/can't be changed/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Username" })).toBeNull();
  });

  it("lets an account without one choose it, once", async () => {
    await renderApp({ path: "/account", auth: auth() });
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole("textbox", { name: "Username" }),
      "Late_1",
    );
    await user.click(screen.getByRole("button", { name: "Save username" }));
    expect(await screen.findByText("Late_1")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Username" })).toBeNull();
  });
});
