# Engine direction

The engine calibration work (#234, #241–#268) is careful but has no target. Step back before building more. Four tasks, in order. Open each as its own small PR, and start each PR description with a plain-English summary of 3–5 sentences that a player can follow.

## 0. Record the plan

- Copy this brief into `docs/engine-direction.md`.
- Change line 5 of `AGENTS.md` so "the current plan" points at it instead of `docs/test-loop.md`.
- Docs only.

## 1. Explain the T5 gap

Investigation, no engine or policy changes.

- #262 reports 97–98% of simulated BSL → Gate → blood debt chains finishing on the same turn, against 41.47% in real FaBlazing games. The 97% comes from the frozen v6 diagnostic, not the current policy.
- First, rerun the measurement with the current policy so the comparison is like for like. A few thousand runs is enough.
- Then pick 20 real Viserai game sides from `~/.cache/vdb/fablazing/viserai` where the chain was slow or never finished. For each, record the most likely reason from the turn log:
  - (a) opponent pressure: blocked, defended or low on life
  - (b) the player chose another line
  - (c) the deck didn't support it: a different list, or cards not drawn
  - (d) a logging or proxy problem
  - (e) unclear
- Write the findings in `docs/t5-gap.md`: a table of the 20 games and their reasons, then one paragraph on which cause dominates and what that means for the engine.
- Stop after this PR and wait for my review. Don't start fixes.

## 2. A ranked list of cards to verify

No rules yet.

- From the same FaBlazing logs, rank the cards Viserai sides play by how often they're used. Mark which ones already have verified rules.
- Group cards that share a pattern (the Gloomblades; red, yellow and blue versions; the Widespread cycle) so I can check the pattern once.
- Put it in `docs/card-coverage.md`, with the cumulative share at 20, 40, 60, 80 and 100 cards. Rough numbers from 26 Oct: 58%, 82%, 91%, 95%, 97%.
- After that, draft rules in batches of about 5 cards. Each batch is one PR, marked **UNVERIFIED** until I've checked it.

## 3. The analysis button

Don't start until I've reviewed task 1.

- Goal: a "Full analysis" button on the deck page that runs the engine in a Web Worker in the user's browser (reuse `apps/web/src/ranking/runScenarios.ts`).
- It shows how fast this deck sets up compared with common real Viserai lists, plus the deck's rule coverage ("92% covered").
- Label everything **UNVERIFIED**.
- Before building it, propose the measures, a run count that finishes in a few seconds in the browser, and how FaBlazing summary data reaches the site. Wait for my OK on that proposal.

## Ground rules

- Follow `AGENTS.md`, including the new "When to ask" section.
- Run only the checks the change needs and let CI do the rest.
- No large simulation batches unless the task is about results.
- Any engine work has to serve the deck question: "Does this deck set up faster or more reliably than the alternatives?" If a change doesn't help answer that, mention it in the PR instead of building it.
