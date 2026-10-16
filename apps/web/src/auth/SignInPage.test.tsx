import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { renderApp } from "../test/renderApp.tsx";

const users = {
  "scorer@test.local": {
    id: "s1",
    password: "right-password",
    role: "scorer" as const,
  },
};

describe("sign-in page", () => {
  it("signs in and goes to the cards page", async () => {
    const fake = fakeAuthService({ users });
    const { router } = await renderApp({
      path: "/sign-in",
      auth: fake.service,
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "scorer@test.local");
    await user.type(screen.getByLabelText("Password"), "right-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/cards"));
    expect(fake.calls).toEqual(["signIn:scorer@test.local"]);
  });

  it("shows the error when sign-in fails", async () => {
    const fake = fakeAuthService({ users });
    await renderApp({ path: "/sign-in", auth: fake.service });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "scorer@test.local");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid login credentials",
    );
  });

  it("can create an account instead", async () => {
    const fake = fakeAuthService();
    await renderApp({ path: "/sign-in", auth: fake.service });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Create an account instead" }),
    );
    await user.type(screen.getByLabelText("Email"), "new@test.local");
    await user.type(screen.getByLabelText("Password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(fake.calls).toEqual(["signUp:new@test.local"]));
  });

  it("opens on Create an account from the home page's link", async () => {
    await renderApp({
      path: "/sign-in?mode=signup",
      auth: fakeAuthService().service,
    });
    expect(
      await screen.findByRole("heading", { name: "Create an account" }),
    ).toBeInTheDocument();
    // What an account is for, and that scoring is by invitation.
    expect(
      screen.getByText(
        "An account saves your decks and lets you share them. Scorers are added by the maintainer.",
      ),
    ).toBeInTheDocument();
  });

  it("says to check your email when the account needs confirming, rather than moving on", async () => {
    const fake = fakeAuthService({ confirmEmail: true });
    const { router } = await renderApp({
      path: "/sign-in?mode=signup",
      auth: fake.service,
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "new@test.local");
    await user.type(screen.getByLabelText("Password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email: we've sent a link to new@test.local. Open it to finish creating your account, then sign in.",
    );
    expect(router.state.location.pathname).toBe("/sign-in");
  });

  it("goes straight to the cards when no confirmation is needed", async () => {
    const { router } = await renderApp({
      path: "/sign-in?mode=signup",
      auth: fakeAuthService().service,
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "new@test.local");
    await user.type(screen.getByLabelText("Password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/cards"));
  });
});
