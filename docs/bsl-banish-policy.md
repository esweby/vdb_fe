# Shard protection and Bloodfrenzy priority

## Maintainer decision — 25 Oct 2026

“Never banish shard - banish bloodfrenzy as a priority as it has go again source.”

The opt-in Gate/weapon policy now excludes Arknight Shard from chosen **hand-banish** options and adds Bloodfrenzy Gloomblade as its default banish preference. Explicit caller preferences still precede this fallback; they cannot override Shard protection. Existing kept cards remain protected. The special BSL → banish Descendancy setup retains its earlier priority.

This is a scripted decision, not a card-rule restriction. Shard can still be pitched automatically or explicitly, played where legal, or placed in arsenal. Rules-required deck-top banishment is unchanged: the policy cannot choose a different top card. A general Shard keep rule would also prevent pitching, so it is not used.

If a mandatory hand-banish choice could only select protected Shard, the existing choice validation rejects it and the scripted play is skipped without applying its state changes. It does not play BSL and illegally decline a required banish.

Bloodfrenzy's registered go again conditions remain unchanged. Its priority reflects the maintainer's stated reason; merely choosing it for BSL does not grant unconditional go again.

## Scope and inputs

The generic interpreter gains optional `choices.neverBanish: Selector[]`. It filters hand-banish choices before ranking preferences. Scripts without this field behave as before. This affects neither forced deck-top effects nor choices from other zones.

The non-baseline Gate/weapon modes add Shard protection and the Bloodfrenzy fallback. Baseline mode stays frozen for comparison, as does the default scenario runner. The script inputs record both lists. Caller banish exclusions are retained, not replaced.

The standalone policy ID is `draft-bsl-banish-v1`. The temporary combined checkout uses `draft-bsl-banish-integrated-v1`, identifying its additional, still-unmerged T5 measurement, Forsaken funding and per-turn traverse controls. Historical reports are unchanged. The broader scheduling and unreviewed target order remain **UNVERIFIED strategy**.

## Tests

Regression tests first reproduced Shard being chosen, the missing Bloodfrenzy priority and a BSL play with only protected Shard available. They now cover:

- Shard exclusion despite an explicit preference to banish it.
- A skipped mandatory-banish play when no permitted target remains.
- Explicit and automatic Shard pitching.
- Unchanged forced deck-top effects and scripts without exclusions.
- Parsed and recorded exclusions.
- Bloodfrenzy priority in Gates-only, weapons-only and combined modes.
- Kept Bloodfrenzy, retained Descendancy priority and unchanged baseline mode.

Affected tests, type checking and the web build pass. The first full-suite run found only an old report-input expectation; it was updated to include the new recorded choices and passed on rerun.

The final combined full-suite rerun passed **2,049 tests across 160 files**.

## Review — 26 Oct 2026

Review found an optional-choice edge case: when a two-card hand-banish effect was optional and Shard protection left only one eligible card, the chooser returned an illegal one-card answer and skipped the entire play. A failing regression confirmed that behaviour. The chooser now declines the optional banish legally instead. Mandatory multi-card choices still cannot be partially fulfilled, and their attempted play rolls back.

The two new tests cover both cases. The combined full suite now passes **2,051 tests across 160 files**; type checking and web builds pass in both checkouts. The historical 4,000-run diagnostic below predates this review fix; its source hashes and figures are preserved rather than presented as a new population run. At this local review, no PR had been opened and CI had not run. Publication was authorised afterwards; CI and merge approval remain separate checks.

## Historical paired diagnostic

The temporary combined checkout ran the same four fixed Cull/Scar cases, eight turns, seed 20261021, starting life 40, with the previously used alternating return/hold schedule. These are **Assumed inputs**, not a recommendation to alternate decisions. No incoming damage, life gain or kept cards were supplied in this sample.

All **4,000 completed with zero failures**, zero Shard hand-banishes and **1,164 Shard pitches**. Invariants were checked for every run. Usurp Gates still required an explicit return answer and no already-enabled return; no return occurred on a hold turn. Seed digests matched the prior cohorts.

| Cull / Scar | Complete chains before → after | Delayed completions before → after | Shard pitches |
| ----------- | ------------------------------ | ---------------------------------- | ------------- |
| No / No     | 196 → 198                      | 14 → 18                            | 254           |
| No / Yes    | 207 → 213                      | 18 → 25                            | 285           |
| Yes / No    | 203 → 200                      | 23 → 24                            | 293           |
| Yes / Yes   | 212 → 210                      | 25 → 27                            | 332           |

Some cases have fewer complete chains. The change implements the reviewed choice; it is not claimed to improve every metric or solve the timing gap. This remains a sensitivity check, not a formal T5 verdict for the overall strategy.

Private evidence is `/private/tmp/vdb-bsl-banish-comparison-20261025.json`, with source hashes, rule-data hash, paired seeds and counters. The standalone implementation does not depend on the other three pending pieces. The diagnostic made no database changes or hosted writes and did not commit, push or merge anything.
