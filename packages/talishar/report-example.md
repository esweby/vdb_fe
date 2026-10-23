# The game of 22 Oct 2026

This worked example uses the committed CSV fixture. The maintainer confirmed
Viserai's starting life of 40 on 23 Oct. Starting life remains an explicit report
input; it is not in the export.

## Recovering self-loss

Talishar's CSV exporter calculates Total Value as damage threatened + damage
blocked + damage prevented + life gained + signed life lost. It calls that
calculation with no disruption value. Rearranging it recovers signed self-loss:

```
selfLost = totalValue - damageThreatened - damageBlocked
           - damagePrevented - lifeGained
life = previousLife - damageTaken + lifeGained + selfLost
```

The source also treats damage taken and signed life lost separately when
calculating life. The opponent's damage dealt would cross-check incoming damage;
adding both would count that damage twice. This export has no opponent stats.

Source inspected on 23 Oct 2026:
[Talishar's exporter and life calculation](https://github.com/Talishar/Talishar-FE/blob/ed8ef58398545ed7cc2f34cd8ca1bef2fb1ae045/src/routes/game/components/elements/endGameStats/EndGameStats.tsx)
(`getTurnValue`, `exportCSV`, and `yourLife`), and
[signed loss recording](https://github.com/Talishar/Talishar/blob/a88623e9ce8d39ff92a4a101b833be429273fd79/Libraries/StatFunctions.php)
(`LogLifeLossStats`).

The CSV's turn-table header matches the pinned exporter exactly. This supports
using that formula, without proving which version produced the export.

**Unverified:** that source revision is not proof of the version which produced
this export. The recovered total reconciles exactly, but recovered self-loss and
life are labelled **Assumed** until checked. A different export formula must not
silently produce a curve: the report rejects a discrepancy with the observed
self-loss total, or a recovered positive loss.

| Turn | Threatened | Blocked damage | Prevented | Life gained | Total Value | Recovered self-loss | Damage taken | Calculated life | Cards blocked | Damage dealt | Damage dealt so far |
| ---- | ---------- | -------------- | --------- | ----------- | ----------- | ------------------- | ------------ | --------------- | ------------- | ------------ | ------------------- |
| 1    | 0          | 0              | 0         | 0           | -2          | -2                  | 0            | 38              | 0             | 0            | 0                   |
| 2    | 5          | 3              | 0         | 0           | 5           | -3                  | 10           | 25              | 1             | 5            | 5                   |
| 3    | 10         | 8              | 0         | 0           | 14          | -4                  | 4            | 17              | 3             | 4            | 9                   |
| 4    | 7          | 7              | 0         | 0           | 10          | -4                  | 1            | 12              | 1             | 7            | 16                  |
| 5    | 9          | 8              | 0         | 0           | 14          | -3                  | 7            | 2               | 0             | 1            | 17                  |
| 6    | 18         | 7              | 0         | 0           | 23          | -2                  | 0            | 0               | 2             | 10           | 27                  |

CSV columns, blocking and damage dealt (including cumulative damage) are
**Observed**. Recovered self-loss and calculated life are **Assumed** because
they depend on the export formula. No figure extrapolates beyond these six rows.
The rows retain the CSV's turn numbering, without claiming to reconstruct the
order of plays within a row.

The recovered losses sum to **-18**, matching the signed observed total.
Damage taken sums to **22**. Gross life lost is `22 + 18 = 40`, so the
calculated share lost to yourself is `18 / 40 = 0.45` (**45%**). Healing is
not subtracted from gross losses. A game with no losses has no defined share.
Gross life lost and its self-loss share are **Assumed**: their observed inputs
are added on the assumption that Damage Taken excludes self-loss, as in the
inspected source. The original self-loss total remains **Observed**.

## Additional checks

The summary averages support the totals, allowing for their two-decimal
rounding. The report returns both comparisons under `checks`:

- The exact sum of Total Value is **64**. `64 / 6` rounds to the reported
  **10.67**. Multiplying the rounded average by six gives **64.02**, not 64.
- Threatened damage **49** plus blocked damage **33** gives **82**.
  `82 / 6` rounds to the reported Avg Combat Value of **13.67**.
- The exact totals' difference is `64 - 82 = -18`. Healing and prevention are
  both zero here, so the difference matches the observed self-loss total.

The summary reconstruction assumes the averages cover the same CSV rows. A
discrepancy is exposed with `matches: false`; it is not silently treated as
supporting evidence. With no rows, the calculated average and comparison are
`null`. These checks support the total, not the timing of the six losses.
The pinned backend's
[aggregate calculation](https://github.com/Talishar/Talishar/blob/a88623e9ce8d39ff92a4a101b833be429273fd79/includes/functions.inc.php)
defines combat value as threatened plus blocked, and rounds its averages to two
decimal places.

Using separate losses predicts final life `40 - 22 - 18 = 0`. Treating Damage
Taken as already including self-loss predicts **18**. The recorded loss is
consistent with the first prediction, but a loss could also be a concession.
It does not independently establish zero final life.
The maintainer believes this game ended in a concession but cannot remember,
so final life remains unconfirmed and this example has no independent final-life
input.

The caller can supply `finalLife` as a measure with its evidence and source,
from a game log or an explicit player account. The report rejects a mismatch
and returns the successful comparison under `checks.finalLife`. Without that
input, the check is `null`. Passing a check does not automatically upgrade the
derived evidence labels.

**Unverified prediction to check with the maintainer:** the curve has Viserai on
2 life after CSV row 5, then losing those 2 life to self-loss on row 6, with no
damage taken in that row. Neither the cause nor the order within that row is
established by this calculation.

## Checking blood debt

Recovering self-loss places it by turn; it does not identify its cause. To split
it into blood debt and other self-loss, supply resolved blood-debt losses and
other life payments for the corresponding CSV row, each with its source and
evidence label. Both values are signed and must add to that row's recovered
self-loss. A missing breakdown remains unknown, including when one cause might
be zero.

For a state-based blood-debt calculation, the inputs to confirm with the
maintainer are the face-up blood-debt cards present when each relevant end phase
begins, which triggers resolve and any changes to the life actually lost, plus
other life payments and their row. **Unverified:** a plain card count alone
suffices for every situation. The report accepts resolved amounts instead of
introducing a new game rule. The real game's cause breakdown still needs this
evidence; all 18 life must not be called blood debt without it.
