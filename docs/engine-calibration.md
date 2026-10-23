# Engine calibration

Step 5 of [fablazing-plan.md](fablazing-plan.md): checking the TypeScript rules engine (`packages/engine`) against real games from FaBlazing.

Status, 23 Oct 2026: **T1–T4 compared** on the maintainer's deck; results below. T1–T5 were approved by the maintainer on 21 Oct 2026, before anything was compared, and haven't moved. **T6 (threatened damage) is still a draft:** its result is reported apart, for the maintainer to approve or drop. T5 waits for the Gate-target list. A divergence is something to investigate (a missing rule, a scripted decision or a difference in the data). It never means moving a threshold.

Logs show associations, and the simulation tests counterfactuals. Causal words are kept for results where both agree. The game logic here is **unverified** until the maintainer checks it.

## What the engine can and can't be compared on

The engine is a goldfish: it plays Viserai's own turns with no opponent, and attack resolution, blocking and damage to a hero are out of scope ([rules-engine.md](rules-engine.md), "Scope"). It now counts threatened attack damage as described below, but does not resolve attacks. What it produces:

| Engine output (per turn)                  | Observed counterpart (per turn index)      | Comparable?                                                                                                          |
| ----------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Arcane damage from Runechants             | `arcaneDamageDealt`                        | **Yes.** The closest like-for-like number. The opponent can prevent arcane damage in a real game; the goldfish can't |
| The first traverse to the Usurper         | The first `TRANSFORM` to `viserai_usurper` | **Yes.** A logged event against an engine event                                                                      |
| A Gate made, a Gate activated, BSL played | The chain library's steps                  | **Only with a script that activates Gates.** The app's baseline script never does (see "The simulated side")         |
| Threatened attack damage (a lower bound)  | `damageThreatened`                         | **Draft T6.** Reported separately, pending approval; whether the observed total includes arcane damage is unknown    |
| No resolved attack damage                 | `damageDealt` (after blocks)               | **No.** Reported observed only, as context                                                                           |

**Damage dealt by turn** is still produced on the observed side, as the brief asks, but it has no simulated counterpart. The maintainer agreed to counting threatened damage on 21 Oct; that count is built and its draft T6 results are reported below. It does not model damage after blocks or prevention.

## The observed side

From `~/.cache/vdb/fablazing/viserai/*.csv`: 57 daily files, 21 Sep to 20 Oct 2026, formats 0 and 1 (format 1 for 18 Oct and both formats for 19 Oct are missing).

**Who counts:**

- Viserai sides with detail (`turnResults` and `turnLog`), from games of **4 or more turn indexes**
- abandoned early concessions left out, using the accepted rule (conceded within 2 turns at life above 20)
- the player cap applied: each player's earliest 20 sides per day and format
- reported pooled, by format, and by going first or second. FaBlazing confirmed on 21 Oct that `firstPlayer` is 1 when this player went first, otherwise 0 ([data dictionary](fablazing-data-dictionary.md))

**Turn numbering:** a turn index is a round, starting at 0. The engine's turn N is compared with turn index N − 1. Knowing who went first does not settle the mapping between an engine turn and the logged round, so the pre-registered check against index N is kept too. **If a verdict changes between the two mappings, that's recorded as a data difference, not as within threshold.**

**Distributions written** (JSON, from a new Go command, `services/fablazing/cmd/fablazing-observed`):

- arcane damage dealt by turn index (0–7): the full histogram, the median and the 2.5th and 97.5th percentiles
- damage dealt by turn index, the same way (context only)
- the turn index of the first traverse to the Usurper: a histogram, with "never traversed" as its own bucket
- the sample size at every point

## The simulated side

- **Engine:** the rules engine's seeded batches (`runBatch`), with Viserai's hero text, the Runechant rule and Blood Debt.
- **Runs:** 10,000 runs, seed `20261021`, 8 turns, from Viserai, the Forsaken.
- **Script:** the app's baseline (play anything the rules allow, lowest pitch first, up to 10 plays, then end the turn). It never activates a Gate or attacks with a weapon, so it's slower than a player. That's a known bias, and the chain-speed comparison waits on a script the maintainer agrees (question 2).
- **Deck:** the maintainer chooses (question 1).
- **Coverage:** only cards with verified rules play by the rules. The report states how many of the deck's cards are verified, both as distinct cards and as copies. **If fewer than 80% of the deck's copies are verified, the run is labelled incomplete**, and any divergence where the simulation is slower or lower than the logs is listed under "coverage" first.

## Thresholds (pre-registered)

Each is checked on turns 1–6 (turn indexes 0–5). A turn is checked only if it has **at least 200 observed sides and 1,000 completed simulated runs**. Below that it's reported as "not enough data".

**T1. Arcane damage by turn: the median.** Investigate if, on any turn, the median simulated arcane damage falls outside the observed central 95% range for that turn (2.5th to 97.5th percentile).

**T2. Arcane damage by turn: the distribution.** Investigate if, on any turn, the largest gap between the simulated and observed cumulative distributions is more than **0.15** (the Kolmogorov–Smirnov distance, read as an effect size). A p-value isn't used: with about 28,000 sides, any difference at all would be significant.

**T3. First traverse: the cumulative share.** Investigate if the share of sides that have traversed to the Usurper by the end of turn N differs between simulation and logs by more than **10 points** on any turn 1–6.

**T4. First traverse: the median.** Investigate if the simulated median first-traverse turn falls outside the observed central 95% range of first-traverse turns.

**T5. Chain completion speed.** For `bsl-gate-blood-debt`, investigate if the simulated share of completions at 0, 1 and 2 turns after Become the Shadow Lord differs from the observed shares by more than **10 points** in any bucket. **Not run with the baseline script**, which can't activate a Gate. It runs only with a script the maintainer agrees.

**T6. Threatened damage by turn** (drafted 22 Oct 2026 after the maintainer said threatened damage is important; **waiting for approval**, and drafted before any threatened damage distribution was computed). The same two tests as arcane damage, on the engine's threatened damage (see below) against `damageThreatened`: investigate if the simulated median falls outside the observed central 95% range on any turn (T6a), or if the largest gap between the cumulative distributions is more than **0.15** (T6b).

**Matchups.** The goldfish has no opponent, so the simulation is compared with the pooled logs. For context, each threshold is also checked against every matchup with at least 200 sides on that turn. A divergence is called **robust** if it holds pooled and in most of those matchups, and **matchup-dependent** otherwise.

**Expected direction, written before looking:** the baseline script makes the simulation slower than players at traversing (no Gate activation means no Usurper-side Gate traverse), and incomplete coverage makes it lower on arcane damage. Having no opponent, and so no blocking or arcane prevention, pushes the other way. A divergence in the expected direction is still a divergence and is still investigated.

## What was seen before drafting these

Already known from the chain library ([fablazing-chains.md](fablazing-chains.md), 30 days), before any of this step's distributions were computed:

- 27,994 detailed Viserai sides after leaving out 1,188 abandoned early concessions, without the player cap
- 26,072 sides traversed to the Usurper at some point and 1,922 never did. The median turn of `traverse-uses-action-point` is 2, and `traverse-flip-back`'s median setup turn is 1
- Become the Shadow Lord chains: median setup turn 3. Turns to the payoff were 0 in 2,662, 1 in 2,143 and 2 in 1,569 (42%, 34% and 25%)
- Damage on chain turns: 5.7 against 4.2 (BSL setup turn), 8.3 against 2.8 (after a traverse), 12.8 against 5.1 (Cullingsong and Usurp), 14.8 against 6.7 (Usurp hits)
- one row of 20 Oct (format 0), looked at to learn the field names: turn index 1 had `damageThreatened` 10 and `damageDealt` 6

**Not seen:** arcane damage by turn, damage by turn, and the first-traverse turn distribution. Nothing has been simulated.

## The maintainer's answers (21 Oct 2026)

1. **Deck:** "Probably my own."
2. **A script with Gates:** "Sort of." A Gate should be activated on condition, for a card you definitely want out of your banished zone, with some caveats. So the calibration script activates a Gate only on a card from a list the maintainer gives, and **T5 waits for that list and its caveats.**
3. **Threatened damage:** "Important." The engine gains threatened damage (below), and T6 is drafted for it.
4. **T1–T5:** approved as written.
5. **The Cullingsong → Usurp proposal:** agreed.

## Threatened damage in the engine

A goldfish count, not combat: each attack played threatens its printed power, plus 2 when Usurp destroys a Runechant. Weapon attacks count too. Nothing is blocked or prevented. Power bonuses that verified cards note as "combat, out of scope" aren't counted, so it's a **lower bound** on the cards it plays. Arcane damage is kept apart, since whether `damageThreatened` includes arcane damage is unknown.

## First counterfactual candidate: Cullingsong → Usurp

In the logs, `cullingsong-usurp` was associated with **+30.9 ±3.7 points** (expected 0 to +10). The expectation didn't say what a result above +10 means; the brief's reading is that over +20 suggests win-more. The groups also differ by game stage (median turn 4 for the pair).

**Agreed by the maintainer (21 Oct 2026).** The engine has no combat, so it can't simulate winning. What it can test is whether the pair is **available** early or only late:

- With the same seeds, run the baseline script against one that holds Usurp until Cullingsong has been played that turn.
- Compare, by turn, how often the pair is possible at all (both in hand or playable, with the resources), and the Runechants and arcane damage that turn.
- If the pair is rarely possible before turn 4 in the simulation, the logs' +30.9 is consistent with a late-game, win-more association rather than a line that wins games. If it's often possible early and players don't take it, that points to a decision worth looking at.

Needs: both cards verified (Cullingsong Gloomblade is; **Usurp the Shadow Throne isn't yet**, so its effect draft comes first) and an "if" check for "Cullingsong played this turn", which the script vocabulary may need adding.

## How to run it

Observed side (about 6 seconds for 30 days):

```bash
cd services/fablazing && go run ./cmd/fablazing-observed -out observed.json ~/.cache/vdb/fablazing/viserai/*.csv
```

Simulated side and the comparison, with the deck as a plain list (`3 Cullingsong Gloomblade (red)` per line, the main deck plus weapons and equipment; a `Sideboard` heading ends it). Cards come from the local Supabase:

```bash
SUPABASE_ANON_KEY=<local anon key> node --experimental-transform-types apps/web/scripts/calibrate.ts --deck deck.txt --observed observed.json --out result.json
```

It checks T1–T4 with both turn mappings, pooled and for every matchup with at least 200 sides, and says which divergences are robust. `--t6` adds T6 once it's approved.

**Observed, 30 days** (computed 22 Oct 2026, after T1–T5 were approved): 31,632 Viserai sides in 31,023 games; 24,789 kept. Left out: 1,290 abandoned, 2,348 without detail, 3,079 shorter than 4 turn indexes and 126 past the player cap. 17,069 in format 0 and 7,720 in format 1; 12,702 went first.

## Results (23 Oct 2026)

**Inputs:**

- **Deck:** the maintainer's own, read from the app on 23 Oct 2026: 54 cards, 21 distinct, plus Seven Sin Nebula and four pieces of equipment. The list isn't committed, since the deck is private.
- **Runs:** 10,000 seeded runs (seed 20261021), 8 turns, baseline script, from Viserai, the Forsaken. All 10,000 completed.
- **Versions:** engine 0.1.0, rules data `d4293622`.
- **Observed:** the 24,789 sides above.

**Coverage: incomplete.** 29 of 54 copies are verified (54%, under the 80% line), and 11 of 21 distinct cards. Unverified, so held or pitched but never played:

- Bloodfrenzy Gloomblade (all three pitches, 9 copies)
- Cull, Scar for a Scar and Sinspeaker Gloomblade (red)
- Embrace Sin (yellow)
- Arknight Descendancy, Arknight Shard and Usurp the Shadow Throne (blue)

Under the pre-registered rule, divergences where the simulation is slower or lower are listed under coverage first.

### Against the thresholds

The verdicts are the same with either turn mapping, except T2 on turn 1 (within with turn index N − 1, investigate with index N).

| Threshold                          | Verdict                                                        | Numbers                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1** arcane damage, median       | **Within**, turns 1–6                                          | Simulated median 0 on every turn. The observed 95% range is 0–7 from turn 2 on, so this test can hardly fail.                                                         |
| **T2** arcane damage, distribution | **Investigate**, turns 2–6 (and turn 1 with the other mapping) | Gap 0.33–0.45 against the 0.15 line. Mean 0.2–0.3 a turn simulated, against 1.5–1.8 observed. Robust: it diverges in every matchup with enough data (33–35 of 33–35). |
| **T3** share traversed by turn     | **Investigate**, turns 2–6                                     | By turn 3: 11% simulated, 76% observed. By turn 6: 16% against 96%. Robust in all 35 matchups. Only 17.6% of runs traverse within 8 turns.                            |
| **T4** median first-traverse turn  | **Within**                                                     | Simulated median turn 3, inside the observed range. But it's the median of the 17.6% that traverse, so it says little.                                                |
| **T5** chain speed                 | **Not run**                                                    | Waits for the maintainer's Gate-target list.                                                                                                                          |

**T6, threatened damage (draft, not approved):**

- **T6a, the median:** within on every turn. The simulated median is 2–4 on turns 1–4, then 0, inside an observed range of 0–23.
- **T6b, the distribution:** investigate on every turn, with gaps of 0.55–0.73.
- **Means:** 1.7–3.4 simulated, against 8.7–10.3 observed.

**The maintainer is asked to approve or drop T6.** Either way, the numbers above stay as they are.

### What it implies for the engine

**On this deck, the engine isn't calibrated yet.** It's far slower than real games: it traverses less, and makes fewer Runechants and less threatened damage. Every divergence is in the direction written down beforehand. The median tests (T1, T6a) pass only because the observed ranges start at 0, so the distribution tests are the informative ones.

The likely causes, in order. All are **UNVERIFIED** readings for the maintainer to check:

1. **Coverage.** 46% of the deck can't be played. Unverified cards also stay in hand, because the baseline only pitches to pay, so the hand clogs. Threatened damage falls to a median of 0 from turn 5, which fits that.
2. **The scripted policy.** The baseline never activates a Gate and never attacks with Seven Sin Nebula. In the logs, Nebula and Gates are among the most common cards played after a traverse. There's also no Usurper-side Gate traverse.
3. **Not missing combat.** Threatened damage counts nothing for blocking. That would make the simulation higher, not lower, so it doesn't explain the gap.

**Next, without moving a threshold:**

- verify the unmodelled cards with the most copies first: Bloodfrenzy Gloomblade, then Usurp the Shadow Throne, Arknight Descendancy and Embrace Sin
- get the Gate-target list for T5's script
- decide whether the script attacks with weapons
- run again on the same seed

The Cullingsong → Usurp counterfactual also waits on Usurp the Shadow Throne being verified.
