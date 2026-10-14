// M0 spike: proves an Edge Function can import shared code from packages/scoring.
// Becomes the community score job in M3.
import { normalise, SCORING_VERSION } from "@vdb/scoring";

Deno.serve(() => {
  return Response.json({ scoringVersion: SCORING_VERSION, normalised: normalise(80) });
});
