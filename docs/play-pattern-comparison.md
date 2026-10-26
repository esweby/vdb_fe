# Compare play patterns on the same seeds

This is an opt-in experiment runner, not a change to Goldfish or the default policy. All results are **Assumed**. The priority variants are **UNVERIFIED strategy**, not recommendations or a claim of optimal play.

Every pattern gets an independent copy of the same initial state for a seed: the same hand, deck order, weapons, equipment and triggers. A pattern cannot change another pattern's run. Later draws can differ because the patterns draw, banish, opt or pitch different cards. A shared seed does not force those later draws to stay identical.

## Included variants

1. **Current:** the reviewed Gate/weapon policy, unchanged.
2. **Keep BSL:** the existing explicit BSL reservation. It applies on every turn; it is deliberately stronger than deciding that a particular BSL is a good next-turn starter.
3. **No automatic sword:** disables Nebula after the general funded Descendancy plan. Other explicitly matched sword examples are unchanged. This is not a blanket weapon ban.
4. **Keep BSL and no automatic sword:** combines those two changes.
5. **No voluntary life payments:** explicitly answers zero to life-payment choices. Blood debt still applies.

These are controlled switches, not algorithms that maximise pressure or minimise self-loss. A custom script can name pitches, order plays, keep cards or stop. It uses the existing script vocabulary and legality checks. This is how to compare a specific efficient-pitch line with the general high-pitch-first policy without changing the policy itself.

## Run it

Save a configuration, for example:

```json
{
  "seeds": [17, 23],
  "turns": 8,
  "startingLife": 40,
  "traverseBack": false,
  "conditions": {
    "hero_lost_life_this_turn": false,
    "less_life_than_opposing_hero": false
  }
}
```

Starting life and both opponent-condition answers must be explicit. The return/hold answer is fixed for this comparison and shared by every pattern. Conflicting answers inside a pattern are rejected. The example's 40 is an input, not inferred hero data.

With local Supabase running and the deck as a normal text list:

```sh
SUPABASE_ANON_KEY=<local-anon-key> node --experimental-transform-types \
  apps/web/scripts/compare-play-patterns.ts \
  --deck deck.txt --config patterns.json --out comparison.json
```

The CLI reads local Supabase only, requires complete verified deck coverage and never writes to the database. It refuses to overwrite an existing report. Report files are private to the current user and contain hand and play information; do not publish a private deck's report accidentally.

Without `patterns`, the CLI uses the five variants above. To supply your own list, add `patterns` to the configuration. A Gate policy entry looks like:

```json
{
  "id": "preserve-bsl",
  "label": "Keep BSL",
  "kind": "gate",
  "mode": "both",
  "decisions": { "reserveBsl": true }
}
```

A custom script entry looks like:

```json
{
  "id": "explicit-line",
  "label": "My explicit pitch and play order",
  "kind": "script",
  "script": {
    "version": 1,
    "choices": { "keep": [{ "name": "Become the Shadow Lord", "pitch": 3 }] },
    "steps": [
      { "do": "pitch", "card": { "name": "Murmuring Gloomblade", "pitch": 3 } },
      {
        "do": "play",
        "card": { "name": "Scar for a Scar", "pitch": 1 },
        "from": "hand"
      },
      { "do": "endTurn" }
    ]
  }
}
```

That is a script-format example, **not a reviewed recommended line**. If a named card is absent or a play is illegal, the report shows the skipped step. The runner does not pretend it succeeded. Custom scripts must include their own end-turn steps and repeats; `turns` does not secretly append plays or end phases. A script that ends fewer or more turns than requested is marked incomplete.

Code can call `comparePlayPatterns(setup, configuration)` in `apps/web/src/calibration/playPatternComparison.ts`. Unlike the CLI, this requires an explicit pattern list; `priorityPatterns()` provides the presets.

## What the report shows

- Each seed's initial hand and every pattern's effective choices and version information.
- Per turn: actual pitches, plays, Gate targets and weapon attacks; printed attack threat plus usurp bonuses; arcane separately; self-loss and cumulative life lost.
- Cards held before refill, the refilled hand, Gate activations, Runechants made, end-turn tokens and hero side, and resources floating as end phase starts.
- Final visible state, remaining deck count, skipped-step reasons, and completed, incomplete or failed status. Hidden deck order and face-down banished card names are not reported.

Failures are not successful low-damage outcomes. There is no combined score or automatic winner. More pressure can cost starters or life; compare those trade-offs directly. Retained cards and tokens describe next-turn resources, not an enumeration of legal next-turn lines.

## What it does not cover

This first version compares **listed patterns only**, not all legal moves. The report always says `exhaustive: false`. It accepts 1–1,000 distinct seeds, 1–16 distinct patterns and 1–20 turns. Custom scripts are limited to eight nested control levels and 5,000 expanded commands; oversized scripts are rejected rather than silently pruned.

There is no search that inspects hidden future cards to choose a move, and no automatic choice of the winning seed-specific script. Normal card effects such as Opt still use their permitted information. Define patterns before looking at fresh results to avoid choosing them with hindsight.

Opponent responses, blocking, incoming damage, life gain and combat hits remain outside this comparison. Threat is not damage dealt or win rate. The engine can continue after a notional life total reaches zero; do not read that as a surviving line in a real game. This does not run the observed-data T5/T6 tests.

A separate [bounded one-turn explorer](turn-explorer.md) now branches over pitches, plays and offered choices. It discloses its limits and unfinished prefixes. This listed-pattern runner still does not search or automatically select a best line.
