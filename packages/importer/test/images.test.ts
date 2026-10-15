// Which printing's image a variant shows (docs/phase-one.md backlog: standard foiling,
// normal art, latest printing).
import { describe, expect, it } from "vitest";
import { pickImageUrl } from "../src/map.ts";

const printing = (over: Record<string, unknown>) => ({
  foiling: "S",
  art_variations: [],
  image_url: "https://img/x.webp",
  ...over,
});

describe("pickImageUrl", () => {
  it("prefers the latest standard printing with normal art", () => {
    expect(
      pickImageUrl([
        printing({ image_url: "https://img/old.webp" }),
        printing({ image_url: "https://img/foil.webp", foiling: "R" }),
        printing({ image_url: "https://img/ea.webp", art_variations: ["EA"] }),
        printing({ image_url: "https://img/new.webp" }),
      ]),
    ).toBe("https://img/new.webp");
  });

  it("falls back to any printing with an image", () => {
    expect(
      pickImageUrl([
        printing({ image_url: "https://img/foil.webp", foiling: "C" }),
      ]),
    ).toBe("https://img/foil.webp");
  });

  it("is null when no printing has an image", () => {
    expect(pickImageUrl([])).toBeNull();
    expect(pickImageUrl(undefined)).toBeNull();
    expect(pickImageUrl([printing({ image_url: "" })])).toBeNull();
  });
});
