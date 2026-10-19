import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { fakeCardRepository } from "../test/fakeCardRepository.ts";
import { fakeScoreRepository } from "../test/fakeScoreRepository.ts";
import { renderApp } from "../test/renderApp.tsx";
import { sampleCommunity } from "../test/sampleCommunity.ts";

const path = "/cards/card-become-the-shadow-lord";
const users = {
  "s@test.local": { id: "s1", password: "pw", role: "scorer" as const },
};

describe("card page", () => {
  it("shows the scoring group's ratings for the card, by side", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository([], { community: sampleCommunity() })
        .repository,
    });
    const group = within(
      await screen.findByRole("region", { name: "Scoring group" }),
    );
    const row = (name: string) =>
      within(group.getByRole("row", { name: new RegExp(`^${name}`) }));
    expect(
      row("Overall")
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["7", "7"]);
    expect(row("Floor").getAllByRole("cell")[0]).toHaveTextContent(/^2$/);
    expect(row("Ceiling").getAllByRole("cell")[0]).toHaveTextContent(/^10$/);
    expect(group.getByText("From 3 ratings")).toBeInTheDocument();
  });

  it("says when the scoring group hasn't rated a card enough yet", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository([], {
        community: sampleCommunity(),
        minRatingCount: 5,
      }).repository,
    });
    const group = within(
      await screen.findByRole("region", { name: "Scoring group" }),
    );
    expect(
      group.getByText("Not enough ratings yet: 3 of the 5 needed."),
    ).toBeInTheDocument();
    expect(group.queryByRole("table")).toBeNull();
  });

  it("enlarges the card's picture from a magnifying glass (small on a phone)", async () => {
    const withImage = sampleCards.map((c) =>
      c.id === "card-become-the-shadow-lord"
        ? {
            ...c,
            variants: c.variants.map((v) => ({
              ...v,
              imageUrl: `https://img/${v.id}.webp`,
            })),
          }
        : c,
    );
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
      cards: fakeCardRepository(withImage),
    });
    const card = within(await screen.findByRole("region", { name: "Card" }));
    await userEvent.setup().click(
      await card.findByRole("button", {
        name: "Enlarge Become the Shadow Lord (blue)",
      }),
    );
    expect(
      within(
        screen.getByRole("dialog", { name: "Become the Shadow Lord (blue)" }),
      ).getByRole("img", { name: "Become the Shadow Lord (blue)" }),
    ).toHaveAttribute("src", "https://img/bsl3.webp");
  });

  it("shows the card's text and verified attributes in plain English", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
      cards: fakeCardRepository(sampleCards),
    });
    expect(
      await screen.findByRole("heading", { name: "Become the Shadow Lord" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Banish a card from your hand/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Creates 1 Runechant when played, if the banished card is Runeblade.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("asks signed-out visitors to sign in to score", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
    });
    expect(
      await screen.findByRole("link", { name: "Sign in to score this card" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("saves a score as soon as it's set, and clears it", async () => {
    const fake = fakeScoreRepository();
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fake.repository,
    });
    const gate = await screen.findByRole("group", { name: "Ceiling" });
    const user = userEvent.setup();
    await user.click(
      within(gate).getByRole("button", { name: "Not relevant" }),
    );
    await waitFor(() => expect(fake.saved).toEqual(["save 2:card:both=0"]));
    await user.click(within(gate).getByRole("button", { name: "Clear" }));
    await waitFor(() =>
      expect(fake.saved).toEqual(["save 2:card:both=0", "clear 2:card:both"]),
    );
  });

  it("loads my existing scores", async () => {
    const fake = fakeScoreRepository([
      { variantId: null, side: null, dimensionId: 1, score: 80 },
    ]);
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fake.repository,
    });
    expect(
      await screen.findByRole("slider", { name: "Floor" }),
    ).toHaveAttribute("aria-valuetext", "8");
  });

  it("shows floor and ceiling on every card, greyed out when the card has no conditions", async () => {
    await renderApp({
      path: "/cards/card-nebula-blade",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository().repository,
    });
    const floor = await screen.findByRole("group", { name: "Floor" });
    expect(within(floor).getByRole("slider")).toBeDisabled();
    expect(
      within(floor).getByText("Same as overall: this card has no conditions."),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Ceiling" })).getByRole(
        "slider",
      ),
    ).toBeDisabled();
    expect(
      within(screen.getByRole("group", { name: "Overall" })).getByRole(
        "slider",
      ),
    ).toBeEnabled();
    expect(
      screen.queryByRole("checkbox", { name: "Rate floor and ceiling too" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Floor and ceiling same as overall",
      }),
    ).not.toBeInTheDocument();
  });

  it("asks floor, ceiling and overall for a card with conditions, and can make floor and ceiling the same as overall", async () => {
    const fake = fakeScoreRepository([
      { variantId: null, side: null, dimensionId: 1, score: 40 },
      { variantId: null, side: null, dimensionId: 2, score: 90 },
      { variantId: null, side: null, dimensionId: 3, score: 70 },
    ]);
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fake.repository,
    });
    for (const name of ["Floor", "Ceiling", "Overall"]) {
      expect(await screen.findByRole("group", { name })).toBeInTheDocument();
    }
    await userEvent.setup().click(
      screen.getByRole("button", {
        name: "Floor and ceiling same as overall",
      }),
    );
    await waitFor(() =>
      expect(fake.saved).toEqual(["clear 1:card:both", "clear 2:card:both"]),
    );
  });

  it("flags an overall outside the floor and ceiling, without rejecting it", async () => {
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository([
        { variantId: null, side: null, dimensionId: 1, score: 50 },
        { variantId: null, side: null, dimensionId: 2, score: 60 },
        { variantId: null, side: null, dimensionId: 3, score: 80 },
      ]).repository,
    });
    expect(
      await screen.findByText(
        "Overall (80) is above the ceiling (60). That's allowed, but check it.",
      ),
    ).toBeInTheDocument();
  });

  it("lays the card, its details and scoring side by side", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
    });
    await screen.findByRole("heading", { name: "Become the Shadow Lord" });
    for (const name of ["Card", "Details", "Scores"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("puts overall at the top", async () => {
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository().repository,
    });
    const scoresRegion = await screen.findByRole("region", { name: "Scores" });
    await within(scoresRegion).findByRole("group", { name: "Overall" });
    expect(
      within(scoresRegion)
        .getAllByRole("group")
        .map((g) => g.querySelector("legend")?.textContent)
        .filter(Boolean),
    ).toEqual(["Overall", "Floor", "Ceiling"]);
  });

  it("lets a scorer rate floor and ceiling anyway on a card without conditions", async () => {
    await renderApp({
      path: "/cards/card-nebula-blade",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository().repository,
    });
    const floor = await screen.findByRole("group", { name: "Floor" });
    expect(within(floor).getByRole("slider")).toBeDisabled();
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: "Rate floor and ceiling anyway" }),
      );
    expect(within(floor).getByRole("slider")).toBeEnabled();
    expect(
      within(screen.getByRole("group", { name: "Ceiling" })).getByRole(
        "slider",
      ),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Rate floor and ceiling anyway" }),
    ).not.toBeInTheDocument();
  });

  it("starts with floor and ceiling enabled when they already have scores", async () => {
    await renderApp({
      path: "/cards/card-nebula-blade",
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository([
        { variantId: null, side: null, dimensionId: 1, score: 40 },
      ]).repository,
    });
    const floor = await screen.findByRole("group", { name: "Floor" });
    await waitFor(() =>
      expect(within(floor).getByRole("slider")).toBeEnabled(),
    );
    expect(within(floor).getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "4",
    );
  });

  it("keeps the rating help behind an info toggle, and counts the ratings set", async () => {
    await renderApp({
      path,
      auth: fakeAuthService({
        users,
        signedIn: { id: "s1", email: "s@test.local" },
      }).service,
      scores: fakeScoreRepository([
        { variantId: null, side: null, dimensionId: 3, score: 70 },
      ]).repository,
    });
    const help = await screen.findByText(/^Floor: none of its conditions/);
    expect(help).not.toBeVisible();
    await userEvent.setup().click(screen.getByText("About these ratings"));
    expect(help).toBeVisible();
    expect(await screen.findByText("1 of 3 rated")).toBeInTheDocument();
  });

  it("shows only the chosen pitch's details, switching with the pitch buttons", async () => {
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: fakeAuthService().service,
    });
    const details = within(
      await screen.findByRole("region", { name: "Details" }),
    );
    expect(
      await details.findByText("Creates 1 Runechant when it attacks."),
    ).toBeInTheDocument();
    expect(details.getByLabelText("Power 4")).toBeInTheDocument();
    expect(details.queryByText(/Pitch 3/)).not.toBeInTheDocument();
    expect(
      details.queryByText("Creates 3 Runechants when it attacks."),
    ).not.toBeInTheDocument();

    const pitch = within(screen.getByRole("group", { name: "Pitch" }));
    expect(pitch.getByRole("button", { name: "Red" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.setup().click(pitch.getByRole("button", { name: "Blue" }));
    expect(
      details.getByText("Creates 3 Runechants when it attacks."),
    ).toBeInTheDocument();
    expect(details.getByLabelText("Power 2")).toBeInTheDocument();
  });

  it("lays the details out like the card: cost, text with keywords in bold, type line, then defense", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
    });
    const details = within(
      await screen.findByRole("region", { name: "Details" }),
    );
    const cost = await details.findByLabelText("Cost 0");
    const keyword = details.getByText("Go again", { selector: "strong" });
    const typeLine = details.getByText("Shadow Runeblade Action");
    const defense = details.getByLabelText("Defense 3");
    const whatItDoes = details.getByRole("heading", { name: "What it does" });
    const inOrder = [cost, keyword, typeLine, defense, whatItDoes];
    for (let i = 1; i < inOrder.length; i++) {
      expect(
        inOrder[i - 1]!.compareDocumentPosition(inOrder[i]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("groups What it does into sections, keywords after the effects", async () => {
    await renderApp({
      path,
      auth: fakeAuthService().service,
      scores: fakeScoreRepository().repository,
    });
    const details = within(
      await screen.findByRole("region", { name: "Details" }),
    );
    const resolves = await details.findByRole("heading", {
      name: "When it resolves",
    });
    const keywords = details.getByRole("heading", { name: "Keywords" });
    expect(
      resolves.compareDocumentPosition(keywords) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(keywords.nextElementSibling as HTMLElement).getByText("Go again."),
    ).toBeInTheDocument();
  });

  // Maintainer, 19 Oct 2026: open on the red version, so scorers don't rate the blue one.
  it("opens on the red version when no pitch is chosen", async () => {
    const [hocus, ...rest] = sampleCards;
    const blueFirst = { ...hocus!, variants: [...hocus!.variants].reverse() };
    await renderApp({
      path: "/cards/card-hocus-pocus",
      auth: fakeAuthService().service,
      cards: fakeCardRepository([blueFirst, ...rest]),
    });
    const pitch = within(await screen.findByRole("group", { name: "Pitch" }));
    expect(pitch.getByRole("button", { name: /Red/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
