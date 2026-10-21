# FaBlazing data dictionary

The data audit: step 1 of [fablazing-plan.md](fablazing-plan.md). It's based on one day of data (20 Oct 2026, formats 0 and 1, 8,213 rows), read with `services/fablazing`.

- **Confirmed** means checked in the data.
- **Inferred** means it fits the data but FaBlazing hasn't confirmed it.
- **Unknown** means it's still open.

## Source

`GET https://fab-insights.azurewebsites.net/api/v1/download_csv?format=<n>&date=<YYYY-MM-DD>` with header `x-functions-key`. It returns JSON with `download_url` (a short-lived signed URL), `expires_at`, `blob_name`, `format`, `date` and `version` (`v1`). Today's file is rewritten hourly and is final after midnight.

| Format              | Code | Rows on 20 Oct | Size   |
| ------------------- | ---- | -------------- | ------ |
| Classic Constructed | 0    | 4,984          | 133 MB |
| Competitive CC      | 1    | 3,229          | 85 MB  |

## Rows (one per game)

| Column                                  | Meaning                                                                                      | Status                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `game_guid`                             | Unique game id. **The key.**                                                                 | Confirmed: 8,122 distinct in 8,213 rows; see duplicates below |
| `game_id`, `game_name`                  | Talishar room number. **Not unique:** 270 ids map to more than one guid.                     | Confirmed                                                     |
| `format`                                | Format code                                                                                  | Confirmed                                                     |
| `deck1_id`, `deck2_id`                  | Always `-` (deck hashes were removed upstream)                                               | Confirmed                                                     |
| `deck1_json`, `deck2_json`              | One player-side each. **Python literal text, not JSON.**                                     | Confirmed                                                     |
| `created_at`                            | Timestamp of the record                                                                      | Confirmed                                                     |
| `player1_name`, `player2_name`          | Hashed players, stable across games. Used only for capping one player's weight; never shown. | Inferred stable                                               |
| `count_winner_deck`, `count_loser_deck` | Deck sizes                                                                                   | Inferred                                                      |
| `is_public`                             | Always `True` in this export                                                                 | Confirmed                                                     |
| `conceded`                              | Whether the game ended by concession (`True` in about 43% of rows)                           | Confirmed                                                     |

**Duplicates.** 78 guids appear twice, always in the same format, with the same players and game id but a different `created_at`. 29 of the pairs have different turn counts, so each looks like a later snapshot of the same game. **Rule: keep the latest `created_at` for each guid** (`game.ReadAll`). Why they're re-recorded is Unknown; it's a question for FaBlazing. **FaBlazing (21 Oct 2026):** guids should be unique. A duplicate is probably a player winning, pressing undo and finishing the game a second time, so take the latest `created_at`, which is the rule we already use.

**Consistency (confirmed, no exceptions in 8,213 rows):**

- each side's `opposingHero` is the other side's `playerHero`
- `winner` agrees between the two sides
- one side has `result` 1 and the other 0
- `gameId` matches the row's `game_id`

## A player-side (`deckN_json`)

| Field                                  | Meaning                                                                                                                                                                                 | Status                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `playerHero`                           | **The side the hero ended the game on.** For Viserai it's `viserai_the_forsaken` or `viserai_usurper`: one hero card, two sides.                                                        | Confirmed by `TRANSFORM` events                  |
| `opposingHero`                         | The opponent's hero, on the side it ended on                                                                                                                                            | Confirmed                                        |
| `result`                               | 1 won, 0 lost                                                                                                                                                                           | Confirmed                                        |
| `winner`                               | 1 or 2: which side won                                                                                                                                                                  | Confirmed                                        |
| `turns`                                | Number of turn indexes (see turn numbering)                                                                                                                                             | Confirmed                                        |
| `firstPlayer`                          | Per side: **1 if this player went first, otherwise 0**. The two sides always have 1 and 0. The side with 1 plays on turn 0 in 94% of games (format 1, 20 Oct). `game.Side.WentFirst()`. | Confirmed by FaBlazing and the data, 21 Oct 2026 |
| `startingLife`, `opponentStartingLife` | 40 in CC                                                                                                                                                                                | Confirmed                                        |
| `character`                            | Hero, weapons and equipment: `cardId`, `cardName`, `numCopies`                                                                                                                          | Confirmed                                        |
| `cardResults`                          | One row per card in the deck (see below). **Missing on about 9% of sides.**                                                                                                             | Confirmed                                        |
| `arenaCardResults`                     | The same fields for equipment, weapons and tokens that were used (for example `gate_to_iarathael`)                                                                                      | Confirmed                                        |
| `tokenResults`                         | Always empty for Viserai                                                                                                                                                                | Confirmed                                        |
| `turnResults`                          | Per turn, keyed `turn_0`, `turn_1`, …; see below                                                                                                                                        | Confirmed                                        |
| `turnLog`                              | Ordered actions; see below                                                                                                                                                              | Confirmed                                        |
| `total*`, `average*`                   | About 40 game summaries (damage, life, resources, value), each with a `_NoLast` variant that leaves out the final turn                                                                  | Confirmed present; definitions Unknown           |

**Sides without detail.** 82 of the 928 Viserai sides have only `playerHero`, `opposingHero`, `result`, `winner`, `turns`, `firstPlayer`, life, `totalTime`, `arenaCardResults` and `tokenResults`. They have **no `cardResults`, `turnResults` or `turnLog`**. They aren't short games (most ran 6–9 turns), and in 79 of the 82 the opponent's side has full detail. **The cause (FaBlazing, 21 Oct 2026):** players can turn off stats in Talishar's settings. Nothing about their game then reaches the database except the heroes, which FaBlazing asked Talishar to keep sending. These sides count for matchups and results, but not for card stats or chains.

### `cardResults` (per card in the deck)

The fields are `cardId`, `cardName`, `numCopies`, `pitchValue`, `played`, `pitched`, `blocked`, `hits`, `discarded`, `charged`, `activated`, `katsuDiscard` and `passiveTriggered`. Cards that were never used sometimes leave out the last four.

- **`played` covers more than `M` in the log.** It also counts `INSTANT` and `A`. For example, Cull played once was logged as INSTANT. **Inferred.**
- `pitched` matches the count of `P` in the log. **Confirmed** on samples.

### `turnResults` (per turn index)

The fields are `damageDealt`, `damageTaken`, `damageThreatened`, `damageBlocked`, `damagePrevented`, `arcaneDamageDealt`, `arcaneDamageTaken`, `resourcesUsed`, `resourcesLeft`, `cardsUsed`, `cardsPitched`, `cardsBlocked`, `cardsDiscarded`, `cardsDisrupted`, `cardsLeft`, `lifeGained`, `lifeLost`, `lifeAtTurnEnd` and `opponentLifeAtTurnEnd`.

**Life totals for both players at the end of every turn index are logged.**

### `turnLog`: action granularity

Each entry is `[turn, cardId, action]`, in order. On 20 Oct a Viserai side had a median of 47 entries and a maximum of 157.

**Turn numbering.** Within a turn index a side both blocks (on the opponent's turn) and plays (on its own turn). So **a turn index is a round: one turn for each player.** It starts at 0. The largest index is `turns − 1` in 334 sides and `turns` in 499; the difference is Unknown. Indexes never go backwards within a log. **Inferred.**

| Code                | Our reading                                                                               | Count (Viserai sides) | Most common cards                                                                          | Status                      |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| `M`                 | Played: a card from any zone, a weapon attack, an equipment use, **or a Gate token used** | 17,207                | grasp_of_the_arknight, seven_sin_nebula, murmuring_gloomblade_red, gate_to_iarathael (648) | Inferred                    |
| `B`                 | Blocked with                                                                              | 8,039                 | grasp_of_the_arknight, face_purgatory                                                      | Inferred                    |
| `P`                 | Pitched                                                                                   | 6,487                 | blue cards                                                                                 | Confirmed against `pitched` |
| `HIT`               | An attack hit                                                                             | 4,358                 | seven_sin_nebula, murmuring_gloomblade_red                                                 | Inferred                    |
| `TRANSFORM`         | The hero flipped (traversed) to the named side                                            | 2,114                 | viserai_usurper, viserai_the_forsaken                                                      | Confirmed                   |
| `INSTANT`           | An instant played or activated                                                            | 1,104                 | cull_red, fyendals_spring_tunic, gate_to_iarathael (43)                                    | Inferred                    |
| `D`                 | Defence reaction                                                                          | 986                   | sink_below_red, fate_foreseen_red                                                          | Inferred                    |
| `A`                 | Activated ability                                                                         | 487                   | snapdragon_scalers, cull_red, gate_to_iarathael (11)                                       | Inferred                    |
| `DISCARD`           | Discarded                                                                                 | 383                   | haunting_rendition_red                                                                     | Inferred                    |
| `PASSIVE`, `CHARGE` | Passive trigger; charged to the hero                                                      | small                 | —                                                                                          | Inferred                    |

## Events against state

The council asked what's logged as an event and what as state.

| Thing                                                                                                                                                     | Logged?                                                | Can it be reconstructed?                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cards played, pitched, blocked with, hits                                                                                                                 | **Event**                                              | —                                                                                                                                                                 |
| Traverses (hero flips)                                                                                                                                    | **Event** (`TRANSFORM`)                                | —                                                                                                                                                                 |
| A Gate to i'Arathael being used                                                                                                                           | **Event** (`M`/`INSTANT`/`A` with `gate_to_iarathael`) | —                                                                                                                                                                 |
| Life totals for both players                                                                                                                              | **State**, at the end of each turn index               | —                                                                                                                                                                 |
| Damage, resources and cards used per turn                                                                                                                 | **State**, per turn index                              | —                                                                                                                                                                 |
| **Draws, hand and arsenal**                                                                                                                               | **Not logged**                                         | No. Deck order is hidden.                                                                                                                                         |
| **The banished zone** (contents, face up or down): Viserai, the Forsaken's banish from the top of the deck, and Become the Shadow Lord's banish from hand | **Not logged**                                         | No. Which card was banished isn't recorded.                                                                                                                       |
| **Which zone a card was played from** (hand or banished zone)                                                                                             | **Not logged**                                         | Partly: a blood debt card played right after a Gate is used, in the same turn, was _probably_ played through the Gate. That's an inference, not a reconstruction. |
| **Gate creation**                                                                                                                                         | Not logged as an event                                 | Partly: Become the Shadow Lord and Open the Gate being played are logged; whether a Gate was created isn't.                                                       |
| **Runechants** (created, how many held)                                                                                                                   | **Not logged**; `tokenResults` is empty                | No. The arcane damage per turn is an indirect trace.                                                                                                              |
| **Blood Debt state**                                                                                                                                      | Not logged                                             | Partly: the blood debt cards in the banished zone at end of turn can't be known, because the banished zone isn't logged.                                          |
| **Pitch decisions**                                                                                                                                       | `P` events (which card was pitched, in order)          | What it paid for isn't recorded.                                                                                                                                  |

**Conclusion for the council's step 1.** The council's fallback was to reconstruct state from a complete action log with the TypeScript engine. **That isn't possible, because the log isn't complete for hidden zones:** draws, the banished zone, the zone a card was played from, and Runechants are all missing. Deterministic reconstruction would need the deck order, and that isn't recorded.

So, as the council's own rule says, the project is blocked for chains that depend on hidden state. Chains must be written **only in terms of logged events**, with any inference called a **proxy** and marked as one. Become the Shadow Lord → Gate used → blood debt card played is fully observable as events. That's why it's the first chain, and its "played through the Gate" step is a proxy.

## Sample depth

On 20 Oct there were 835 detailed Viserai sides (not deduplicated by player), against 38 opponent heroes. The busiest matchups per day were Fang 78, Boltyn 73, Levia 72, Jarl 56, Ira 48 and Oscilio 43.

| Window  | Matchups with n ≥ 50 | Share of games they cover |
| ------- | -------------------- | ------------------------- |
| 7 days  | 29                   | 97%                       |
| 30 days | 34                   | 100%                      |
| 90 days | 38                   | 100%                      |

Depth by matchup is enough. Depth for **chains by matchup** depends on how often each chain occurs, and that will only be known once each chain is measured, after its expectation is written. The step 5 scoping decision waits on that.

## Rules versions

The data has **no legality or rules-version field.** Ban-list and errata windows have to come from a dated list that we maintain: each entry has a date, what changed and the affected cards. Every game is tagged by its `created_at`, and aggregates never span a window boundary unless the change doesn't touch Viserai's pool. The last ban and restricted update came before Viserai's release (the maintainer, 21 Oct 2026), so for now there's **one window**, starting from the first day Viserai appears in the data.

## Questions and answers

Asked on 21 Oct 2026. FaBlazing's answers:

1. **What the action codes mean:** FaBlazing doesn't know. It's a question for Talishar's developers. **Still open**, so our readings above stay "Inferred".
2. **Sides without detail:** the player turned off stats in Talishar's settings; only the heroes are sent.
3. **Duplicate guids:** probably undo after a win, then the game finished again. Take the latest `created_at`.
4. **`firstPlayer`:** 1 means this player went first, the same convention as `result` (1 means won).
5. Whether hidden zones (banish, draws, the zone a card was played from) could be logged: not asked yet. It would be a question for Talishar.

They're fine about the rate limits we hit during the backfill.
