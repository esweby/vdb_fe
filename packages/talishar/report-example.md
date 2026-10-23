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
observed share lost to yourself is `18 / 40 = 0.45` (**45%**). Healing is
not subtracted from gross losses. A game with no losses has no defined share.

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
