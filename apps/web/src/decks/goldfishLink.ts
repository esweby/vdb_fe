// Fixed cards in a goldfish link (phase two step 8: a scenario's failed run opens in goldfish
// on its exact shuffle). base64url JSON, safe for any card name.
import type { FixedCard } from "@esweby/fab-engine";

export function encodeFixed(fixed: readonly FixedCard[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(fixed));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeFixed(text: string): FixedCard[] {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is FixedCard =>
        !!f &&
        typeof f.name === "string" &&
        (f.zone === "hand" || f.zone === "arsenal") &&
        (f.pitch === undefined || typeof f.pitch === "number"),
    );
  } catch {
    return [];
  }
}
