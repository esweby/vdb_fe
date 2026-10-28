# FaBlazing game data: plan

Status, 28 Oct 2026: steps 1, 2 and 4 are done; step 3's pipeline is live, its first scheduled run and the hosted history load are confirmed, and the three missing backfill days were fetched whole by the Lambda later the same day (see [Operations check, 28 Oct 2026](#operations-check-28-oct-2026)). Step 5 has compared T1–T4 on the maintainer's deck, with incomplete coverage. T1–T5 were approved on 21 Oct; T5 waits for the Gate-target list and T6 remains a draft. See [engine-calibration.md](engine-calibration.md) for the results and next steps. The operational checklist below dates from 21 Oct; items without a recorded outcome remain to be checked. Any reading of game logic is **unverified** until the maintainer checks it.

## Decision

**Go handles the data pipeline. TypeScript owns the single rules engine** ([fab-engine](https://github.com/esweby/fab-engine)). There will be no second rules engine in Go. Simulation and replay checks share that one rules core.

The decision is closed. It's reopened only if **all three** of these hold:

1. The TypeScript engine's simulation throughput is shown to be too slow for the questions being asked.
2. Calibration can't answer those questions.
3. Compiling the same rules core another way (for example the TypeScript engine built to WASM) has been tried and failed.

## Why do it

FaBlazing publishes a file each day of public Talishar games: about 8,200 Classic Constructed games, with each player's full decklist, how each card was used, life totals turn by turn, and an ordered log of actions. On 20 Oct, Viserai appeared in 928 player-sides, 835 of them with full detail.

The app has opinions (scores), card facts and simulations. This adds **evidence** about real games. A decklist site shows what people build; this shows what happens when those decks are played.

Two rules apply throughout:

- **Logs show associations. The TypeScript simulation tests counterfactuals.** Words like "causes" or "makes you win" are kept for results where the simulation confirms what the logs suggest.
- **A chain completing doesn't mean it was worth it.** Track game state, tempo spent and incremental win probability, not just completion. A chain can complete and still only pile on in games that were already won.

## What the audit found

Full detail is in [fablazing-data-dictionary.md](fablazing-data-dictionary.md). The parts that shape this plan:

- **Viserai is one hero.** `playerHero` is the side Viserai ended the game on, and each traverse is a `TRANSFORM` event. Counting is by hero; the side at the end and the traverse timing are features of each game.
- **The key is `game_guid`.** `game_id` gets reused. 78 guids are recorded twice, as later snapshots of the same game, so the latest is kept.
- **What's logged as events:** cards played, pitched, blocked with, hits, Gates used, and traverses.
- **What's logged as state:** life totals for both players, plus damage and resources for each turn index (a round: one turn for each player).
- **Not logged and can't be reconstructed:** draws, hand, arsenal, the banished zone, which zone a card was played from, Runechants and Blood Debt state. Reconstructing them would need the deck order, which isn't recorded, so the council's reconstruction fallback isn't available.
  - **Consequence:** chains are written only in terms of logged events. Any inference, such as "a blood debt card played right after a Gate was used was played through it", is a **proxy** and is labelled as one. Chains that depend on hidden state are out of scope.
- **Sample depth is enough by matchup.** Within 30 days, 34 matchups reach 50 or more games, and together they cover every game. Depth for chains by matchup is only known once each chain is measured.
- **There's no rules-version field.** The last ban and restricted update came before Viserai's release (the maintainer, 21 Oct 2026), so all Viserai data so far sits in **one rules window**, starting from the first day Viserai appears in the data. Later changes go into a dated list (`fablazing_rules_windows`), and every game is tagged by date.
- **About 9% of sides have no detail.** They count for matchups and results only.
- **Early concessions are almost never high rolls.** Of the 234 early concessions with life data, only 4 conceders were at 20 life or below. The light-touch rule: an early concession counts as a result only if the conceder took real damage (the proposal is life ≤ 20 within 2 turns). Otherwise the game is **abandoned**: kept for decklists, left out of results. The maintainer accepted this rule provisionally on 21 Oct 2026.

## Steps

### 1. Data audit: done, with open questions

The deliverable is [fablazing-data-dictionary.md](fablazing-data-dictionary.md). It still waits on two things:

- **FaBlazing's answers (21 Oct 2026):** sides without detail are players who turned off stats; duplicates are probably undo-then-finish, so the latest is kept; `firstPlayer` 1 means went first. What the action codes mean is a question for Talishar's developers and is still open.
- **From the maintainer:** nothing outstanding. There are no ban or errata changes since Viserai's release.

### 2. Prove one chain through the command line: done

The code is in `services/fablazing`, written test first:

- `pyliteral`: parses FaBlazing's Python literal text, and JSON too.
- `game`: reads a CSV into games and player-sides, deduplicates by guid, marks abandoned games and treats Viserai as one hero.
- `chain`: chains are **specs written as data**, which makes them the prototype of the chain library's schema. A spec is ordered steps, each with an action, a card or card set, and a timing window. Matching finds the attempt that gets furthest.
- `cmd/fablazing`:
  - `game` prints a game turn by turn, for example "Turn 2: Played become_the_shadow_lord_blue … Turn 3: Played gate_to_iarathael. Played demonbound_gloomblade_red".
  - `chain` measures a chain across games.

The first chain is `chains/bsl-gate-blood-debt.json`: Become the Shadow Lord played → a Gate used within 2 turns → a blood debt card played in the same turn. **The tool refuses to measure a chain until its expectation is written down.**

**Done when:**

- the maintainer has written the expectation for the first chain
- the card sets (such as `blood_debt`) come from our card facts, exported by the TypeScript importer, rather than a hand list
- the chain has been measured once on real data, with the results compared against the expectation

All three are met (PR 200). Nine chains have now been measured; see step 4.

### 3. Quick-win stats

The Go Lambda sends basic aggregates to the app, such as inclusion rates and win rates. Guardrails:

- **Minimum sample of 50 games** before a number is shown.
- **Matchup context on every number:** each figure is shown for a matchup, or with the meta share it's averaged over.
- **Rules-window tags** from step 1.
- Wilson intervals on every rate; abandoned games left out of results; one player's weight capped: each player's earliest 20 games per day and format count, and the rest are left out (the maintainer, 21 Oct 2026). The cap is per day rather than per window so that no player hashes are stored between runs. On 20 Oct heavy players won more than average from their first games, and only in Classic Constructed did they win less after game 20. Recheck that with a month of data before changing the cap.

The first places these appear:

- card pages: "In real games"
- matchups: real win rates and meta share
- Effect drafts: ordered by real plays per game

**Pipeline:**

```
EventBridge Scheduler, daily 10:00 UTC
  → Go Lambda "fablazing-ingest" (eu-west-1, beside Supabase)
      fetch yesterday's final file for formats 0 and 1 → parse → deduplicate → filter
      → filtered raw records to S3 (gzipped NDJSON per date and format)
      → aggregates to Supabase as the fablazing_ingest role (writes only fablazing_* tables),
        replacing each date and format whole
      → a row in fablazing_runs (counts, unmatched slugs)
  → CloudWatch alarm on error → email
```

- **Raw records go to S3, aggregates to Postgres.** Viserai's detail would come to about 1 GB a year in Postgres, which is too much for the free plan's 500 MB. S3 also lets us rebuild the aggregates without downloading from FaBlazing again.
- **Slugs are mapped to our cards in Postgres,** through `fablazing_card_map`, which the TypeScript importer fills. Go doesn't need to know our cards.
- **Secrets** live in SSM. Deploys use GitHub OIDC. Logs record counts only.
- FaBlazing is volunteer-funded, so each final day is fetched once, and any backfill is paced as they prefer.

The AWS side (the Lambda, the raw bucket, the schedule, the alarm and the deploy roles) is in `services/fablazing`, with a runbook in [its README](../services/fablazing/README.md).

**Tables** (each with grants, row level security and pgTAP tests):

| Table                     | What it holds                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `fablazing_runs`          | one row per date and format: status and counts                                          |
| `fablazing_card_map`      | slug → our variant or hero                                                              |
| `fablazing_card_daily`    | per card per day: inclusion, copies, played, pitched, blocked, hits, wins when included |
| `fablazing_matchup_daily` | per matchup per day: games, wins, abandoned                                             |
| `fablazing_turn_daily`    | per turn per day: damage and life sums and counts                                       |
| `fablazing_rules_windows` | the dated ban and errata list                                                           |

### 4. Chain library and measurement, pre-registered

1. Define 5–10 Viserai chains in terms of **logged events only**.
2. For each chain, **write down what it's expected to do before measuring it.** The maintainer writes these, since they're game logic. With 5–10 chains and several metrics each, some patterns will look significant by chance.
3. Measure, with confidence intervals:
   - how often the chain occurs
   - how often the setup succeeds
   - how often the payoff happens
   - turns from setup to payoff, as a median and a tail, never a mean
4. Define **"valuable"** as the incremental win probability when the payoff happens, compared with setups that don't reach a payoff, **conditioned on game state**. The state is the life totals at the setup turn, which are logged. This separates chains that win games from chains that only pile on in games already won.

### 5. TypeScript engine calibration, with thresholds set first

1. **Before comparing anything, set pass and fail.** For example: investigate if the median simulated damage on turn N falls outside the observed 95% interval, stratified by matchup and game state.
2. Calibrate **distributions**, not single numbers: damage by turn, traverse timing, and how fast chains complete.
3. Then test alternative lines in the simulation (skip the setup, miss the payoff, leave Blood Debt in the banished zone) and compare them against the observed logs.
4. A divergence means investigating missing rules, unrealistic scripted decisions or differences in the data. **It never means adjusting the thresholds after the fact.**

### 6. Expand only when it's justified

There's no general synergy framework until the chains show what the data actually needs to represent. The ideas from the first draft wait for evidence that they're worth building:

- the field core next to the user's core
- gap percentiles from winning lists
- co-occurrence lift between cards
- comparing a deck with the field

## Status of steps

| #   | Step                      | State                                                                                                                                                                                                                                                      | Waiting on                                                                              |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Data audit                | Written ([fablazing-data-dictionary.md](fablazing-data-dictionary.md)); FaBlazing answered on 21 Oct                                                                                                                                                       | What the action codes mean: a question for Talishar's developers                        |
| 2   | One chain through the CLI | Done (PR 200)                                                                                                                                                                                                                                              | —                                                                                       |
| 3   | Quick-win stats           | **Pipeline live** (PRs 201, 203–206): a Go Lambda daily, raw games in S3, aggregates in Supabase as `fablazing_ingest`. History load (PR 211) and app views (PR 212) merged; the hosted history load ran on 21 Oct; first scheduled run checked on 28 Oct. | —                                                                                       |
| 4   | Chain library             | Eleven chains measured on 30 days, with and without the player cap ([fablazing-chains.md](fablazing-chains.md)); card sets come from the importer (PR 209)                                                                                                 | —                                                                                       |
| 5   | Engine calibration        | T1–T5 approved; T1–T4 compared on the maintainer's deck. Coverage is incomplete (54% of copies). Results in [engine-calibration.md](engine-calibration.md).                                                                                                | More verified cards; Gate targets and caveats for T5; weapon policy; approve or drop T6 |
| 6   | Expand                    | —                                                                                                                                                                                                                                                          | Evidence from steps 4 and 5                                                             |

## Next steps

In the maintainer's order (21 Oct 2026):

1. **Check the first live run** (22 Oct, after 10:00 UTC): the Lambda logs, the `fablazing_runs` row, the aggregate rows and the S3 object. **Done (28 Oct):** it ran at 17:30 UTC on 22 Oct, as planned, and succeeded.
2. **Retry the three missing backfill files:** 18 Oct format 1, and 19 Oct formats 0 and 1. FaBlazing rate-limited us (HTTP 429), so leave a minute between files and back off on a 429. **Done (28 Oct):** 18 and 19 Oct were fetched whole by the Lambda instead.
3. **Load history into Supabase** from the 30 days we downloaded (`~/.cache/vdb/fablazing/viserai/`). Those files hold only games with Viserai, so they're complete for Viserai's cards, turns, traverses and Viserai's own matchups and meta share. **Other heroes' matchups must not be written from them,** because those would be partial. Full matchups build up from the daily runs. **Done (28 Oct):** loaded on 21 Oct, Viserai's matchups only.
4. **Step 3's app views:** "In real games" on card pages; Viserai's real win rates and meta share on matchups; Effect drafts ordered by real plays per game; how fresh the data is. Guardrails: n ≥ 50, matchup context, Wilson intervals.
5. **Tidy the chain library:** the player cap in the chain tool, card sets moved to the importer's export, and the two Open the Gate chains (expectations first). **Done (PR 209).**
6. **Step 5, engine calibration:** thresholds written and T1–T5 approved before comparison; T1–T4 results recorded on 23 Oct. Next: raise card coverage, agree the Gate and weapon policy, decide T6 and run again on the same seed. Thresholds stay fixed.
7. **Housekeeping:** narrow the `viserai.decks` IAM user from AdministratorAccess now that the stack exists. **Done (PR 213):** day-to-day `--profile vdb` is narrowed; admin is `--profile vdb-admin`.

Items 1 and 2 wait for 22 Oct. Items 3 to 7 can run in parallel.

### Operations check, 28 Oct 2026

Checked read-only on 28 Oct 2026. AWS evidence is from eu-west-1 as `viserai.decks` (`--profile vdb`). Supabase evidence is from the hosted project (`gmqdtqgkqygepsbrgomk`) through its public REST API, which can read every FaBlazing table. S3 times below are UTC.

**1. The first scheduled run: done, 22 Oct 17:30 UTC, succeeded.**

The first run was moved to 17:30 UTC on 22 Oct on purpose (commit `b9cd262`: FaBlazing's egress alert counts a rolling 24 hours, and the backfill ran until about 16:45 on 21 Oct). The stack went back to `cron(0 10 * * ? *)` at 19:00 UTC on 22 Oct (`8f6ee5f`). So there was no 10:00 run on 22 Oct, by design.

- **Log stream** `2026/10/22/vdb-fablazing-ingest[$LATEST]7e5a83e5313b4c92881c43e18201cfe0`, 17:30:48–17:31:05 UTC, request `bb6ada48-18d6-401a-b96e-5b557f3313d3`, 17.3 s, 578 MB of 1,024 MB. It wrote 21 Oct:
  - format 0: 4,637 rows, 4,555 games, 481 kept, 487 Viserai sides; 304 card, 1,118 matchup, 37 turn and 42 traverse rows
  - format 1: 2,973 rows, 2,967 games, 286 kept, 291 Viserai sides; 226 card, 944 matchup, 27 turn and 42 traverse rows
- **S3:** `raw/date=2026-10-21/format=0.ndjson.gz` (1,154,211 bytes) and `format=1.ndjson.gz` (676,546 bytes), both 17:31 UTC.
- **Supabase:** `fablazing_runs` for 21 Oct, both formats `succeeded`, `scope = all`, no unmatched slugs, written 17:30:59 and 17:31:05.
- **Scheduler and alarm:** EventBridge Scheduler shows one invocation attempt a day from 22 Oct and no target errors or dropped invocations. Lambda `Errors` is 0 every day from 21 to 27 Oct. The alarm `vdb-fablazing-ingest-errors` has only ever gone from INSUFFICIENT_DATA to OK (21 Oct 15:51 UTC).

The daily runs since then, all `succeeded` with no unmatched slugs:

| Data for | Run (UTC), log stream         | S3 format 0 / 1 (bytes) | Games, format 0 / 1 |
| -------- | ----------------------------- | ----------------------- | ------------------- |
| 22 Oct   | 23 Oct 10:00:48, `…a1cc3c80…` | 1,215,505 / 560,337     | 4,671 / 2,984       |
| 23 Oct   | 24 Oct 10:00:48, `…d6e459bc…` | 1,027,543 / 569,149     | 4,218 / 2,842       |
| 24 Oct   | 25 Oct 10:00:48, `…f7fee3fb…` | 763,459 / 296,749       | 3,297 / 2,053       |
| 25 Oct   | 26 Oct 10:00:48, `…e9ab8ebd…` | 886,601 / 292,800       | 3,318 / 2,046       |
| 26 Oct   | 27 Oct 10:00:48, `…5a1a928e…` | 1,048,347 / 452,922     | 4,583 / 2,944       |
| 27 Oct   | 28 Oct 10:00:48, `…57efaa01…` | 1,200,300 / 506,576     | 4,754 / 3,017       |

Short log stream names are the run id's first 8 characters; each is `YYYY/MM/DD/vdb-fablazing-ingest[$LATEST]<id>`.

**2. The three missing backfill files: not fetched at first; done later on 28 Oct (below).**

- The local cache `~/.cache/vdb/fablazing/viserai/` has 57 of the 60 files. `format1_2026-10-18.csv`, `format0_2026-10-19.csv` and `format1_2026-10-19.csv` are still missing (newest file there: 21 Oct 17:42).
- Hosted Supabase has no rows for 19 Oct in any FaBlazing table, and none for 18 Oct format 1.
- S3 has no raw files before 20 Oct: the bucket holds `raw/date=2026-10-20` to `raw/date=2026-10-27` only. The Lambda writes S3, and the backfill was never stored there.

**3. The hosted history load: done, Viserai only.**

- `fablazing_runs` has 55 rows with `scope = viserai`, 21 Sep to 18 Oct, all `succeeded`, written 21 Oct 19:27:46–19:28:01 UTC. That is 57 files less the 20 Oct pair, which was loaded whole (`scope = all`, 19:27:44–45).
- Row counts on 28 Oct before that day's run, 21 Sep to 18 Oct / 20 to 26 Oct: `fablazing_card_daily` 16,459 / 3,890; `fablazing_matchup_daily` 2,269 / 14,474; `fablazing_turn_daily` 1,646 / 415; `fablazing_traverse_daily` 2,456 / 554. Totals: 20,349, 16,743, 2,061 and 3,010. `fablazing_card_map` has 1,095 rows and `fablazing_rules_windows` 1.
- **Other heroes' matchups weren't written from the Viserai-only files:** of the 2,269 matchup rows from 21 Sep to 18 Oct, none has a `hero` other than `viserai`. From 20 Oct on, 14,003 of 14,474 do, as expected for whole days.
- The gaps follow item 2: 19 Oct (both formats) and 18 Oct format 1 have no rows.

**For the maintainer:**

- Nothing is broken: no failed runs, no errors and no alarms.

**Backfill of 18 and 19 Oct, 28 Oct 2026.** On the maintainer's go-ahead, the Lambda was invoked with `{"date":"2026-10-19"}` at 10:10:53 UTC and with `{"date":"2026-10-18"}` at 10:14:34, 3½ minutes apart. Both runs were in log stream `2026/10/28/vdb-fablazing-ingest[$LATEST]e454cb1ca9e5407b9aed3398f2b77fa6` and both succeeded:

| Date   | Request    | Format | Games | Viserai sides | S3 key (bytes)                                       | Card / matchup / turn / traverse rows | Unmatched slugs       |
| ------ | ---------- | ------ | ----- | ------------- | ---------------------------------------------------- | ------------------------------------- | --------------------- |
| 19 Oct | `b0a3f1f7` | 0      | 4,132 | 487           | `raw/date=2026-10-19/format=0.ndjson.gz` (1,121,193) | 301 / 1,138 / 25 / 46                 | —                     |
| 19 Oct | `b0a3f1f7` | 1      | 2,820 | 267           | `raw/date=2026-10-19/format=1.ndjson.gz` (606,324)   | 269 / 974 / 31 / 35                   | `jarl_vetreidi~BLIND` |
| 18 Oct | `4ae3feef` | 0      | 3,441 | 342           | `raw/date=2026-10-18/format=0.ndjson.gz` (800,060)   | 276 / 1,124 / 26 / 44                 | `redwood_hammer`      |
| 18 Oct | `4ae3feef` | 1      | 1,951 | 221           | `raw/date=2026-10-18/format=1.ndjson.gz` (478,304)   | 188 / 919 / 22 / 36                   | —                     |

- All four `fablazing_runs` rows are `succeeded` with `scope = all`, so these days hold every game, not only Viserai's. 18 Oct format 0 replaced its Viserai-only rows; its Viserai side count is the same as before (342).
- The alarm `vdb-fablazing-ingest-errors` stayed OK.
- The history now has no gaps from 21 Sep to 27 Oct. 21 Sep to 17 Oct is Viserai only; 18 Oct on is whole.
- Two slugs aren't mapped yet (`redwood_hammer`, `jarl_vetreidi~BLIND`). They're left for the importer's card map.

## Risks

- **Rate limits.** The 30-day backfill hit HTTP 429 and a 500 from FaBlazing. Fetch slowly, and back off on errors.
- **API changes.** FaBlazing gave permission to use the data on 21 Oct 2026. The API is v1, run by a volunteer, with no licence, so credit them, keep our own filtered history in S3, and version the parser (it already accepts JSON as well as Python literals).
- **Hidden state.** Chains that depend on the banished zone or Runechants can't be measured from logs. Only the simulation can speak to them.
- **Small samples for chains by matchup.** Minimum sample sizes and intervals apply, and "not enough data" is shown rather than a number.
- **Online play isn't tournament play.** Report Competitive CC separately and weight it more heavily.
- **Chasing the numbers.** Evidence is shown next to the scores, never mixed in silently.
- **Privacy.** Player hashes are used only for capping and are never shown. Only aggregates are public.

## Open questions

**For the maintainer:**

1. The expectation for the first chain, and the next 4–9 chains.
2. Soul of Existence's "purple" pitch: what it means, and how it's stored. The decision to store it is made.

**For FaBlazing** (permission to use the data was given on 21 Oct 2026): a backfill pace, and questions 1–5 in the data dictionary.
