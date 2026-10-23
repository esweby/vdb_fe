# Talishar stats CSV

`parseGameStats(csv)` returns a typed `GameStats` record, or throws a
`TalisharParseError` when it does not recognise the export. It has no database, UI
or card-data dependency.

The supported layout comes from the real single-player export of 22 Oct 2026 in
`test/fixtures`. Summary times become seconds; card names and pitch are separate;
unused cards remain in the record. Statistics and turn values keep their signs,
including `totalLifeSelfLost: -18` and the first turn's `totalValue: -2`.

The parser checks section order, labels, column counts, numeric values and turn
numbering. It accepts LF or CRLF, an optional UTF-8 BOM, and CSV quoting for commas
and quotes in names. Layout changes, new pitch values and files containing an
opponent's stats need real exports and tests before they are supported.

Parsing does not infer card copies, the opponent, hero sides, starting life or life
by turn. It does not reconcile card totals with turn totals or interpret self-loss
as blood debt. Those belong to later analysis, with their evidence labelled.
