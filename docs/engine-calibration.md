# Engine calibration

Step 5 of [fablazing-plan.md](fablazing-plan.md): checking the TypeScript rules engine (`packages/engine`) against real games from FaBlazing.

Status, 21 Oct 2026: **thresholds drafted, waiting for the maintainer's approval.** Nothing has been compared yet. The observed and simulated distributions aren't computed until these thresholds are approved, and once they're approved they don't change. A divergence is something to investigate (a missing rule, a scripted decision or a difference in the data). It never means moving a threshold.

Logs show associations, and the simulation tests counterfactuals. Causal words are kept for results where both agree. The game logic here is **unverified** until the maintainer checks it.

## What the engine can and can't be compared on

The engine is a goldfish: it plays Viserai's own turns with no opponent, and attack resolution, blocking and damage to a hero are out of scope ([rules-engine.md](rules-engine.md), "Scope"). So it **has no attack damage to compare.** What it does produce:

| Engine output (per turn)                  | Observed counterpart (per turn index)                     | Comparable?                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Arcane damage from Runechants             | `arcaneDamageDealt`                                       | **Yes.** The closest like-for-like number. The opponent can prevent arcane damage in a real game; the goldfish can't |
| The first traverse to the Usurper         | The first `TRANSFORM` to `viserai_usurper`                | **Yes.** A logged event against an engine event                                                                      |
| A Gate made, a Gate activated, BSL played | The chain library's steps                                 | **Only with a script that activates Gates.** The app's baseline script never does (see "The simulated side")         |
| No attack power at all                    | `damageDealt` (after blocks), `damageThreatened` (before) | **No.** Reported observed only, as context                                                                           |

**Damage dealt by turn** is still produced on the observed side, as the brief asks, but it has no simulated counterpart. Comparing it would need the engine to count each attack's printed power as "threatened damage", which is a step towards combat. That's a decision for the maintainer (question 3), not part of this pass.

## The observed side

From `~/.cache/vdb/fablazing/viserai/*.csv`: 57 daily files, 21 Sep to 20 Oct 2026, formats 0 and 1 (format 1 for 18 Oct and both formats for 19 Oct are missing).

**Who counts:**

- Viserai sides with detail (`turnResults` and `turnLog`), from games of **4 or more turn indexes**
- abandoned early concessions left out, using the accepted rule (conceded within 2 turns at life above 20)
- the player cap applied: each player's earliest 20 sides per day and format
- reported pooled, by format, and by going first or second, since `firstPlayer`'s meaning is unknown ([data dictionary](fablazing-data-dictionary.md))

**Turn numbering:** a turn index is a round, starting at 0. The engine's turn N is compared with turn index N − 1. Because which half of the round comes first is unknown, every comparison is also run with turn N against index N. **If a verdict changes between the two mappings, that's recorded as a data difference, not as within threshold.**

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

## Questions for the maintainer

1. **Which deck?** For example your own, or a field-typical list built from the most common cards in the logs.
2. **A calibration script with Gates?** The baseline never activates a Gate or attacks with a weapon. A second script could add "activate a Gate on a blood debt card when able" and "attack with a weapon when able". That's a scripted decision, so it's yours. Without it, T5 isn't run.
3. **Threatened damage?** Should the engine count each attack's printed power as damage threatened (no blocking), so damage by turn can be compared with `damageThreatened`? It's a step towards combat, which is out of scope now.
4. **Approve the thresholds T1–T5** as written, or change them now. After approval they stay fixed.

## First counterfactual candidate: Cullingsong → Usurp

In the logs, `cullingsong-usurp` was associated with **+30.9 ±3.7 points** (expected 0 to +10). The expectation didn't say what a result above +10 means; the brief's reading is that over +20 suggests win-more. The groups also differ by game stage (median turn 4 for the pair).

**A proposal, not built until the maintainer agrees.** The engine has no combat, so it can't simulate winning. What it can test is whether the pair is **available** early or only late:

- With the same seeds, run the baseline script against one that holds Usurp until Cullingsong has been played that turn.
- Compare, by turn, how often the pair is possible at all (both in hand or playable, with the resources), and the Runechants and arcane damage that turn.
- If the pair is rarely possible before turn 4 in the simulation, the logs' +30.9 is consistent with a late-game, win-more association rather than a line that wins games. If it's often possible early and players don't take it, that points to a decision worth looking at.

Needs: both cards verified (Cullingsong Gloomblade is; **Usurp the Shadow Throne isn't yet**, so its effect draft comes first) and an "if" check for "Cullingsong played this turn", which the script vocabulary may need adding.
