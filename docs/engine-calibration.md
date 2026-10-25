# Engine calibration

Step 5 of [fablazing-plan.md](fablazing-plan.md): checking the TypeScript rules engine (`packages/engine`) against real games from FaBlazing.

Status, 25 Oct 2026: **T1–T4 and T6 compared at full verified-rule coverage**, using four explicit-answer cases approved by the maintainer; results at the end of this document. T1–T5 were approved on 21 Oct 2026, before anything was compared, and haven't moved. **T6 (threatened damage) was approved as written on 24 Oct**, after its draft results had been reported separately. T5 waits for the Gate-target list. A divergence is something to investigate (a missing rule, a scripted decision or a difference in the data). It never means moving a threshold.

Latest coverage: **54 of 54 copies (100%), all 21 distinct cards**. All four same-seed cases completed 10,000 runs each. Every case still diverges; full card coverage does not establish calibration.

The maintainer's target of **100% coverage, reviewing a couple of cards at a time** (24 Oct), is reached. That means each card has registered rules, with the scope limits below; it does not mean every combat effect or opponent interaction is modelled.

Logs show associations, and the simulation tests counterfactuals. Causal words are kept for results where both agree. The game logic here is **unverified** until the maintainer checks it.

## Coverage update (24 Oct 2026)

The maintainer approved Bloodfrenzy Gloomblade's rules for all three pitches: Usurp, play from banish and go again after damage dealt that turn, including its remaining Runechants or its own hit. Overlapping sources of go again return only one action point.

With those rules added, the same deck has 38 of 54 copies verified (70%), and 14 of 21 distinct cards. Coverage is still incomplete. A new baseline run is recorded below; the 23 Oct results are preserved. T1–T5 stay fixed; T5 still waits for an agreed script.

## Script guidance (24 Oct 2026)

The maintainer gave these reasons to attack with Seven Sin Nebula:

- spare pitch and no other cards to play
- keeping a card in hand because it is better as a starter next turn
- no Runechants, and wanting a chance to end on one
- a slower hand where pitch stacking is more effective than playing every card

The maintainer also gave these Gate priorities:

- At least 25 life **after paying** is comfortable for the Descendancy line when it can also lead to a sword swing (payment timing confirmed 25 Oct). Below 25, consider whether blocking it would tax the opponent's entire hand without putting Viserai in immediate danger. The below-25 exception still needs an explicit danger decision.
- Always prioritise Arknight Descendancy over Open the Gate to i'Arathael. Open the Gate is easier to play later; it does not need high pitch or five Runechants.
- Activate a Gate on a Usurp card only to enable traversing back. This is a reason to activate the Gate, not an instruction to do it every time.

Activating a Gate without enough resources to play its target remains a choice, not an agreed rule. The maintainer asks whether there is more than one Gate, and whether traversing back for card advantage matters because momentum is being lost. There is no agreed test for momentum yet.

The maintainer gave a concrete below-25 example: an opponent on 5–6 life facing four Runechants and a six-power attack. That is a pressure case to consider, not proof that the opponent must use their whole hand. The goldfish has no opponent life, defensive options or incoming threat, so evaluating the exception needs explicit scenario inputs. No damage is assumed to get through and no low-life exception is implemented yet.

These are player decisions to represent in the script, not an implemented policy yet. The choices of starter, slower hand and pitch order still need concrete examples before they can become deterministic checks. The baseline used for the 23 Oct results is unchanged.

[Gate and sword worked hands](gate-weapon-worked-hands.md) now provide five runnable fragments from declared mid-turn states (25 Oct). The maintainer approved the exact blue Shard / blue BSL hand; the other selections remain **UNVERIFIED**. They cover the Descendancy line, retaining a Gate on an own-permission Usurp card, spending it for an explicit traverse back, and spare-resource or explicitly designated spare-pitch sword swings. A separate comfort check uses explicit life and payment inputs. The examples do not select themselves, infer life or momentum, simulate Open the Gate, or award Nebula's on-hit Runechant. They are a review step, not a new calibration policy or a T5 result.

## What the engine can and can't be compared on

The engine is a goldfish: it plays Viserai's own turns with no opponent, and attack resolution, blocking and damage to a hero are out of scope ([rules-engine.md](rules-engine.md), "Scope"). It now counts threatened attack damage as described below, but does not resolve attacks. What it produces:

| Engine output (per turn)                  | Observed counterpart (per turn index)      | Comparable?                                                                                                          |
| ----------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Arcane damage from Runechants             | `arcaneDamageDealt`                        | **Yes.** The closest like-for-like number. The opponent can prevent arcane damage in a real game; the goldfish can't |
| The first traverse to the Usurper         | The first `TRANSFORM` to `viserai_usurper` | **Yes.** A logged event against an engine event                                                                      |
| A Gate made, a Gate activated, BSL played | The chain library's steps                  | **Only with a script that activates Gates.** The app's baseline script never does (see "The simulated side")         |
| Threatened attack damage (a lower bound)  | `damageThreatened`                         | **T6, approved 24 Oct.** Whether the observed total includes arcane damage is still unknown                          |
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

**T6. Threatened damage by turn** (drafted 22 Oct 2026 before any threatened damage distribution was computed; **approved as written on 24 Oct**, after the draft results were reported). The same two tests as arcane damage, on the engine's threatened damage (see below) against `damageThreatened`: investigate if the simulated median falls outside the observed central 95% range on any turn (T6a), or if the largest gap between the cumulative distributions is more than **0.15** (T6b).

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

Both cards are now verified: the maintainer accepted blue Usurp the Shadow Throne on 24 Oct, and its rules have been added to the engine. The separate counterfactual still needs an "if" check for "Cullingsong played this turn", which the script vocabulary may need adding. This calibration work does not run that comparison.

## How to run it

Observed side (about 6 seconds for 30 days):

```bash
cd services/fablazing && go run ./cmd/fablazing-observed -out observed.json ~/.cache/vdb/fablazing/viserai/*.csv
```

Simulated side and the comparison, with the deck as a plain list (`3 Cullingsong Gloomblade (red)` per line, the main deck plus weapons and equipment; a `Sideboard` heading ends it). Cards come from the local Supabase:

```bash
SUPABASE_ANON_KEY=<local anon key> node --experimental-transform-types apps/web/scripts/calibrate.ts --deck deck.txt --observed observed.json --out result.json
```

It checks T1–T4 with both turn mappings, pooled and for every matchup with at least 200 sides, and says which divergences are robust. `--t6` adds T6, approved on 24 Oct.

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

**T6, threatened damage (a draft when these results were computed):**

- **T6a, the median:** within on every turn. The simulated median is 2–4 on turns 1–4, then 0, inside an observed range of 0–23.
- **T6b, the distribution:** investigate on every turn, with gaps of 0.55–0.73.
- **Means:** 1.7–3.4 simulated, against 8.7–10.3 observed.

**The maintainer approved T6 as written on 24 Oct.** The numbers above stay as they are.

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

At the time of the 23 Oct run, the Cullingsong → Usurp counterfactual also waited on Usurp the Shadow Throne being verified.

## Bloodfrenzy baseline rerun (24 Oct 2026)

The same private deck, observed file, baseline script, seed `20261021`, 10,000 runs and eight turns were used again, with Bloodfrenzy's approved rules. Cards came from local Supabase. All 10,000 runs completed. Engine version is `0.1.0`, rules data `88d7bfcb` (previously `d4293622`). T6 was included following approval; no threshold changed.

Coverage is **incomplete**: 38 of 54 copies (70%), 14 of 21 distinct cards. The baseline still never activates Gates or attacks with weapons. This measures the card-coverage change, not the proposed policy.

| Threshold | Verdict with turn index N − 1 | Detail                                                                                                                  |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| T1        | Within, turns 1–6             | Arcane median remains zero.                                                                                             |
| T2        | Investigate, turns 2–6        | Distribution gaps 0.35–0.46; robust in every matchup with enough data.                                                  |
| T3        | Investigate, turns 2–6        | By turn 3, 9.41% traversed against 76.03% observed; by turn 6, 16.11% against 95.51%. Robust in every eligible matchup. |
| T4        | Within                        | Conditional median first-traverse turn is 4; compared with observed index 3.                                            |
| T5        | Not run                       | No Gate script yet.                                                                                                     |
| T6a       | Within, turns 1–6             | Threatened-damage medians are 3, 4, 4, 4, 4 and 3.                                                                      |
| T6b       | Investigate, turns 1–6        | Distribution gaps 0.52–0.74; robust in every eligible matchup.                                                          |

With the other turn mapping, both T2 and T3 also investigate on turn 1. Those changes in verdict are recorded as a data difference. There are 16 investigate verdicts and 15 within with the first mapping; 18 investigate and 13 within with the other. No check lacks sufficient data.

The engine is still not calibrated. Threatened damage no longer falls to a median of zero on turns 5 and 6, but arcane damage and traverse timing still diverge. Lower or slower results remain listed under coverage first. The original `result.json` was left untouched; the new raw report is saved locally at `/private/tmp/vdb-calibration-20261024/baseline-bloodfrenzy.json`. The private deck list is not committed.

## Usurp baseline rerun (24 Oct 2026)

The maintainer accepted blue Usurp the Shadow Throne's draft. Its verified rules cover the six-resource discount and permission to play from banish after an earlier usurp that turn. The card does not have Usurp itself. Its on-hit effect remains outside the engine's scope.

The same private deck, observed file, baseline script, seed `20261021`, 10,000 runs and eight turns were used again, with cards from local Supabase. All 10,000 completed. Engine version is `0.1.0`, rules data `072b83eb`. T1–T6 are unchanged, T5 still cannot run with the baseline, and no tactical script or counterfactual is introduced.

Coverage rises from 38 to **40 of 54 copies (74%)**, and from 14 to 15 of 21 distinct cards. It remains incomplete: four more copies need verified rules to reach the 80% requirement.

The threshold verdicts remain as in the Bloodfrenzy rerun: T1, T4 and T6a are within; T2 and T3 investigate on turns 2–6 with the primary mapping, and T6b investigates on turns 1–6. The other mapping also investigates T2 and T3 on turn 1. Every pooled divergence is robust in the matchup checks.

The numerical changes are small. On turn 3, mean arcane damage is 0.1899 (previously 0.1900), mean threatened attack damage is 3.8658 (previously 3.8628), and 9.41% have traversed (unchanged). By turn 6, 16.11% have traversed (unchanged). This is not evidence that the engine is calibrated; coverage and the baseline's Gate and weapon omissions remain limitations.

The new raw report is saved locally at `/private/tmp/vdb-calibration-20261024/baseline-usurp.json`. Both earlier reports and the private deck list are preserved. The Cullingsong → Usurp counterfactual remains a separate follow-up.

## Descendancy and Shard baseline rerun (24 Oct 2026)

The maintainer approved both blue drafts, now registered as verified rules. Tests use those registered rules for pitching Shard, banishing Descendancy from hand, deck and graveyard, choosing 0–3 life, ignoring face-down copies and replaying choices. The full BSL → Gate → Descendancy → Nebula interaction uses the verified Descendancy rules.

The same private deck, observed file, seed `20261021`, 10,000 runs and eight turns were used again, with cards from local Supabase. All 10,000 completed. Engine version is `0.1.0`, rules data `253b52ee`. This run also includes the queued-Forsaken correction from PR 244, so changes from the Usurp rerun are not attributed solely to the two cards.

The script remains the baseline: no Gate activations or weapon attacks, and no `choices.lifePayment` setting, so it pays zero when Descendancy is banished. This is not a test of the proposed tactical line or its life threshold. No threshold changed; T5 still cannot run.

Coverage rises to **43 of 54 copies (79.6%)**, and 17 of 21 distinct cards. It remains incomplete. The four remaining cards are red Cull, Scar for a Scar and Sinspeaker Gloomblade, and yellow Embrace Sin: 11 copies in total. The target remains 100%, in review pairs.

All threshold verdicts remain unchanged from the Usurp rerun, with every pooled divergence robust in the matchup checks. With the primary turn mapping, 11.57% have traversed by turn 3 (previously 9.41%; observed 76.03%), and 20.15% by turn 6 (previously 16.11%; observed 95.51%). Turn 3 mean arcane damage is 0.2208 (previously 0.1899), and mean threatened attack damage is 4.0607 (previously 3.8658). These changes do not establish calibration.

The raw report is saved locally at `/private/tmp/vdb-calibration-20261024/baseline-descendancy-shard.json`. All previous reports are preserved. No batch uses unverified rules, and the Cullingsong → Usurp counterfactual remains separate.

## Next review pair (24 Oct 2026)

Yellow Embrace Sin and red Sinspeaker Gloomblade now have complete, **UNVERIFIED** drafts. Neither is registered for simulation. The private deck has three copies of each: approving and registering both would bring coverage to 49 of 54 copies (90.7%), leaving Cull and Scar for a Scar. The current verified coverage remains 43 of 54; there is no new calibration run. Embrace's next-attack +2 remains outside the engine's scope, so verified card coverage would not mean every damage effect is modelled.

## Embrace and Sinspeaker baseline rerun (24 Oct 2026)

The maintainer approved yellow Embrace Sin and red Sinspeaker Gloomblade, now registered as verified rules. Tests use the registered cards for Embrace's one-resource play and banish permission, and Sinspeaker's conditional, optional search, including declining, failing to find and replaying choices. Other pitches remain unverified. Embrace's next-attack +2 is still not modelled.

Local Supabase was replaced with a copy of the hosted database before this run. An unchanged-rules control on the restored database completed all 10,000 runs and reproduced the previous run's simulated distributions, coverage and comparisons exactly. Its rules-data hash is `3faad417` rather than `253b52ee`; the input data changed, but those results did not. The control is saved locally at `/private/tmp/vdb-calibration-20261024/baseline-descendancy-shard-restored-db-control.json`.

The new run uses the same private deck, observed file, seed `20261021`, baseline script, 10,000 runs and eight turns. All runs completed. Engine version is `0.1.0`, rules data `c5c97003`. Coverage is **49 of 54 copies (90.7%)**, and 19 of 21 distinct cards. This clears the 80% minimum, so the report's `incomplete` flag is false; it does not mean 100% coverage or calibration. Red Cull and Scar for a Scar are the final review pair, with five copies between them.

All threshold verdicts remain unchanged: 16 investigate and 15 within with the primary turn mapping; 18 investigate and 13 within with the other. Every pooled divergence remains robust in the matchup checks. By turn 3, 10.21% have traversed (previously 11.57%; observed 76.03%); by turn 6, 20.82% have traversed (previously 20.15%; observed 95.51%). Turn 3 mean arcane damage is 0.1944 (previously 0.2208), and mean threatened attack damage is 4.0073 (previously 4.0607). More coverage does not make every figure rise under the same script.

The baseline still never activates a Gate or attacks with a weapon, and still pays zero for Descendancy's banish trigger. The search preference is the existing unverified default, not a new tactical policy. No threshold changed; T5 and the Cullingsong → Usurp counterfactual remain separate follow-ups. The new report is saved locally at `/private/tmp/vdb-calibration-20261024/baseline-embrace-sinspeaker.json`; all previous reports and the private deck list are preserved.

## Final review pair (24 Oct 2026)

Red Cull and Scar for a Scar have **UNVERIFIED** drafts with explicit answers for Cull's instant permission and Scar's life comparison. The maintainer approved this input method, not yet the drafts. Neither card is registered, so verified coverage stays 49 of 54 copies (90.7%). Registering both after approval would reach 54 of 54; this draft does not claim that result or run a new calibration batch.

The existing baseline has no opponent-context answers. Once either card is registered, a run that tries to play it must supply the relevant `choices.conditions` entry or stop with a missing-answer error. Fixed answers are assumptions and must be reported as such; there is no default or inferred opponent life. Full card coverage will not remove this limitation, Cull's unmodelled effect on opposing hands, or the earlier combat and policy omissions. Scar also needs a card re-import for its new conditional-go-again fact; no card data was changed locally or remotely for this draft.

## Full verified-rule coverage (24 Oct 2026)

The maintainer approved both final card readings, now registered for red Cull and red Scar for a Scar. The same private deck was resolved against local Supabase and the registered rules: **54 of 54 copies (100%)**, all 21 distinct cards, with no unmodelled cards. Other pitches of the final pair remain unverified. Registered-rule tests cover Cull's hand banish and instant-mode answer, Scar's Yes/No go again, replay, missing script answers and the override of stale natural-go-again data.

This is a coverage check, not a new simulation or calibration result. It is saved locally at `/private/tmp/vdb-calibration-20261024/coverage-full.json`, with rules data `0d49faac`. No opponent-context answers were chosen, no thresholds changed and no previous report was overwritten. The latest 10,000-run report is still the 49-of-54 Embrace and Sinspeaker baseline; its verdicts must not be presented as a full-coverage run.

Before running the full-coverage deck, choose and record explicit `choices.conditions` values for Cull and Scar. The baseline currently supplies neither, so it will refuse a play that needs them. These answers are assumptions, not observed life totals or a tactical policy. Scar's new facts also need a card re-import; no local or hosted card records were changed here. Full verified-rule coverage does not remove the remaining combat, opponent-state, Gate and weapon-policy limits, or mean that the engine is calibrated.

## Four explicit-answer cases (25 Oct 2026)

The maintainer approved running all four combinations of Cull's instant-mode answer and Scar's life-comparison answer. PR 249 was merged after approval, so all 54 copies have registered rules. These cases are **Assumed**, not Observed: each answer is fixed for every play in that run. They do not track changing life totals, prove the condition was legal on each turn, define a tactical policy or bound what real play could achieve.

Each case uses the same private deck, observed file, seed `20261021`, 10,000 runs, eight turns and six checked turns. All **40,000 runs completed**, with zero failures. Coverage is 54 of 54 copies and 21 of 21 distinct cards in every case. Engine version is `0.1.0`, rules data `0d49faac`, source commit `1eb3447`. Card data was read once from local Supabase for all four cases, with no imports, resets or hosted operations.

The script is `baselineScript(8)` with only `choices.conditions` added. `hero_lost_life_this_turn: true` chooses Cull's instant mode every time; false plays it as an action. `less_life_than_opposing_hero: true` gives Scar its conditional go again; false does not. Each raw report saves the full script and labels these fixed answers **Assumed**. The script still never activates Gates or attacks with weapons, pays zero for Descendancy and uses the existing search preference. No tactical policy or threshold changed.

| Cull instant | Scar go again | Traversed by turn 3 | Traversed by turn 6 | Mean arcane, turn 3 | Mean threatened attack, turn 3 |
| ------------ | ------------- | ------------------- | ------------------- | ------------------- | ------------------------------ |
| No           | No            | 7.52%               | 17.12%              | 0.1938              | 3.5150                         |
| No           | Yes           | 8.56%               | 19.16%              | 0.2122              | 3.8154                         |
| Yes          | No            | 9.65%               | 20.78%              | 0.2243              | 4.0828                         |
| Yes          | Yes           | 10.79%              | 23.48%              | 0.2472              | 4.4570                         |

The observed first-traverse shares are **76.03% by turn 3** and **95.51% by turn 6** with the primary turn mapping. None of the four fixed-answer cases removes that gap. The ranges in the table describe these cases only, not upper or lower bounds on a player's results. Threatened damage retains the earlier unmodelled bonuses and combat limits.

All verdicts match the previous 49-of-54 baseline check by check: T1, T4 and T6a are within; T2 and T3 investigate on turns 2–6 with the primary mapping, and T6b investigates on turns 1–6. The other mapping also investigates T2 and T3 on turn 1. Each case has **16 investigate / 15 within** with the primary mapping, and **18 / 13** with the other, with no insufficient-data verdicts. Every pooled divergence is robust in the eligible matchup checks. This is still not a calibrated engine, and no one case is selected as the policy.

The new raw reports are saved locally under `/private/tmp/vdb-calibration-20261025/`: `cull-no-scar-no.json`, `cull-no-scar-yes.json`, `cull-yes-scar-no.json` and `cull-yes-scar-yes.json`. `summary.json` checks their inputs, coverage, completion and assumption labels. All earlier reports and the private deck list are preserved. No private deck list is committed.

The next unresolved work is the Gate and weapon script: turn the maintainer's existing guidance into explicit, reviewed decisions, then run T5 and compare on the same inputs. The final cards' answers are no longer a blocker for a labelled sensitivity run, but these four cases do not replace that policy work or the separate Cullingsong → Usurp counterfactual.
