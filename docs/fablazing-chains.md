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
3. **Whether it changes the result: not tested yet.** The raw difference is +3.8 points (33.3% against 29.5%), just below the expected 5–15. But:
   - it isn't conditioned on life totals at the setup turn, which the expectation requires and the tool doesn't do yet
   - with about 200 sides in each group, the interval is roughly ±9 points

   So it's inconclusive.

**What the data says about the proxy:** of the sides that reached the Gate step, 189 of 190 also played a blood debt card in the same turn. That supports reading "Gate used, then a blood debt card" as playing it through the Gate. The chain can't tell whether **the Gate came from Become the Shadow Lord**, though, or from another source such as Open the Gate to i'Arathael. That's a limit of the logs: Gate creation isn't logged.

**For the maintainer:**

- Are same-turn completions expected? For example, Become the Shadow Lord creates a Gate that's used straight away.
- Should the chain require that no other Gate maker was played in between?

The expectation stays as written. Any change to the chain becomes a new chain with its own expectation.

**Next:**

- Condition part 3 on life totals at the setup turn.
- Measure over 30 days, once the backfill is agreed.
