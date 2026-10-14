import { describe, expect, it } from "vitest";
import { fromSearch, toSearch } from "./urlState.ts";

describe("filter URL state", () => {
  it("round-trips includes and excludes", () => {
    const state = {
      type: { action: "include" as const, weapon: "exclude" as const },
      tags: { go: "include" as const },
    };
    const search = toSearch(state);
    expect(search).toEqual({
      inc: ["tags:go", "type:action"],
      exc: ["type:weapon"],
    });
    expect(fromSearch(search)).toEqual(state);
  });

  it("omits empty lists", () => {
    expect(toSearch({})).toEqual({});
  });

  it("tolerates junk", () => {
    expect(
      fromSearch({ inc: ["broken", "type:"], exc: "notalist" as never }),
    ).toEqual({});
  });
});
