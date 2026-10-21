# FaBlazing chains: expectations and results

Each chain's expectation is written in its spec (`services/fablazing/chains/*.json`) **before** it's measured. The results are recorded here against that expectation, and never by moving the expectation. Logs show associations, not causes. The game logic in every chain is **unverified** until the maintainer checks it.

## bsl-gate-blood-debt

**Chain:** Become the Shadow Lord played → a Gate to i'Arathael used within 2 turns → a blood debt card played in the same turn as the Gate. The last step is a proxy for "played from the banished zone through the Gate".

**Expectation:** written 21 Oct 2026 and approved by the maintainer. Before writing it, the card-level counts for Become the Shadow Lord and Gate use had been seen; the chain itself had not been measured.

**First measurement:** 21 Oct 2026, on one day of data (20 Oct, formats 0 and 1), using `fablazing chain` with card sets exported from our card facts.

There were 808 detailed Viserai sides, after leaving out 27 abandoned early concessions.

| Furthest step reached | Sides | Share | Viserai won |
| --------------------- | ----- | ----- | ----------- |
| None                  | 408   | 50.5% | 29.9%       |
| Setup only            | 210   | 26.0% | 29.5%       |
| Gate, no payoff       | 1     | 0.1%  | —           |
| Payoff (complete)     | 189   | 23.4% | 33.3%       |

Turns from setup to payoff, in completed chains: 0 turns in 82, 1 turn in 57, 2 turns in 50.

**Against the expectation:**

1. **How often it completes: within the expected 30–60%.** 189 of the 400 sides that played Become the Shadow Lord completed the chain (47%).
2. **How quickly: the median is as expected, but the rest isn't.** The median is 1 turn, as expected. But the expectation said a same-turn payoff should be rare, and in fact **43% of completions (82 of 189) happen in the same turn**. The 90%-within-2-turns part is met by construction, because the chain only looks 2 turns ahead.
3. **Whether it changes the result: inconclusive.** With life totals going into the setup turn held level, the difference is **+3.2 points, ±8.8** (95%). The raw difference is +3.4 (33.3% against 29.9%). The estimate is below the expected 5–15, and the interval includes both zero and the expected range, so one day can't settle it. Completers dealt more damage on the setup turn (6.0 against 4.3).

**What the data says about the proxy:** of the sides that reached the Gate step, 189 of 190 also played a blood debt card in the same turn. That supports reading "Gate used, then a blood debt card" as playing it through the Gate. The chain can't tell whether **the Gate came from Become the Shadow Lord**, though, or from another source such as Open the Gate to i'Arathael. That's a limit of the logs: Gate creation isn't logged.

**The maintainer's answer (21 Oct 2026):** same-turn completions are expected. A common line is:

1. Become the Shadow Lord banishes Arknight Descendancy (blue), creating a Runechant.
2. Descendancy is activated, creating 3 Runechants on banish.
3. Descendancy then costs only 2 to play: 1 to activate the Gate, and 1 to make up the cost after the Runechant reduction.

That line is now its own chain, `bsl-descendancy-same-turn`. Its expectation is written before it's measured.

The expectation stays as written. Any change to the chain becomes a new chain with its own expectation.

**Next:**

- Measure over 30 days. The backfill is parked for now (the maintainer, 21 Oct 2026).

**Median setup turn:** turn 3 for completed chains. The cards played through the Gate:

|                       | Arknight Descendancy (blue) | Open the Gate to i'Arathael (red) | Others |
| --------------------- | --------------------------- | --------------------------------- | ------ |
| All completions       | 93                          | 51                                | 45     |
| Same-turn completions | 49                          | 22                                | 11     |

## bsl-descendancy-same-turn

**Chain:** the maintainer's line (21 Oct 2026). Become the Shadow Lord banishes Arknight Descendancy, creating a Runechant. Descendancy is activated, creating 3 Runechants on banish, and then costs only 2 to play: 1 to activate the Gate and 1 after the Runechant reduction.

Banishing and Runechants aren't logged, so the chain matches what is: Become the Shadow Lord played, a Gate used (as `M`, `INSTANT` or `A`) and Descendancy played, **all in the same turn**.

**Expectation:** written 21 Oct 2026 and approved by the maintainer, before this chain was measured. Already seen beforehand: Descendancy is in 80% of lists and is played about 0.5 times a game, and 82 of the broader chain's completions were same-turn. Not seen: how many of those involved Descendancy.

**First measurement:** 21 Oct 2026, on the same day of data. There were 808 detailed Viserai sides, after leaving out 27 abandoned early concessions.

| Furthest step reached | Sides | Viserai won |
| --------------------- | ----- | ----------- |
| None                  | 408   | 29.9%       |
| Setup only            | 302   | 29.5%       |
| Gate, no Descendancy  | 36    | 33.3%       |
| Complete              | 62    | 40.3%       |

**Against the expectation:**

1. **How often: as expected.**
   - 62 of the 400 sides that played Become the Shadow Lord completed the line (15.5%; expected 10–25%).
   - In the broader chain's 82 same-turn completions, Descendancy was the card played through the Gate in 49 (60%; expected over half).
2. **When: as expected.** The median setup turn is 3 (expected 2 or 3).
3. **Result: points the expected way, but inconclusive.**
   - **Damage:** completers dealt **8.3** damage that turn, against **4.5** for other sides that played Become the Shadow Lord. That's as expected.
   - **Wins:** with life totals held level, completers won **+9.0 points, ±12.2** (95%). The raw difference is +10.4 (40.3% against 29.9%).
   - The estimate is inside the expected 5–15, but the interval includes zero. With 62 completions in one day, the extra data is what would settle it.

By life going into the setup turn (won / sides):

| Life             | Completed | Setup without the line |
| ---------------- | --------- | ---------------------- |
| Behind by 10+    | 1/9       | 8/55                   |
| Behind by 3–9    | 2/13      | 16/69                  |
| Level (within 2) | 13/25     | 49/162                 |
| Ahead by 3–9     | 6/10      | 15/35                  |
| Ahead by 10+     | 3/5       | 13/17                  |

**Reading this** (logs show associations, not causes): the line is played most from level, and it deals clearly more damage. Whether it wins more is still open. The simulation can test it as a counterfactual (step 5): the same hands with the line played and not played.

**A note on the two chains' counts.** The broader chain counts 49 same-turn Descendancy completions, while this chain counts 62. The broader chain stops at the first blood debt card played after the Gate, which is sometimes a different card. This chain looks for Descendancy specifically.

## The chain library: 30 days

Measured 21 Oct 2026 with `fablazing chain` on **21 Sep to 20 Oct 2026**: 57 of 60 daily files (Viserai games only). **Missing:** format 1 for 18 Oct, and formats 0 and 1 for 19 Oct (FaBlazing rate limits, then a 500). There were **27,994 detailed Viserai sides**, after leaving out 1,188 abandoned early concessions.

Every expectation below was written and approved by the maintainer **before** the chain was measured, and none was changed afterwards. It's in each chain's spec. Logs show associations, not causes. The game logic in every chain is unverified until the maintainer checks it.

**How to read the numbers:**

- **Counted per side.** A side counts as reaching a step if any attempt in its game did.
- **Win differences** are "with life totals held level": the difference within each life bucket going into the setup turn, weighted by bucket size, with a 95% margin.
- **The margins are too narrow, if anything.** They treat every side as independent. The cap of 20 games per player per day isn't applied in this tool yet, so heavy players weigh more than they will in the app.
- **Interval widths over 30 days:** about ±1–2 points for chains with thousands of sides, ±4–8 for a few hundred, and ±30 for the Crown chain's 9 completions. On one day the same chains gave ±9–12, which is why the first two chains are measured again here.

### Summary

| Chain                      | How often (expected)                     | Result, life held level (expected) | Verdict                                                   |
| -------------------------- | ---------------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| bsl-gate-blood-debt        | 47.5% of BSL sides (30–60%)              | +2.1 ±1.5 (5–15)                   | Completes as expected; wins less than expected            |
| bsl-descendancy-same-turn  | 14.7% of BSL sides (10–25%)              | +4.0 ±2.2 (5–15)                   | As expected, but the win difference is just under range   |
| bsl-gate-no-other-maker    | 45.1% of BSL sides (30–45%)              | +1.9 ±1.5 (3–12)                   | Gate source doesn't matter                                |
| reach-otg-gate             | 6.9% of Reach blocks pair (5–20%)        | −8.4 ±7.6 (0 to +10)               | Pairs as expected; Gate used less; associated with losing |
| crown-gate-otg             | 4.4% of Crown blocks (2–10%)             | 9 completions                      | Not enough data                                           |
| cullingsong-usurp          | 4.8% of Cullingsong sides (15–40%)       | +30.9 ±3.7 (0 to +10)              | Much rarer, and far more associated with winning          |
| usurp-hits                 | Usurp hits on 76.2% of sides (35–55%)    | +3.5 ±4.1 (+5 to +20)              | Hits far more often than expected; hitting adds little    |
| traverse-uses-action-point | 87.1% of traversing sides (at least 90%) | +8.3 ±1.6 (0 to +10)               | Just under the expected rate; result in range             |
| traverse-flip-back         | 44.3% of traversing sides (30–60%)       | +3.4 ±1.1 (within ±5)              | As expected; a small positive association                 |

### bsl-gate-blood-debt and bsl-descendancy-same-turn, again

The one-day results are above. Over 30 days, against the same expectations:

- **bsl-gate-blood-debt.** Of 13,430 sides that played Become the Shadow Lord:
  - **How often: as expected.** 6,374 completed (47.5%; expected 30–60%).
  - **Timing:** turns to the payoff were 0 in 2,662, 1 in 2,143 and 2 in 1,569, so the median is 1, as expected. Same-turn payoffs are again common (42%), which the expectation called rare. The maintainer's same-turn line explains this (see above).
  - **Result: below the expected 5–15.** It's **+2.1 points, ±1.5**. Damage on the setup turn was 5.7 against 4.2.
- **bsl-descendancy-same-turn.**
  - **How often: as expected.** 1,972 completed (14.7%; expected 10–25%). The median setup turn is 3 (expected 2 or 3).
  - **Result: just below the expected 5–15.** It's **+4.0 points, ±2.2**, so the interval excludes zero. Damage was 8.7 against 4.3, as expected.
  - **Reading this:** the line is associated with a small win difference and a clear damage difference. The one-day +9.0 was at the high end of what one day could show.

### bsl-gate-no-other-maker

**Chain:** Become the Shadow Lord played → a Gate used within 2 turns, with **no other logged Gate maker in between** → a blood debt card played in the same turn as the Gate.

- "Another Gate maker" means an on-play maker played, an on-hit maker hitting, Dam the Shadowake blocking, or a block with Corrupted Crown or Reach of the Abyss.
- The Gate-maker sets are hand-listed in `chains/sets.json` from `docs/reviews/02-gate-creators.md` until the importer exports them.

| Furthest step reached | Sides  | Viserai won |
| --------------------- | ------ | ----------- |
| None                  | 14,564 | 30.3%       |
| Setup only            | 7,156  | 32.1%       |
| Gate, no payoff       | 219    | 31.1%       |
| Complete              | 6,055  | 33.2%       |

**Against the expectation:**

1. **How often: at the top of the expected 30–45%.** 6,055 of 13,430 sides that played Become the Shadow Lord completed it (45.1%). Ruling out other Gate makers removed only 319 of the broader chain's 6,374 completions (5%).
2. **When: as expected.** The median setup turn is 3. Same-turn completions are 46.7% (expected at least 43%).
3. **Result: below the expected 3–12.** It's **+1.9 points, ±1.5**, against +2.1 for the broader chain. Damage on the setup turn was 5.8 against 4.2, as expected.
   - The expectation said a result about the same as the broader chain's would mean **the Gate's source doesn't matter**, and that's what this shows.

### reach-otg-gate

**Chain:** Reach of the Abyss blocks → Open the Gate blocks in the same turn index (either order) → a Gate used within 2 turn indexes.

- The same turn index is the proxy for the same combat chain.
- The comparison splits on the pairing: Open the Gate blocking alongside Reach, against Reach blocks without it.

| Furthest step reached    | Sides  | Viserai won |
| ------------------------ | ------ | ----------- |
| None                     | 26,713 | 31.7%       |
| Reach blocks             | 1,192  | 24.7%       |
| Paired, no Gate within 2 | 43     | 14.0%       |
| Paired, then a Gate used | 46     | 23.9%       |

**Against the expectation:**

1. **How often: as expected.** Of 1,281 sides that blocked with Reach, 89 had Open the Gate block alongside it (6.9%; expected 5–20%).
2. **Gate use: below the expected 70%, but not under the 50% warning line.**
   - After the pairing, a Gate was used within 2 turn indexes in 46 of 89 (52%).
   - Turns to the Gate use: 0 in 12, 1 in 19 and 2 in 15.
   - The expectation's reading for a low rate: the Gate is often held, or the banish isn't always taken.
3. **Result: below the expected 0 to +10.** It's **−8.4 points, ±7.6**, so the interval just excludes zero. Damage on the block turn was 5.5 against 5.3, so there's no extra damage, as expected.
   - The expectation said a negative result suggests the line is used from behind. The by-life table doesn't clearly show that: level 9/41 against 147/485, and behind by 3–9 3/22 against 59/338.
   - With 89 sides it's the weakest of the measured results apart from the Crown chain.
   - Sides that block with Reach at all win less (24.7% against 31.7%). That's an association with Reach itself, outside this chain.

### crown-gate-otg

**Chain:** Corrupted Crown blocks → a Gate used within 1 turn index (with no Become the Shadow Lord, logged Gate maker or Reach block in between) → Open the Gate played in the same turn as the Gate.

- **How often: as expected, but tiny.** Of 204 sides that blocked with the Crown, 9 completed (4.4%; expected 2–10%).
- **When:** the Gate was used in the same turn index as the block in 3 of 9, and one turn later in 6. The expectation said most would be same-turn, but 9 is far too few to read.
- **Result: not enough data,** as the expectation said for under 20 completions. For the record, it was +26.5 ±29.8.

### cullingsong-usurp

**Chain:** Cullingsong Gloomblade played → Usurp the Shadow Throne played in the same turn → Usurp hits in the same turn. The comparison splits on Usurp being played after Cullingsong.

| Furthest step reached | Sides  | Viserai won |
| --------------------- | ------ | ----------- |
| None                  | 10,658 | 32.0%       |
| Cullingsong only      | 16,512 | 30.0%       |
| Usurp, no hit         | 159    | 58.5%       |
| Usurp hits            | 665    | 49.2%       |

**Against the expectation:**

1. **How often: well below the expected 15–40%.** Of 17,336 sides that played Cullingsong, 824 played Usurp later that turn (4.8%). The median turn is 4.
2. **Usurp lands: hit rate as expected, but the gap is smaller.**
   - After Cullingsong, Usurp hit in 665 of 824 (80.7%; expected at least 60%).
   - Without Cullingsong, Usurp's hit rate was about 74.1%: usurp-hits' counts minus this chain's, (1,966 − 665) / (2,579 − 824). That's approximate, because each side counts once.
   - The gap is about **6.6 points, below the expected 15**. The expectation's reading: Cullingsong isn't making much extra room, or opponents keep a blocker for Usurp anyway. Usurp hits often either way.
3. **Result: far above the expected 0 to +10.** It's **+30.9 points, ±3.7**. Damage that turn was 12.8 against 5.1, as expected.
   - **The life split can't be checked as written.** The expectation said the pair should show up more when the opponent's life is lower. The tool buckets by life _difference_, not the opponent's life.
   - By difference, the pair is most common when Viserai is behind by 10 or more: 302 of 2,908 sides (10.4%), against 2.1% from level.
   - **Reading this:** a large association. Cullingsong sides are compared at their first Cullingsong turn, which is usually earlier than the turn of the pair (median 4), so the groups also differ by game stage. The expectation didn't say what a result above +10 would mean. The simulation (step 5) is where to test it.

### usurp-hits

**Chain:** Usurp the Shadow Throne played → Usurp hits in the same turn. This is the baseline for cullingsong-usurp.

1. **How often: far above the expected 35–55%.** Usurp hit on 1,966 of the 2,579 sides that played it (76.2%). Because a side counts as hitting if any Usurp hit, this is a per-game rate, not a per-attack rate.
2. **When: as expected.** The median turn of the Usurp is 4 (expected 4 or later).
3. **Result: below the expected +5 to +20.** It's **+3.5 points, ±4.1**, and the interval includes zero. Damage that turn was 14.8 against 6.7.
   - The raw rates run the other way (47.5% against 52.9%), because Usurp hits are concentrated in games where Viserai is behind by 10 or more (799 of 1,966).
   - Sides that play Usurp at all win about 49%, against 29.6% for sides that don't. That's an association with reaching the late game with Usurp available.

### traverse-uses-action-point

**Chain:** TRANSFORM to Viserai, Usurper → any card played later that turn. This is the proxy for using the extra action point.

1. **How often: just below the expected 90%.**
   - Of 26,072 sides that traversed to Usurper, 22,720 played a card after at least one traverse (87.1%).
   - 1,922 sides never traversed.
   - The most common cards played after the traverse were Cullingsong (2,335), a Gate (2,086), Seven Sin Nebula (1,500) and Sinspeaker Gloomblade (1,216).
2. **When:** reported, not judged. The median turn is 2.
3. **Result: in the expected 0 to +10, at the top.** It's **+8.3 points, ±1.6**. Damage that turn was 8.3 against 2.8.
   - The 3,352 sides that never played a card after a traverse dealt very little damage on those turns. Some of them may be traverses at the end of a turn, or in turns that were already going badly.

### traverse-flip-back

**Chain:** TRANSFORM to Viserai, Usurper → TRANSFORM back to Viserai, the Forsaken within 1 turn index.

1. **How often: as expected.** 11,554 of 26,072 sides that traversed to Usurper flipped back within 1 turn index (44.3%; expected 30–60%).
2. **When:** reported, not judged. 6,470 flipped back in the same turn index and 5,084 one later. The median setup turn is 1.
3. **Result: as expected (within ±5), but not zero.** It's **+3.4 points, ±1.1**. Damage that turn was 7.5 against 7.0.
   - The player said either choice can be right, and a gap this size is consistent with that. Because the interval excludes zero, though, it's worth a look in the simulation.

### Not in the library

**Traverse timing in general.** The maintainer (21 Oct 2026): "Nobody knows." There's nothing to register an expectation against, so it's left to the simulation (step 5). The two traverse chains above measure a player's habits, not the right timing.

**Open the Gate played through a Gate, and Open the Gate hits → Gate used.** The maintainer chose both on 21 Oct 2026, but they aren't specified yet. The Reach and Crown chains came first.

**Next:**

- Apply the player cap in the chain tool, and add the three missing days once FaBlazing serves them.
- Move the hand-listed `gate_maker_*` and `banish_equipment` sets into the importer's export.
- Use the simulation (step 5) to test the large associations, especially cullingsong-usurp's +30.9 and the Reach pairing's −8.4, as counterfactuals.
