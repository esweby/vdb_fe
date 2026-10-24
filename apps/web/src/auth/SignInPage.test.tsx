import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    await user.type(
      screen.getByLabelText("Username or email"),
      "scorer@test.local",
    );
    await user.type(screen.getByLabelText("Password"), "right-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/cards"));
    expect(fake.calls).toEqual(["signIn:scorer@test.local"]);
  });

  it("shows the error when sign-in fails", async () => {
    const fake = fakeAuthService({ users });
    await renderApp({ path: "/sign-in", auth: fake.service });
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Username or email"),
      "scorer@test.local",
    );
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
    await user.type(screen.getByLabelText("Username"), "New_Player");
    await user.type(screen.getByLabelText("Email"), "new@test.local");
    await user.type(screen.getByLabelText("Password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(fake.calls).toEqual(["signUp:new@test.local:New_Player"]),
    );
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
        "An account lets you score cards with the scoring group, and save and share your decks.",
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
    await user.type(await screen.findByLabelText("Username"), "New_Player");
    await user.type(screen.getByLabelText("Email"), "new@test.local");
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
    await user.type(await screen.findByLabelText("Username"), "New_Player");
    await user.type(screen.getByLabelText("Email"), "new@test.local");
    await user.type(screen.getByLabelText("Password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/cards"));
  });

  // Username sign-in (maintainer, 16 Oct 2026): the main way in; email still works.
  it("signs in with a username", async () => {
    const fake = fakeAuthService({
      users: {
        "scorer@test.local": {
          ...users["scorer@test.local"],
          username: "Edd_99",
        },
      },
    });
    const { router } = await renderApp({
      path: "/sign-in",
      auth: fake.service,
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username or email"), "edd_99");
    await user.type(screen.getByLabelText("Password"), "right-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/cards"));
    expect(fake.calls).toEqual(["signIn:edd_99"]);
  });
});

describe("pending sign-in", () => {
  it("allows only one pending request, including repeated form submissions", async () => {
    let reject!: (error: Error) => void;
    const signIn = vi.fn(
      () =>
        new Promise<void>((_resolve, no) => {
          reject = no;
        }),
    );
    const fake = fakeAuthService();
    await renderApp({ path: "/sign-in", auth: { ...fake.service, signIn } });
    const user = userEvent.setup();
    const identifier = screen.getByLabelText("Username or email");
    await user.type(identifier, "player");
    await user.type(screen.getByLabelText("Password"), "password");
    const form = identifier.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create an account instead" }),
    ).toBeDisabled();
    await act(async () => reject(new Error("Try again")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(2);
    await act(async () => reject(new Error("Try again")));
  });
});
