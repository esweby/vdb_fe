import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { sampleCommunity } from "../test/sampleCommunity.ts";

const scores = (over = {}) =>
  fakeScoreRepository([], { community: sampleCommunity(), ...over }).repository;
const ranked = () =>
  within(screen.getByRole("table", { name: "Ranked by your priorities" }));
const rankedNames = () =>
  ranked()
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getByRole("link").textContent);

describe("ranking page", () => {
  it("ranks deck cards by the priorities, leaving out unrated cards and weapons", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    // Equal weights: BSL (60+80)/2=70, HP1 50, HP2 40, HP3 30
    expect(rankedNames()).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus (pitch 1)",
      "Hocus Pocus (pitch 2)",
      "Hocus Pocus (pitch 3)",
    ]);
    expect(ranked().getAllByRole("row")[1]).toHaveTextContent("70");
  });

  it("re-ranks when a priority changes", async () => {
    const { router } = await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const gate = screen.getByRole("slider", { name: "Gate creation" });
    gate.focus();
    await userEvent.setup().keyboard("{Home}");
    await waitFor(() => expect(rankedNames()[0]).toBe("Hocus Pocus (pitch 1)"));
    expect(router.state.location.search).toMatchObject({
      w: ["gateCreation:0"],
    });
  });

  it("marks the top N as the core", async () => {
    await renderApp({
      path: "/ranking?core=2",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const rows = ranked().getAllByRole("row").slice(1);
    expect(within(rows[1]!).getByText("Core")).toBeInTheDocument();
    expect(within(rows[2]!).queryByText("Core")).not.toBeInTheDocument();
  });

  it("pins and excludes cards", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Pin Hocus Pocus (pitch 3)" }),
    );
    expect(rankedNames()[0]).toBe("Hocus Pocus (pitch 3)");
    await user.click(
      screen.getByRole("button", { name: "Exclude Become the Shadow Lord" }),
    );
    expect(rankedNames()).not.toContain("Become the Shadow Lord");
    await user.click(
      screen.getByRole("button", { name: "Restore Become the Shadow Lord" }),
    );
    expect(rankedNames()).toContain("Become the Shadow Lord");
  });

  it("ranks weapons and equipment separately, by slot", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    const weapons = await screen.findByRole("table", { name: "Weapons" });
    expect(
      within(weapons).getByRole("link", { name: "Nebula Blade" }),
    ).toBeInTheDocument();
  });

  it("narrows candidates with the filter sidebar", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    await userEvent
      .setup()
      .click(
        within(
          screen.getByRole("complementary", { name: "Filters" }),
        ).getByRole("button", { name: /^Shadow,/ }),
      );
    expect(rankedNames()).toEqual(["Become the Shadow Lord"]);
  });

  it("offers the mine/community blend only when signed in", async () => {
    await renderApp({
      path: "/ranking",
      auth: fakeAuthService().service,
      scores: scores(),
    });
    await screen.findByRole("table", { name: "Ranked by your priorities" });
    expect(
      screen.queryByRole("slider", { name: /Whose scores/ }),
    ).not.toBeInTheDocument();
  });

  it("uses my reviewed scores when the blend favours mine", async () => {
    const users = {
      "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
    };
    await renderApp({
      path: "/ranking?blend=0",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: scores({
        reviewedCardIds: ["card-hocus-pocus"],
        allMyScores: [
          {
            cardId: "card-hocus-pocus",
            variantId: null,
            side: null,
            dimensionId: 1,
            score: 100,
          },
        ],
      }),
    });
    expect(
      await screen.findByRole("slider", { name: /Whose scores/ }),
    ).toBeInTheDocument();
    // Mine: every Hocus Pocus pitch (100 + 0)/2 = 50 < BSL's community 70
    await waitFor(() =>
      expect(rankedNames()[0]).toBe("Become the Shadow Lord"),
    );
    expect(ranked().getAllByRole("row")[2]).toHaveTextContent("50");
  });
});
