// Hand-authored attributes, one file per review batch (see docs/attribute-vocabulary.md).
// Everything is unverified until a player has checked it; only then set verified: true.
import type { AuthoredAttributes } from "../map.ts";
import { examples } from "./00-examples.ts";
import { runechantCreators } from "./01-runechant-creators.ts";
import { gateCreators } from "./02-gate-creators.ts";

export const batches: Record<string, AuthoredAttributes> = {
  "00-examples": examples,
  "01-runechant-creators": runechantCreators,
  "02-gate-creators": gateCreators,
};

export function allAuthored(): AuthoredAttributes {
  const merged: AuthoredAttributes = {};
  for (const [batch, entries] of Object.entries(batches)) {
    for (const [name, entry] of Object.entries(entries)) {
      if (name in merged)
        throw new Error(
          `"${name}" is authored in more than one batch (again in ${batch})`,
        );
      merged[name] = entry;
    }
  }
  return merged;
}
