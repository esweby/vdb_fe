# Full analysis

The Analysis tab on a deck page. Decided with the maintainer on 28 Oct 2026. Everything here is **UNVERIFIED** as Flesh and Blood strategy: which turn matters and what counts as good are the maintainer's call, and the panel suggests no targets.

## What it shows

The panel states its questions before anything runs, then answers each one in a sentence for the chosen turn (1 to 8, opening on 6):

1. How much damage does this deck threaten by turn N? Attacks' printed power, 2 per usurp, and Runechant arcane damage, with nothing blocked.
2. How often has it made a Gate by turn N?
3. How often has Viserai become the Usurper by turn N?
4. How often do Become the Shadow Lord (blue), a Gate within two turns and a blood debt card that Gate's turn come together by turn N? This is the chain FaBlazing measures in real games, so it also shows the real same-turn rate with its Wilson interval, and where games without the chain most often stop.
5. If the deck plays Usurp the Shadow Throne: how often does it play it at the reduced cost (after a usurp that turn) by turn N?
6. If the deck plays Widespread Annihilation or Deep Recesses of Existence (the blue 4-cost Rune Gate cards): how often does it play each by turn N, and how many of those plays came from banish through a Gate? The engine doesn't model the Rune Gate keyword yet, so these plays pay full cost.

"Show the numbers" has a table for each question by turn, with the paired difference and its 95% interval. "How this was worked out" has the method, rules coverage per deck and any games that stopped early.

## How the comparison works

This deck and the three common lists each play 1,000 practice games with the reviewed goldfish policy, split over the four Cull and Scar answers, on the same seeds. Game _i_ of this deck and game _i_ of a list are a pair; only games both finished count. Rates use `pairedDifference` from `planGoals.ts` (docs/plan-goals.md); damage uses `pairedMeanDifference`, the mean of the paired differences ± 1.96 standard errors. An interval that includes 0 reads "No clear difference"; otherwise "Higher than" or "Lower than", always in words with each list's own figure.

Code: `apps/web/src/decks/fullAnalysis.ts` and `FullAnalysisPanel.tsx`, tested in `fullAnalysis.test.ts` and `FullAnalysisPanel.test.tsx`.
