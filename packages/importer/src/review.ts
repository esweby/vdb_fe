// Builds the markdown review sheet a player uses to check drafted attributes.
import { describeAttributes } from "@vdb/cards";
import { variantAttributes, type ImportCard } from "./map.ts";

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " / ");

export function reviewSheet(title: string, cards: ImportCard[]): string {
  const rows: string[] = [];

  for (const card of [...cards].sort((a, b) => a.name.localeCompare(b.name))) {
    const variants = card.variants.map((v) => {
      const attributes = variantAttributes(card, v);
      return {
        pitch: v.pitch === null ? "–" : String(v.pitch),
        text: v.text ?? "",
        draft: describeAttributes({ ...attributes, notes: undefined }).join("<br>"),
        notes: attributes.notes ?? "",
      };
    });

    const allSame = variants.every(
      (v) => v.text === variants[0]!.text && v.draft === variants[0]!.draft && v.notes === variants[0]!.notes,
    );
    const shown = allSame ? [{ ...variants[0]!, pitch: variants.map((v) => v.pitch).join(", ") }] : variants;

    for (const v of shown) {
      rows.push(`| ${cell(card.name)} | ${v.pitch} | ${cell(v.text)} | ${cell(v.draft)} | ${cell(v.notes)} |`);
    }
  }

  return [
    `# Review: ${title}`,
    "",
    "Check each **Draft says** against the **Card text**. Reply in the pull request with `OK` or `<card name>: wrong because…` for each card.",
    "",
    "| Card | Pitch | Card text | Draft says | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}
