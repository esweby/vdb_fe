import { describe, expect, it } from "vitest";
import { fabraryId, fabraryImportLink } from "./fabraryLink.ts";

const entry = (name: string, pitch: number | null, quantity = 1) => ({
  card: { name },
  variant: { pitch },
  quantity,
});

const cardsOf = (link: string) =>
  new URL(link).searchParams.get("cards")?.split(",");

describe("fabraryId", () => {
  // From FaBrary's deck import link documentation.
  it("matches FaBrary's documented identifiers", () => {
    expect(fabraryId("Dorinthea Ironsong", null)).toBe("dorinthea-ironsong");
    expect(fabraryId("Fyendal's Spring Tunic", null)).toBe(
      "fyendals-spring-tunic",
    );
    expect(fabraryId("Steelblade Supremacy", 1)).toBe(
      "steelblade-supremacy-red",
    );
    expect(fabraryId("Snatch", 1)).toBe("snatch-red");
  });

  it("names the pitch colour for yellow and blue", () => {
    expect(fabraryId("Arknight Shard", 3)).toBe("arknight-shard-blue");
    expect(fabraryId("Runic Reaping", 2)).toBe("runic-reaping-yellow");
  });

  it("drops commas, other punctuation and accents", () => {
    expect(fabraryId("Viserai, the Forsaken", null)).toBe(
      "viserai-the-forsaken",
    );
    expect(fabraryId("Mauvrion Skies: Ascent", 1)).toBe(
      "mauvrion-skies-ascent-red",
    );
    expect(fabraryId("Señor Fyendal’s", null)).toBe("senor-fyendals");
  });

  it("leaves pitch 0 without a colour", () => {
    expect(fabraryId("Gate to i'Arathael", 0)).toBe("gate-to-iarathael");
  });
});

describe("fabraryImportLink", () => {
  it("opens FaBrary's import tab for Classic Constructed, hero first", () => {
    const link = fabraryImportLink("Viserai, the Forsaken", "My deck", [
      entry("Nebula Blade", null),
    ]);
    const url = new URL(link);
    expect(url.origin + url.pathname).toBe("https://fabrary.net/decks");
    expect(url.searchParams.get("tab")).toBe("import");
    expect(url.searchParams.get("format")).toBe("Classic Constructed");
    expect(url.searchParams.get("name")).toBe("My deck");
    expect(cardsOf(link)).toEqual(["viserai-the-forsaken", "nebula-blade"]);
  });

  it("repeats an identifier once per copy", () => {
    const link = fabraryImportLink("Viserai, the Forsaken", "Deck", [
      entry("Arknight Shard", 3, 3),
      entry("Runic Reaping", 1, 2),
    ]);
    expect(cardsOf(link)).toEqual([
      "viserai-the-forsaken",
      "arknight-shard-blue",
      "arknight-shard-blue",
      "arknight-shard-blue",
      "runic-reaping-red",
      "runic-reaping-red",
    ]);
  });

  it("cuts the name to FaBrary's 50 characters", () => {
    const link = fabraryImportLink("Viserai, the Forsaken", "x".repeat(60), []);
    expect(new URL(link).searchParams.get("name")).toBe("x".repeat(50));
  });
});
