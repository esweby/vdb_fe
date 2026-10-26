# T5 chain timing

T5 measures `bsl-gate-blood-debt`: blue Become the Shadow Lord played → a Gate activated within two turns → a blood debt card played later on the Gate's turn. The registered threshold is unchanged: investigate a difference **greater than 10 percentage points** in any of the 0-, 1- or 2-turn completion buckets.

This is a measurement of the existing **unverified chain proxy**, not a new card rule. It does not prove that BSL made the Gate, or that the payoff used that Gate's permission. In particular, the observed log does not establish that the payoff came from banish. Adding those requirements only on the simulated side would not be like for like.

## Matching the observed chain

The TypeScript trace measurement follows `services/fablazing/chain/chain.go` and the registered `chains/bsl-gate-blood-debt.json`:

- Playing blue BSL starts an attempt. Pitching it, playing another pitch or creating a Gate does not match that step.
- Within each attempt, take the first eligible Gate activation, then the first blood debt play after it on the same turn. Event order matters even within a turn.
- Try every BSL setup. Keep the attempt that reached the furthest step. Ties keep the earliest setup in event order, not the shortest delay or earliest payoff.
- The existing matcher is greedy about Gates. If the first Gate has no same-turn payoff, it does not retry a later Gate for that setup. This limitation is preserved on both sides, rather than silently changing the observed definition.
- Count at most one result per game side or simulated run. The payoff's turn minus the selected setup's turn gives its delay. Absolute turn-number shifts do not change that difference.

The engine's `played` and `gateActivated` events map to the observed spec's `M` events. Weapon attacks, token creation, banishes and skipped script steps do not substitute for either event. No combat hits are inferred.

## Counts and denominators

Both sides use this JSON shape:

```json
{
  "chain": "bsl-gate-blood-debt",
  "population": 1000,
  "reached": [700, 80, 20, 200],
  "by_delay": [100, 60, 40]
}
```

`reached` counts the furthest step: none, BSL only, BSL and Gate, or complete. These four counts sum to `population`. The three `by_delay` counts sum to `reached[3]`, the number of completed chains.

T5 shares divide each `by_delay` count by **completed chains**, not by the population, BSL plays, Gate activations or policy matches. In the example the timing shares are 50%, 30% and 20%. Completion frequency is a separate number: 200 of 1,000 runs overall, or 200 of 300 runs that reached BSL.

Failed engine runs contribute to neither the population nor timing counts. The batch still reports their failures separately. Missing measurements are errors, not zero completions. Counts must be non-negative whole numbers and have matching totals.

## Opt-in engine API

```ts
const report = runGateWeaponBatch(setup, {
  ...options,
  measureBslGateBloodDebt: true,
});
const timing = chainSpeedDistribution(report);
```

`runBatch` accepts the same flag. It adds a `bslGateBloodDebt` result to each completed run and records the flag in the batch inputs. Without the flag, existing report fields and play are unchanged. Measurement does not activate Gates or choose plays.

`compareChainSpeed(observed, simulated, { activatesGates, review })` is separate from the default T1–T4 comparison. It returns `not run` for a baseline without Gate activations or an unverified script. An approved Gate script gets three T5 checks, one for each delay. It uses the existing minimum populations of 200 observed sides and 1,000 completed simulated runs, and requires a non-zero completion denominator on each side. Both population and completion counts must be reported; having 1,000 completed runs does not mean 1,000 chain completions. Exactly ten points is within the threshold, not over it.

## Observed population

The observed command accepts paired optional `-chain-spec` and `-chain-sets` paths. It validates the registered BSL chain before measuring it. Each group's optional `chain_speed` counts use the same included sides as its existing damage and traverse figures: detailed Viserai sides, at least four turn indexes, abandoned early concessions excluded, and the earliest-20 player cap per day and format. Pooled, format, first-player and opponent groups all retain their own denominators.

Run from `services/fablazing`, using the same ordered daily files as the existing calibration:

```sh
go run ./cmd/fablazing-observed -min-turns 4 -cap 20 -turns 8 \
  -chain-spec chains/bsl-gate-blood-debt.json -chain-sets chains/sets.json \
  -out /private/tmp/observed-with-chains.json <daily-csv-files>
```

Old uncapped chain counts are not a substitute for this population. Enabling chain measurement must leave the existing damage and first-traverse figures unchanged.

## Interpretation limits

The historical `draft-descendancy-setup-v6` strategy sampled below remains **UNVERIFIED**. Its raw timing can be measured, but merging the measurement does not approve that strategy or establish a formal T5 verdict. The subsequently merged `draft-bsl-banish-v1` adds the maintainer's Shard/Bloodfrenzy preferences; its broader scheduling remains unverified too. No existing threshold moves.

The simulation stops after its declared number of turns; an unfinished late setup may have had time to complete in a longer run. Observed games have their own end points. Report those horizons rather than treating unfinished setups as completed chains or silently changing the matching window. The engine still has no opponent, blocking or hit resolution.

## Diagnostic result (25 Oct 2026)

These are frozen measurements of the v6 policy on `3716bb4`, not a rerun of the later banish policy. This measurement change is published separately against the main branch after #261; it does not include the pending Forsaken funding or per-turn traverse controls. A fixed-order BSL → Descendancy test confirms that enabling measurement leaves the merged policy's run summaries and turn metrics unchanged.

The aligned **Observed** population contains 24,789 kept Viserai sides from the existing 57 daily files. Furthest steps were none in 12,118 sides, BSL only in 6,364, BSL and Gate in 155, and complete in **6,152**. Delay counts were **2,551 / 2,068 / 1,533**, giving **41.47% / 33.62% / 24.92%** of completions at 0 / 1 / 2 turns. These are not the earlier uncapped counts. Every previous damage and first-traverse distribution, inclusion count and population grouping was checked unchanged against the existing observed report.

The **Assumed diagnostic simulation** repeats 1,000 runs for each of four fixed Cull/Scar answers, baseline versus Gates only: 8,000 runs, no failures, seed 20261021, eight turns, starting life 40, rules data `0d49faac`, and the private 54/54-covered deck. It assumes no incoming damage or life gain and no explicitly kept cards. Every paired seed, prior policy-match count and prior first-traverse sample count was checked unchanged against the pre-measurement sample.

| Cull instant / Scar go again | Completed chains | Delay counts, 0 / 1 / 2 turns | Same-turn share of completions |
| ---------------------------- | ---------------- | ----------------------------- | ------------------------------ |
| No / No                      | 185              | 182 / 0 / 3                   | 98.38%                         |
| No / Yes                     | 192              | 188 / 1 / 3                   | 97.92%                         |
| Yes / No                     | 186              | 181 / 0 / 5                   | 97.31%                         |
| Yes / Yes                    | 192              | 187 / 1 / 4                   | 97.40%                         |

Each row is out of 1,000 simulated runs, but timing shares divide by its completed-chain count. The four baseline cases have no completed chains, as expected without Gate activation; their timing shares are undefined, not zero. They are not T5 comparisons.

The draft's completed chains are overwhelmingly same-turn, unlike the observed timing mix. That is a concrete policy gap to investigate, not evidence that the strategy is calibrated merely because Gate applications increased. The script concentrates on the immediate Descendancy line; broader delayed Gate use is not represented well by that preference. This measurement does not decide which additional targets or delayed lines should be played. The comparator returns `not run` for this still-unverified strategy, rather than promoting diagnostic differences to formal T5 verdicts.

Separately, 2,000 deterministic generated traces (seed 20261025) matched the existing Go matcher exactly, including multiple setups, partials and greedy Gate choices. Unit tests cover those cases as well as failure exclusion, default-output compatibility, sample guards and the strict ten-point boundary.

Private reports are `/private/tmp/vdb-t5-20261025/observed.json`, `simulated.json` and `summary.json`. The simulation records source hashes based on `3716bb4`; the summary records report, chain-spec and card-set hashes. No private deck list or game records are committed, no database records are changed, and historical calibration results remain frozen.

## Delayed-chain investigation (25 Oct 2026)

This investigation does **not** change the repository's play policy or its approved bounds. Legal counterfactuals below use the engine's registered rules, not a judgement that the line is always worth playing.

### A real restriction, but not the whole explanation

The general Descendancy funding selector requires Usurper. A separate read-only replay inspected 1,000 existing policy runs for each fixed Cull/Scar case. Every inspected result, including its full trace, matched the original runner exactly. Repeated checks of the same turn and event count were deduplicated. Candidate target types were deduplicated by name and pitch within a checkpoint.

Within one or two turns of the latest BSL play, the runs with a Gate at a decision checkpoint numbered **42 / 47 / 51 / 54** across the four cases. Only **6 / 10 / 9 / 12** runs had a delayed checkpoint with a legal, funded Descendancy line. In **4 / 8 / 6 / 10** runs, the only selector blocker was being on Forsaken: they also passed the over-17 life and first-blood-debt-attack guards. These are overlapping opportunity counts, not predictions of additional completions.

One Assumed checkpoint illustrates the issue: Forsaken, one action point, 39 life, zero resources, four Runechants, a Gate, blue Descendancy face up in banish and a blue Murmuring Gloomblade available to pitch. The registered engine permits pitch Murmuring → Gate → Descendancy. It costs two of the three resources, pays no life and does not require a sword follow-up. The selector declines it because of the hero side. This establishes legality in the model, not superiority to another play.

A private **UNVERIFIED counterfactual** removed only the Usurper-side requirement from general Descendancy funding. It kept the life guard, first-blood-debt-attack guard, pitch policy, optional sword and all other decisions. The same four 1,000-run cohorts completed with no failures:

| Cull instant / Scar go again | Completed chains, original → counterfactual | Delayed completions, original → counterfactual | Same-turn share, original → counterfactual |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| No / No                      | 185 → 189                                   | 3 → 6                                          | 98.38% → 96.83%                            |
| No / Yes                     | 192 → 200                                   | 4 → 11                                         | 97.92% → 94.50%                            |
| Yes / No                     | 186 → 192                                   | 5 → 11                                         | 97.31% → 94.27%                            |
| Yes / Yes                    | 192 → 202                                   | 5 → 15                                         | 97.40% → 92.57%                            |

The restriction suppresses some delayed play, but removing it does not reproduce the observed timing mix. No large population rerun is warranted on that change alone.

### Other cards are not automatically missing Gate plays

Most delayed Gate checkpoints have no face-up Descendancy. The diagnostic found other legal Gate → play fragments, but the sampled non-Descendancy targets that could be played after a Gate could also be played without it under the same probe conditions. Many are Usurp attacks; Cull also has its own permission. No sampled Usurp the Shadow Throne probe completed the Gate → play fragment.

Spending Gates on those cards just to increase T5 counts would invent a strategy. The maintainer's instruction remains: Gate a Usurp card only for an explicitly wanted traverse back. The engine does not judge momentum or card advantage. It also defaults to accepting the optional end-phase traverse unless the script declines it; the delayed checkpoint counts were predominantly on Forsaken. A future policy needs an explicit return/hold choice, not an assumption that every legal Gate is useful.

The legal probes are diagnostic branches only. They use the fixed Cull/Scar answers and zero additional life payment. Pitching may reveal cards inside a probe; those results are never used to choose or change the original play. Being able to execute a fragment is not proof of its value.

### The observed pool has a different payoff mix

The existing aligned population and matcher were replayed unchanged, checking the same 24,789 kept sides and all three completion totals. Observed payoff associations split as follows:

| Delay from BSL | All completions | Blue Descendancy | Open the Gate | Other payoffs |
| -------------- | --------------- | ---------------- | ------------- | ------------- |
| 0 turns        | 2,551           | 1,594            | 572           | 385           |
| 1 turn         | 2,068           | 950              | 536           | 582           |
| 2 turns        | 1,533           | 596              | 484           | 453           |

Of the **3,601 delayed completions**, 1,546 have Descendancy as the selected payoff, 1,020 Open the Gate and 1,035 another payoff. The private simulated deck does not contain Open the Gate, and its matched Gate fragments concentrate on Descendancy. This population/deck difference is part of the explanation; it is not a reason to add cards to the private deck or register irrelevant rules merely to fit the pooled figures.

Even restricting the observed diagnostic to Descendancy payoffs does not remove the gap: **50.76% / 30.25% / 18.98%** of its 3,140 completions occur at 0 / 1 / 2 turns. That is still much less same-turn-heavy than the draft. This extra split is explanatory, not a replacement for the pre-registered pooled T5 comparison, and it does not match whole deck lists or establish Gate provenance.

### Next bounded work

1. Review extending the funded Descendancy line to Forsaken without requiring a sword. Keep the over-17 guard, explicit kept cards and affordability; do not infer that legality means best play.
2. Represent the explicit traverse-back/hold decision on later turns before broadening Gates on Usurp cards. Do not gate already-playable cards merely to manufacture chain completions.
3. Continue distinguishing the private deck from the observed pool. Recheck delayed traces after a bounded policy change before deciding on another large comparison.

Private evidence is under `/private/tmp/vdb-t5-investigation-20261025/`: `observed-payoffs.json`, `simulated-opportunities-v2.json` and `forsaken-ablation.json`. The read-only replay records exact trace equality; the intervention intentionally changes traces and is labelled separately. No hosted data, card rules, game thresholds or production strategy are changed by this investigation.
