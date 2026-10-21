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
