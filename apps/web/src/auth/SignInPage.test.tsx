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
});
