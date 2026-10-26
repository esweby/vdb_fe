import type { Script } from "@vdb/engine/rules";

export function withBanishPolicy(
  choices: Script["choices"],
): Script["choices"] {
  return {
    ...choices,
    neverBanish: [...(choices?.neverBanish ?? []), { name: "Arknight Shard" }],
    banish: [...(choices?.banish ?? []), { name: "Bloodfrenzy Gloomblade" }],
  };
}
