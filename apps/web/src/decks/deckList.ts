// A deck list as a player pastes or uploads it, read into lines before any card is matched:
// "3 Name (red)" or "3x Name (red)" per line, no colour for cards without a pitch, a
// "Sideboard" heading before the sideboard. FaBrary's text export (UNVERIFIED: its shape is
// written from memory of it) adds Name/Hero/Format lines, "Arena cards" and "Deck cards"
// headings and a footer. A CSV needs a header row naming the quantity and name columns.
export interface DeckListCard {
  /** Line number in the text, from 1. */
  line: number;
  text: string;
  copies: number;
  name: string;
  pitch: number | null;
  sideboard: boolean;
}

export interface DeckList {
  name: string | null;
  hero: string | null;
  cards: DeckListCard[];
  unreadable: { line: number; text: string }[];
}

const PITCHES: Record<string, number> = { red: 1, yellow: 2, blue: 3 };
const LINE = /^(\d+)\s*x?\s+(.+?)(?:\s*\((red|yellow|blue)\))?$/i;
const FIELD =
  /^(name|hero|format|deck|class(?:es)?|talents?|notes?)\s*:\s*(.*)$/i;
const HEADING =
  /^(main( deck)?|deck( cards)?|arena( cards)?|cards|hero|weapons?|equipment)\s*:?$/i;
const FOOTER = /^(made with\b|see the full deck\b|https?:\/\/)/i;
const SIDEBOARD = /^sideboard\b/i;

export function readDeckList(text: string): DeckList {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  const first = lines.findIndex((l) => l.trim() !== "");
  const csv = first >= 0 ? csvColumns(lines[first]!) : null;
  return csv ? readCsv(lines, first, csv) : readLines(lines);
}

function readLines(lines: string[]): DeckList {
  const list: DeckList = { name: null, hero: null, cards: [], unreadable: [] };
  let sideboard = false;
  for (const [i, raw] of lines.entries()) {
    const text = raw.trim();
    if (text === "" || text.startsWith("#") || FOOTER.test(text)) continue;
    if (SIDEBOARD.test(text)) {
      sideboard = true;
      continue;
    }
    const m = LINE.exec(text);
    if (m) {
      list.cards.push({
        line: i + 1,
        text,
        copies: Number(m[1]),
        name: m[2]!,
        pitch: m[3] ? PITCHES[m[3].toLowerCase()]! : null,
        sideboard,
      });
      continue;
    }
    const field = FIELD.exec(text);
    if (field) {
      const key = field[1]!.toLowerCase();
      const value = field[2]!.trim() || null;
      if (key === "hero") list.hero = value;
      if (key === "name") list.name = value;
      continue;
    }
    if (HEADING.test(text)) continue;
    list.unreadable.push({ line: i + 1, text });
  }
  return list;
}

interface Columns {
  copies: number;
  name: number;
  pitch: number;
  sideboard: number;
}

/** The header row's columns, or null when the first line isn't a CSV header. */
function csvColumns(line: string): Columns | null {
  const cells = csvCells(line).map((c) => c.trim().toLowerCase());
  const find = (...names: string[]) =>
    cells.findIndex((c) => names.includes(c));
  const columns = {
    copies: find("quantity", "qty", "count", "copies"),
    name: find("name", "card", "card name"),
    pitch: find("pitch", "color", "colour"),
    sideboard: find("sideboard", "section", "board"),
  };
  return columns.copies >= 0 && columns.name >= 0 ? columns : null;
}

function readCsv(lines: string[], header: number, columns: Columns): DeckList {
  const list: DeckList = { name: null, hero: null, cards: [], unreadable: [] };
  for (const [i, raw] of lines.entries()) {
    const text = raw.trim();
    if (i <= header || text === "") continue;
    const cells = csvCells(text).map((c) => c.trim());
    const copies = cells[columns.copies] ?? "";
    const name = cells[columns.name] ?? "";
    const colour = (cells[columns.pitch] ?? "").toLowerCase();
    const pitch = colour === "" ? null : (PITCHES[colour] ?? Number(colour));
    if (
      !/^\d+$/.test(copies) ||
      !name ||
      (pitch !== null && ![1, 2, 3].includes(pitch))
    ) {
      list.unreadable.push({ line: i + 1, text });
      continue;
    }
    list.cards.push({
      line: i + 1,
      text,
      copies: Number(copies),
      name,
      pitch,
      sideboard: /^(yes|y|true|1|sideboard|side)$/i.test(
        cells[columns.sideboard] ?? "",
      ),
    });
  }
  return list;
}

/** One CSV row's cells; quoted cells can hold commas and doubled quotes. */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}
