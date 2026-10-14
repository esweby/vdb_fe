// Hand-authored attributes, one file per review batch (see docs/attribute-vocabulary.md).
// Everything is unverified until a player has checked it; only then set verified: true.
import type { AuthoredAttributes } from "../map.ts";
import { examples } from "./00-examples.ts";
import { runechantCreators } from "./01-runechant-creators.ts";
import { gateCreators } from "./02-gate-creators.ts";
import { bloodDebtAndBanish } from "./03-blood-debt-and-banish.ts";
import { weaponsAndEquipment } from "./04-weapons-and-equipment.ts";
import { remaining } from "./05-remaining.ts";

export const batches: Record<string, AuthoredAttributes> = {
  "00-examples": examples,
  "01-runechant-creators": runechantCreators,
  "02-gate-creators": gateCreators,
  "03-blood-debt-and-banish": bloodDebtAndBanish,
  "04-weapons-and-equipment": weaponsAndEquipment,
  "05-remaining": remaining,
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
