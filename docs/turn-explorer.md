# Explore one turn's modelled moves

The turn explorer branches over explicit pitches, plays, Gate targets, weapon attacks and ending the turn. It uses the existing rules engine, not manual resource or action-point changes. It is an opt-in diagnostic, not a replacement policy. All results are **Assumed**; the search scope and ordering are **UNVERIFIED**, not optimal strategy.

## Scope

- One engine turn, starting from an action-phase state. A completed line includes its end phase and refill. It stops there, rather than searching the next turn.
- Verified plays from hand, arsenal and face-up banish. The engine checks permission, cost, action points and go again. Pitches are separate moves; the search does not automatically pitch the highest blue.
- Gates, weapon attacks and stopping. Arsenal placement is optional; activated abilities are excluded unless enabled. No equipment abilities, manual actions, combat hits or opponent responses are invented.
- Engine-offered choices: life payments, optional confirmations, card selections, search and Opt. Ordered multi-card selections are explored separately because their event order can matter.
- Explicit Cull/Scar condition answers remain fixed across the explored turn. They are sensitivity assumptions, not inferred opponent state or a dynamically updated life-condition model. `traverseBack` can be a fixed boolean or `"both"`; both branches exist only if the engine offers the return.

The maintainer's Shard protection remains a constraint: it is never selected for a hand-banish choice. Mandatory deck-top banishes are unaffected, and pitching Shard is still allowed. `keep` selectors prevent pitching, playing or choosing those hand cards for effects. A kept card can still be put in arsenal when arsenal placement is enabled. Extra `neverBanish` selectors add restrictions; they do not remove Shard protection.

## Opening-turn CLI

Use the existing local-only comparison CLI with `--explore` and an explicit seed. Save an exploration configuration, separate from the multi-pattern comparison configuration:

```json
{
  "startingLife": 40,
  "conditions": {
    "hero_lost_life_this_turn": false,
    "less_life_than_opposing_hero": false
  },
  "traverseBack": "both",
  "includeArsenal": true,
  "includeAbilities": false,
  "limits": {
    "maxDepth": 6,
    "maxStates": 500,
    "maxAttempts": 5000,
    "maxChoiceBranches": 32,
    "maxChoiceDepth": 32
  }
}
```

```sh
SUPABASE_ANON_KEY=<local-anon-key> node --experimental-transform-types \
  apps/web/scripts/compare-play-patterns.ts --explore --seed 17 \
  --deck deck.txt --config exploration.json --out explored-turn.json
```

This reads local Supabase only, requires verified deck coverage, refuses report overwrites and does not write to the database. The CLI explores the opening turn. In code, `exploreTurn(state, configuration)` in `apps/web/src/calibration/turnExplorer.ts` also accepts a captured mid-turn state or a later turn. Every branch starts from an independent continuation of that same state. It does not silently play earlier turns with an assumed policy.

Reports contain private hand and play information and are saved with user-only permissions. Do not publish a private deck's report accidentally.

## Reading the report

`lines` are completed, replayable lines. Their `actions` use the session action format, with card-copy IDs and all answers recorded. Replaying them with `applySessionAction` reproduces the result. The turn summary gives card names, pitches, Gate targets, attack threat, arcane, self-loss, cards held before refill, refilled hand, tokens, side and floating resources before end phase. `final` is the state after the refill, not the pre-refill hand.

`frontier` contains unfinished prefixes, with a limit reason and a pending action where known. These are not failed or completed turns. A prefix can share earlier actions with other lines; the counts are not disjoint outcomes or probabilities.

`failures` keeps trigger-budget failures separate. Illegal candidate moves are rejected and counted by reason, not reported as successful zero-damage plays. Unknown errors are not turned into legal lines.

The report always says `exhaustive: false`: this is not all of Flesh and Blood. `completeWithinScope` is true only if no search prefix was cut and no trigger-budget failure prevented exploration of the declared engine scope and constraints. Even then, it excludes the opponent, combat and anything the engine does not model.

## Limits and hidden information

The search is deterministic breadth-first enumeration, with no damage score, automatic winner or outcome-based pruning. End-turn moves are offered first, followed by explicit pitches and visible-card actions in stable card-copy order. There is no automatic selection of a line using hidden future draws.

Cards in the hidden deck are not action candidates, even when they have activated abilities. When the engine legally offers an Opt or search choice, the explorer branches over those offered answers. Hidden deck order and face-down banished card names are not included in the visible-state report. Future draws revealed in an ended line are hindsight, not information a policy may use to select its earlier move.

Default limits are shown in the configuration above. Maximums are 16 actions per line, 2,000 generated states, 50,000 engine attempts, 256 generated non-fixed choice-answer prefixes per candidate action and 64 answers within one action. The root counts as a state; ended states also count. Attempts include retries to supply choices and rejected candidates. Fixed condition and fixed return answers do not consume the branching allowance. Choice-depth limits still apply to them.

Different pitch orders and answer histories are not merged. This preserves replay and pitch-stack differences, but can fill the budget quickly. A missing line is **not evidence it is unavailable** when the search was cut. Opt can only do what the current engine supports; this does not add new card-rule interpretations or reorder kept Opt cards beyond that support.

The engine does not stop at notional zero life and does not model incoming damage, blocking or life gain. A completed line is not proof of survival. Threat is printed attack power plus usurp bonuses, with arcane separate; it is not damage dealt or win rate. Do not treat the line counts as frequencies or use these results as observed-data T5/T6 verdicts.

## First replay check

Both latest reviewed hands were explored, along with ten seeded opening hands. All **3,399 ended lines** replayed through the engine. Threat, arcane, self-loss, final hands and tokens, and floating resources in both captured-hand reports matched independent replay checks.

The equal-blue hand produced 486 ended lines and 14 depth-limited prefixes, including both pitch choices for the same Descendancy/Nebula line. The Shard/Usurp hand produced 255 ended lines and 1,491 unfinished prefixes at the 2,000-state cap, including the approved Embrace → Murmuring line. Its known longer two-blue Descendancy line was not reached before the cap; that is a search limitation, not a legality verdict. There were no trigger-budget failures in these checks. Private decks and full captured states are not committed.

See [same-seed pattern comparisons](play-pattern-comparison.md) for comparing declared policies over several turns. That runner remains separate and unchanged by the explorer's move ordering.
