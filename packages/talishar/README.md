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

## Single-game report

```ts
import { createGameReport, parseGameStats } from "@vdb/talishar";

const report = createGameReport(parseGameStats(csv), {
  startingLife: 40,
  startingLifeSource: "Viserai: 40, confirmed by the maintainer on 23 Oct 2026",
});
```

The pure report returns life, cards blocked, damage dealt and cumulative damage
for each CSV turn, plus the share of gross life lost to yourself (a fraction,
or `null` when there was no loss). Each measure has a value, an evidence label
and a source. Starting life is required and is labelled Assumed as an external
input. The report does not infer a starting life from the hero name.

Talishar's Total Value includes signed self-loss. The report recovers it by
subtracting damage threatened, damage blocked, damage prevented and life gained.
It checks the result against the observed signed game total, and rejects a
mismatch or a positive recovered loss with `TalisharReportError`. Recovered
self-loss and life remain Assumed because the export formula is a dependency.
Gross life lost and its self-loss share are also Assumed: they depend on Damage
Taken and self-loss not overlapping. The signed self-loss total remains Observed.
Calculated life is not clamped to zero: a negative balance remains visible.
See the [real worked example and source evidence](report-example.md).

`checks` compares the reported value and combat-value averages with the row
totals divided by row count, rounded to two decimal places. A mismatch is shown
as `matches: false`; no rows gives a `null` calculated average and comparison.
These comparisons check totals, not self-loss timing.

An optional `finalLife` measure supplies independently known final life, with
its evidence and source. The report rejects a discrepancy with calculated final
life and returns the comparison under `checks.finalLife`. Without that input,
the check is `null`: a result of “Loser” does not establish zero final life.
Successful checks do not automatically upgrade the derived labels.

The cause of self-loss remains unknown unless `selfLossBreakdown` supplies a
turn's `bloodDebt` and `otherSelfLost`. Each is a signed non-positive integer
measure with its own evidence and source, and their sum must match that turn's
recovered loss. Breakdowns can cover selected turns; missing ones remain `null`.
Amounts are resolved losses supplied by the caller, not an inferred banish state.
The report does not change the parsed record.
