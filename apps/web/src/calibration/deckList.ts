// A plain deck list for engine calibration (docs/engine-calibration.md): "3 Name (red)" or
// "3x Name (red)" per line, no colour for cards without a pitch. Headings, comments and blank
// lines are skipped; a "Sideboard" heading ends the list, since only the main deck is played.
export interface DeckListEntry {
  copies: number;
  name: string;
  pitch: number | null;
}

const PITCHES: Record<string, number> = { red: 1, yellow: 2, blue: 3 };
const LINE = /^(\d+)\s*x?\s+(.+?)(?:\s*\((red|yellow|blue)\))?$/i;
const HEADING = /:|^(main( deck)?|deck|hero|weapons?|equipment|cards)$/i;

export function parseDeckList(text: string): DeckListEntry[] {
  const entries: DeckListEntry[] = [];
  const lines = text.split("\n");
  for (const [n, raw] of lines.entries()) {
    const line = raw.trim();
    if (/^sideboard\b/i.test(line)) break;
    if (line === "" || line.startsWith("#")) continue;
    const m = LINE.exec(line);
    if (!m) {
      if (HEADING.test(line)) continue;
      throw new Error(`Can't read line ${n + 1} of the deck list: "${line}"`);
    }
    entries.push({
      copies: Number(m[1]),
      name: m[2]!,
      pitch: m[3] ? PITCHES[m[3].toLowerCase()]! : null,
    });
  }
  return entries;
}
