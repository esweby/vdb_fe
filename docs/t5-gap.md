# Why simulated T5 chains finish too quickly

T5 follows blue Become the Shadow Lord (BSL), then a Gate within two turns, then a blood debt card after that Gate on the same turn. The observed proxy finds 41.47% of completed chains finishing on the BSL turn. The frozen v6 diagnostic reported 97–98%, but that is not the current reviewed policy. This investigation reruns the current policy and reads 20 real slow or unfinished sides. It changes no engine rule or play policy.

## Current-policy rerun

The rerun uses policy `reviewed-delayed-hands-v2` from merged PR #268 in `both` mode. It accepts the optional traverse back, matching the earlier diagnostic's default answer. The private 54-card deck has verified rules for every copy. Each of the four fixed Cull and Scar condition cases has 1,000 runs, seed `20261021`, eight turns and starting life 40. There is no opponent, blocking, incoming damage or life gain. All 4,000 runs completed, with rules data `0d49faac`.

All simulation figures are **Assumed** and the overall strategy remains **UNVERIFIED**.

| Cull instant | Scar go again | Completed chains |    0 turns |     1 turn |    2 turns |
| ------------ | ------------- | ---------------: | ---------: | ---------: | ---------: |
| No           | No            |              193 |     93.26% |      2.07% |      4.66% |
| No           | Yes           |              207 |     90.82% |      4.35% |      4.83% |
| Yes          | No            |              191 |     92.15% |      3.14% |      4.71% |
| Yes          | Yes           |              204 |     90.20% |      4.90% |      4.90% |
| **Combined** |               |          **795** | **91.57%** |  **3.65%** |  **4.78%** |
| **Observed** |               |        **6,152** | **41.47%** | **33.62%** | **24.92%** |

The current policy is less same-turn-heavy than frozen v6, but the gap remains about 50 points. Of the 4,000 simulated runs, 795 completed the proxy, 313 reached BSL only and 2,892 never reached BSL. No run stopped after BSL and a Gate without a payoff.

## Real-game review

The review uses the same 57 FaBlazing files and inclusion rules as the observed T5 result: detailed Viserai sides, at least four turn indexes, abandoned early concessions removed and each player's contribution capped at 20 sides per day and format. There are 10,120 included sides that played BSL but did not finish the proxy on that turn. Sorting them by a hash of the private game key and side, then taking the first 20, gives 12 BSL-only sides, one BSL-and-Gate side without a payoff, and seven delayed completions.

The events, life totals and deck lists are observed. The reason is the most likely reading of those events, not a reconstructed game state. FaBlazing does not log hands, draws, banished cards, Runechants or the zone a card was played from.

Reasons:

- **A — Opponent pressure:** blocked, defended or low on life.
- **B — Another line:** the player used the turn or the Gate for something else.
- **C — Deck support:** a different list, or the needed cards were not drawn.
- **D — Logging or proxy:** the registered event proxy does not describe the apparent line.
- **E — Unclear:** the log does not support a more specific reading.

| Sample | Date   | Format | Opponent    | Proxy result    | Reason | Evidence from the log                                                                                                      |
| -----: | ------ | -----: | ----------- | --------------- | :----: | -------------------------------------------------------------------------------------------------------------------------- |
|      1 | 29 Sep |      1 | Ira         | BSL only        |   A    | Blocked with three cards on the BSL turn and fell from 28 life to 15 before the first Gate use.                            |
|      2 | 6 Oct  |      0 | Marlynn     | 1 turn          |   B    | Played Otherworldly Sins and Widespread Destruction after BSL; used the Gate with Open the Gate next turn.                 |
|      3 | 24 Sep |      0 | Olympia     | BSL only        |   B    | Played a long attack line after BSL and returned to Forsaken; the first Gate use was three turns later.                    |
|      4 | 28 Sep |      1 | Levia       | BSL only        |   A    | Played BSL at five life after taking 18 damage, then blocked with three cards; no Gate was logged before the game ended.   |
|      5 | 28 Sep |      1 | Olympia     | BSL only        |   D    | BSL is on turn index 7 in a game reporting seven turns, with 0–0 life and no later log in which to finish.                 |
|      6 | 15 Oct |      1 | Rhinar      | 2 turns         |   A    | Between BSL and the Gate, blocked with six cards and fell from 18 life to two.                                             |
|      7 | 27 Sep |      0 | Levia       | BSL only        |   A    | After BSL, fell from 24 life to four in one round; no Gate was logged.                                                     |
|      8 | 7 Oct  |      0 | Malice      | BSL only        |   D    | BSL is on turn index 4 in a game reporting four turns, with 0–0 life and no later events.                                  |
|      9 | 14 Oct |      0 | Olympia     | BSL only        |   A    | Was at 18 against 32 after the BSL round, then took seven and ten more damage without using a Gate.                        |
|     10 | 16 Oct |      0 | Fang        | BSL only        |   A    | The BSL round included 14 damage taken; then fell from 17 life to eight and zero without a Gate.                           |
|     11 | 24 Sep |      0 | Levia       | BSL only        |   A    | Was at 13 against 19 after BSL, blocked repeatedly and fell to five; no Gate was logged.                                   |
|     12 | 17 Oct |      0 | Ira         | 2 turns         |   B    | Used Embrace Ursur on the intervening turn, then used the Gate for Widespread Ruin two turns after BSL.                    |
|     13 | 28 Sep |      1 | Levia       | 1 turn          |   D    | The matcher anchors BSL on turn 0, but another BSL is immediately before the Gate and payoff on turn 1.                    |
|     14 | 23 Sep |      1 | Jarl        | 1 turn          |   A    | After BSL, blocked with Murmuring and Bloodfrenzy, then used the Gate for Descendancy next turn.                           |
|     15 | 28 Sep |      0 | Fang        | BSL only        |   D    | A Gate is logged as `A`, not `M`, followed by Open the Gate that turn; the registered T5 proxy ignores it.                 |
|     16 | 3 Oct  |      0 | Hala        | BSL only        |   A    | Was at three life on the BSL turn, blocked with six cards and ended the following rounds at one life.                      |
|     17 | 20 Oct |      0 | Gravy Bones | 1 turn          |   B    | After BSL, used Sinspeaker, Cullingsong and Open the Gate, then saved the Gate activation for next turn.                   |
|     18 | 24 Sep |      0 | Dash I/O    | BSL only        |   B    | BSL was followed by two Cullingsongs and two Revel in Runeblood plays; later turns continued other attacks without a Gate. |
|     19 | 21 Sep |      0 | Rhinar      | 1 turn          |   C    | This different list had one Descendancy and one Usurp; its only Descendancy play followed the next-turn Gate.              |
|     20 | 24 Sep |      0 | Lyath       | Gate, no payoff |   B    | Pitched Descendancy immediately before BSL; the later Gate was followed by a weapon attack, not a blood debt payoff.       |

Opponent pressure is the largest reason in this sample, with 9 of 20 sides. Choosing another line accounts for 6, deck support for 1, and logging or proxy effects for 4; none needed the unclear category. Pressure and other choices together account for 15 of 20. The goldfish engine has no opponent, blocking or incoming damage, so it removes the main reason players delay or abandon the chain and naturally makes the setup look too reliable. The result argues against adding more immediate Gate choices to chase the observed percentage: future deck analysis should present this as a goldfish setup measure, compare like-for-like deck lists, and keep the real-game timing beside it as context.

Private aggregate evidence is in `/private/tmp/vdb-t5-current-policy-20261026.json`, `/private/tmp/vdb-t5-real-sample-20261026.json` and `/private/tmp/vdb-t5-classification-20261026.json`. They contain no raw player names in their reports. The private deck and full game rows are not committed.
