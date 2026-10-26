# Explicit traverse-back and hold decisions

The calibration runner can now take an explicit return/hold answer for each engine turn. It does not judge momentum, compare starters, estimate incoming damage or decide whether returning is worth a Gate. The new general target order and pitch choices are **UNVERIFIED strategy**, not a change to card rules.

This is policy `draft-gate-weapon-turn-decisions-v2`, based on main after the Shard/Bloodfrenzy banish policy, T5 measurement and Forsaken funding changes. It is opt-in through the existing Gate/weapon batch API, not the default scenario or Goldfish policy. Historical v1 policy results below remain frozen and are not presented as a rerun of v2.

## Inputs

```ts
runGateWeaponBatch(setup, {
  runs: 1000,
  seed: 20261021,
  turns: 3,
  mode: "gates",
  startingLife: 40,
  traverseBackByTurn: { 1: false, 2: true, 3: false },
  choices: {
    conditions: {
      hero_lost_life_this_turn: false,
      less_life_than_opposing_hero: false,
    },
    keep: [{ name: "Become the Shadow Lord", pitch: 3 }],
  },
});
```

`false` means hold Usurper when the end-phase return is offered; `true` means accept it if the rules offer it. These are **absolute engine-turn numbers**, including when resuming a state at a later turn. They are not opponent turns or offsets from the resumed state.

The answer for a turn comes from, in this order:

1. That turn's own entry in `traverseBackByTurn`.
2. An explicit fixed `decisions.traverseBack` answer.
3. An explicit fixed `choices.optional["viserai-usurper-traverse"]` answer.

When a schedule is supplied, every requested turn must have an explicit answer, either in the schedule or through a fixed fallback. Missing answers and invalid keys/values are errors before play starts. Inherited object properties do not count as recorded decisions. The schedule is recorded as JSON in the policy's **Assumed** inputs, alongside fixed decisions and starting life.

Without any explicit return controls, the old optional-trigger default is retained for compatibility. It is not presented as a judgement about momentum, and it never enables the new Usurp Gate plan. A replay check against the old policy verified 400 complete runs, including their state, steps and full trace, unchanged apart from the new zero-valued match counter.

The baseline mode remains the original script. It rejects the new per-turn schedule rather than silently ignoring it. A fixed baseline answer can still be set through `choices.optional`, as before. Weapon-only mode can honour return/hold answers but does not activate a Gate.

## What the answer controls

The same answer is used for candidate selection and every script fragment's end-phase return, including baseline play steps inside the opt-in runner. A fixed `decisions.traverseBack: false` therefore prevents an otherwise eligible return after BSL or a Gate; it no longer affects only the old exact Bloodfrenzy selector.

An explicit back answer is permission to try a legal return line, not permission to invent a return. The hero must be Usurper and the registered end-phase conditions must be met. A hold answer does not prevent a rules-required Forsaken → Usurper traverse.

### Avoid wasting a Gate

If a Gate has already been **created or activated this turn**, Usurper's return is already enabled. The runner does not spend another Gate on an already-playable Usurp card to enable it again. This check applies to both the old exact traverse-back example and the new general plan. Merely having a Gate left over from a previous turn is not enough to enable returning now.

### General Usurp return line

After the existing examples and Descendancy plans, the runner can try a face-up, verified blood debt Usurp attack already playable from banish. It requires an explicit back answer, Usurper, an action point, a Gate and enough resources for **Gate → play that attack**. It never activates just the Gate when the attack cannot be funded.

Pitch comes only from non-kept hand cards, highest pitch first with hand-order ties. The planner accounts for Shard's Runechant when checking known discounts. Target order is banished-zone order; it is not an estimate of the best target. Explicit kept cards stay protected, including a held copy identical to the selected banished card. The play step specifies the banished zone.

The line does not require a sword, force the turn to end, require a Runechant merely to pay Usurp if able, or grant go again. Existing weapon decisions and the registered rules handle subsequent play. It does not gate non-Usurp cards through this new plan. Descendancy keeps its existing higher priority and its separate life, first-attack and affordability guards.

`explicit-usurp-traverse` counts completed Gate → attack fragments, not end-phase returns, wins or T5 chains. Actual returns and chain timing are measured separately from the trace. A Gate created by BSL can enable a return without this fragment matching at all.

## Diagnostic sample (25 Oct 2026)

The private 54/54-covered deck was run for eight turns, seed 20261021, starting life 40, under all four fixed Cull/Scar answers. Three explicit schedules were tested: hold every turn, back every turn, and hold on odd turns/back on even turns. Each schedule/case has 1,000 runs: **12,000 completed, no failures**. These schedules are **Assumed experimental inputs**, not inferred or recommended player decisions. No incoming damage, life gain or kept cards were assumed in this sample; kept-card protection has separate tests.

The same seeds were verified across schedules. Every actual Gate activation on a Usurp card was checked for an explicit back answer, Usurper side and no earlier Gate creation/activation that already enabled return. Every return to Forsaken was checked against that turn's answer. There were no redundant Usurp Gates and no returns on hold turns.

Figures below are in No/No, No/Yes, Yes/No, Yes/Yes Cull/Scar order. Counts are per 1,000 runs. A run can apply a fragment or return more than once.

| Schedule  | New Usurp Gate fragments | Actual returns to Forsaken | Complete BSL chains   | Delayed BSL completions |
| --------- | ------------------------ | -------------------------- | --------------------- | ----------------------- |
| Hold      | 0 / 0 / 0 / 0            | 0 / 0 / 0 / 0              | 184 / 195 / 185 / 195 | 3 / 6 / 6 / 7           |
| Back      | 5 / 4 / 6 / 7            | 225 / 226 / 233 / 235      | 188 / 195 / 190 / 196 | 7 / 7 / 10 / 9          |
| Alternate | 12 / 14 / 18 / 19        | 136 / 141 / 154 / 155      | 193 / 203 / 201 / 208 | 12 / 15 / 21 / 21       |

Alternating these fixed answers exercises more delayed completions than either fixed schedule in this sample. That is a sensitivity result, not a claim that alternating is good play. Returning every turn is not assumed to be the solution to the timing gap. No formal T5 verdict or threshold change is claimed for the unverified strategy.

The report is `/private/tmp/vdb-traverse-decisions-20261025.json`. It records schedules, source hashes, rules data `0d49faac`, paired-seed digests, match counts, actual returns and chain timings. The experiment is based on `3716bb4`; it does not silently incorporate the separate, unmerged Forsaken-funding extension or depend on publishing the T5 measurement. The local trace measurement helper's hash is recorded separately. No private deck list, player details or game records are committed, and no database records are changed.

## Separate combined check

The three pending pieces were also checked together locally: T5 measurement, Forsaken Descendancy funding and these return controls. All 12,000 unique cases completed with no failures; 12,000 native-batch replays matched the instrumented reports. There were no returns on hold turns or redundant Usurp Gates. The full TypeScript suite passed 2,030 tests, and four additional integration tests passed separately. Type checking, the web build, formatting and full Go tests/vet passed.

Complete-chain counts for Hold / Back / Alternate were respectively **186, 198, 187, 199** / **192, 203, 196, 206** / **196, 207, 203, 212**, in the same Cull/Scar order as above. Same-turn shares remained **88.21–97.85%**, far above the observed pooled 41.47%. This is still an unverified sensitivity result, not calibration or a recommendation to alternate answers.

This does not replace the standalone sample above or add a dependency to this branch. The separate report is `/private/tmp/vdb-calibration-integration-20261025.json`; source hashes identify the combined runtime. Assembly notes and four integration tests are in `/private/tmp/vdb_fe-calibration-integration/docs/calibration-integration.md`. Original worktrees remain separate, with no merge or hosted-data changes.

## Publication check — 26 Oct 2026

The final v2 patch is based on main at `03011b1`, after #261–#263. It retains the merged Shard/Bloodfrenzy banish policy, native T5 measurement and bounded Forsaken funding. Historical v1 and combined figures above remain frozen.

With no explicit return controls, **400 current-main replays** matched the original state, steps and full trace, apart from the new zero-valued fragment counter. A further **4,000 alternating-schedule cases** completed with no failures and exactly reproduced the previous combined banish-policy cohort's chain counts and counters: 198 / 213 / 200 / 210 completed chains, including 18 / 25 / 24 / 27 delayed completions in Cull/Scar order. These are replay checks on the same seeds and assumptions, not a new tactical comparison or a recommended schedule.

Every return respected that turn's answer. Every Usurp Gate required an explicit return answer, Usurper and no earlier Gate creation or activation that already enabled returning. There were no Shard hand-banishes; Shard remained pitchable. The native T5 flag still leaves play unchanged. Tests also cover held identical copies, kept cards, missing/invalid schedule answers, absolute turn numbers, Descendancy priority and weapon-only mode.

Private evidence is `/private/tmp/vdb-traverse-publication-check-verified-20261026.json`. The raw report is preserved; the verified derivative records its hash and corrects an inherited base-commit metadata field to the actual rebased HEAD. Runtime source hashes, inputs, counters and trace assertions are unchanged. No hosted records or card rules changed.

The final full suite passed **2,047 tests across 158 files**, including 143 affected tests. Type checking, web build and changed-file formatting pass. An initial broad run had six unrelated UI failures while the diagnostic was running; the unchanged tests all passed on repeat after it finished. No unrelated app changes were made.

## Player decisions still required

Whether to hold or return still needs a real decision: hand quality, the next starter, remaining Gates, card advantage, opponent pressure and momentum. The runner now represents that decision consistently; it does not supply a fabricated answer. The safe next comparison is a reviewed set of actual per-turn decisions or concrete worked situations, not a bigger run of assumed always-back choices.
