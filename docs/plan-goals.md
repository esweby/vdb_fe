# Plan goals and fair comparisons

Task 7c, decided by the maintainer on 28 Oct 2026.

## Plan goals

A sideboard plan can have up to 10 goals. A goal names one scenario, either a built-in or a saved scenario the owner can see (their own or the library's), and a target success rate from 1% to 99%. For example, "this scenario succeeds in at least 40% of runs".

The app suggests no targets. Which scenarios and rates matter for Flesh and Blood is the owner's call. The 40% in this doc and in the tests is an example, **UNVERIFIED** as strategy.

Goals are stored in `plan_goals`, one row per goal on a `deck_loadouts` plan (never the default loadout). Row level security makes them owner only, like the plans themselves. Deleting a plan deletes its goals. A deleted saved scenario takes its goals with it. A built-in that's renamed or removed leaves its goal showing "A scenario that's no longer available". Deck versions don't copy goals.

## Checking goals

**Check goals** runs every goal's scenario 10,000 times on the plan as it is on screen, saved or not, and 10,000 times on what it's compared with: the main deck by default, or another saved plan. Built-ins run without weapons and equipment, as on the Scenarios tab. Saved scenarios see them, as in Saved scenarios.

Both sides use the same seed (1), so run _i_ on the plan and run _i_ on the other deck share a shuffle seed. Each run is a pair, as with the paired play-pattern comparison (#267). Decks of a different size or makeup still shuffle differently, but pairing keeps the comparison fair and usually tighter.

### Goal against its target

The plan's rate gets a 95% Wilson interval (`wilson` in `apps/web/src/fablazing/stats.ts`).

- **Met**: the whole interval is above the target.
- **Not met**: the whole interval is below the target.
- **No clear answer**: the interval includes the target.

### Plan against the main deck or another plan

From the pairs, count the runs where only the plan succeeded (`onlyA`) and only the other side succeeded (`onlyB`). With _n_ runs:

- difference = (onlyA − onlyB) / n
- standard error = √(onlyA + onlyB − (onlyA − onlyB)² / n) / n
- 95% interval = difference ± 1.96 × standard error

If the interval includes 0 the result reads "No clear difference". Otherwise it reads "Higher by" or "Lower by" a number of points. Results are given in words, never by colour alone.

The code is `pairOutcomes`, `pairedDifference`, `differenceVerdict`, `goalVerdict` and `runGoals` in `apps/web/src/decks/planGoals.ts`, tested in `planGoals.test.ts`. The scenario engine reports each run's outcome through the `onRun` option of `runScenario`.

## Real games

Real-game (FaBlazing) rates keep their own guardrails, and real-game goals aren't part of this task.

- A rate needs at least 50 games (`MIN_GAMES`). Below that the app says "not enough data".
- Every rate has a 95% Wilson interval.
- Two rates are called different only when their intervals don't overlap. Otherwise there's "no clear difference".

`compareRealRates` in `apps/web/src/fablazing/stats.ts` applies these rules. The card page's "In real games" panel already showed a card's win rate next to all of Viserai's decks. It now uses this helper to say whether they differ. The card's decks are part of all of Viserai's decks, so the two rates aren't independent. The overlap rule is a cautious reading, not a formal test. These are associations, never causes.

## Limits

- One seed per check, so a check repeats exactly. A different seed could move a borderline result.
- A scenario that can't run on one side, for example one that fixes more copies than the deck has, shows why instead of a result.
- Each goal is judged on its own. Ten goals each at 95% will, by chance, sometimes give one wrong call.
