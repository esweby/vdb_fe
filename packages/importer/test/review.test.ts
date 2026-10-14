import { describe, expect, it } from "vitest";
import type { DatasetCard } from "../src/classify.ts";
import { toImportCards } from "../src/map.ts";
import { reviewSheet } from "../src/review.ts";
import fixture from "./fixtures/cards.json" with { type: "json" };

const entries = fixture as DatasetCard[];
const cards = toImportCards(entries, {
  "Become the Shadow Lord": {
    verified: false,
    card: {
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["banished_card_is_runeblade"],
        },
      ],
      notes: "Check | escaping.",
    },
  },
  "Arcane Cussing": {
    verified: false,
    variants: {
      1: {
        tokens: [{ token: "runechant", amount: 3, trigger: "on_leave_arena" }],
      },
      2: {
        tokens: [{ token: "runechant", amount: 2, trigger: "on_leave_arena" }],
      },
      3: {
        tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }],
      },
    },
  },
});
const pick = (...names: string[]) =>
  cards.filter((c) => names.includes(c.name));

describe("reviewSheet", () => {
  const sheet = reviewSheet(
    "Runechant creators",
    pick("Become the Shadow Lord", "Arcane Cussing"),
  );

  it("has a title, instructions and a table header", () => {
    expect(sheet).toMatch(/^# Review: Runechant creators\n/);
    expect(sheet).toContain("OK");
    expect(sheet).toContain(
      "| Card | Pitch | Card text | Draft says | Notes |",
    );
  });

  it("puts the plain-English draft next to the card text", () => {
    expect(sheet).toContain(
      "| Become the Shadow Lord | 3 | Banish a card from your hand. If it's Runeblade, create a Runechant token.",
    );
    expect(sheet).toContain(
      "Banishes a card from your hand when played.<br>Creates 1 Runechant when played, if the banished card is Runeblade.",
    );
  });

  it("escapes pipes and flattens line breaks so the table stays intact", () => {
    expect(sheet).toContain("Check \\| escaping.");
    expect(sheet).not.toMatch(/token\.\nGo again/);
  });

  it("gives each pitch its own row when the variants differ", () => {
    expect(sheet).toContain("| Arcane Cussing | 1 |");
    expect(sheet).toContain("| Arcane Cussing | 2 |");
    expect(sheet).toContain("| Arcane Cussing | 3 |");
    expect(sheet).toContain("Creates 3 Runechants when it leaves the arena.");
  });

  it("lists cards in alphabetical order", () => {
    expect(sheet.indexOf("Arcane Cussing")).toBeLessThan(
      sheet.indexOf("Become the Shadow Lord"),
    );
  });
});
