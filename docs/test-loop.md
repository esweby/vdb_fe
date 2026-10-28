# The test loop

A plan for testing a deck the way a player does: write the strategy down, export a version, play it on Talishar, upload the game, and see whether the plan happened. Drafted 22 Oct 2026 from a conversation with the maintainer and a review by the council of LLMs. On 23 Oct, the standalone CSV parser is merged ([PR #228](https://github.com/esweby/vdb_fe/pull/228)) and the pure TypeScript report is in review ([PR #231](https://github.com/esweby/vdb_fe/pull/231)). On 28 Oct, uploading a game (step 2) is built, on the deck's Results tab with an optional version; see [deck-versions.md](deck-versions.md#results). The rest of the loop is not built yet.

## Why

Viserai is new enough that nobody knows how to play him yet. The FaBlazing data shows how the field plays, and the field is still guessing, so copying it, or studying it closely, gives back the field's confusion. The core builder already produces decks like the ones being played. What's missing is a way to try a strategy nobody plays yet and find out, quickly and honestly, whether it works.

Win rate can't do that from one player's games: it needs hundreds. A plan's steps can. "Flipped by turn 3 in 7 of 10 games" says something after an evening; "won 6 of 10" says almost nothing.

## The loop

1. **Write the strategy down.** A deck has a plan: a few turn goals, each something a log can check. For example: set up on turns 1 and 2, flip on turn 3, burst on turn 4, stay out of the blender.
2. **Export a version.** Each time the deck is opened in FaBrary, the site saves the list as a version. The builds being compared are versions of one deck.
3. **Play it on Talishar.**
4. **Upload the game.** Talishar's stats CSV goes onto the version it was played with, with a short note if the player wants to add one.
5. **Read the report.** Each game is scored against the plan, and each version's games are compared with the others'.
6. **Change the deck or the plan,** export again, and play again.

## What a game gives us

### Talishar's stats CSV

From the maintainer's export of 22 Oct 2026 (`game-stats-<timestamp>.csv`, one player's side):

| Section              | Contents                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header               | Hero (the side it was exported on)                                                                                                                                     |
| Game summary         | First player, result, turns, time                                                                                                                                      |
| Game statistics      | Averages per turn, totals for damage threatened, dealt and blocked, life gained, and **life lost to yourself** (a game total)                                          |
| Card play stats      | Every card in the deck, named with its pitch (`"Cull (1)"`): played, blocked, pitched, discarded, times hit. Cards never used are listed too. **Copies aren't given.** |
| Card activated stats | Equipment and tokens: activated, passive triggers, blocked, times hit                                                                                                  |
| Turn by turn         | Per turn: cards played, blocked, pitched, discarded and left; resources used and left; damage threatened, dealt, blocked, prevented and taken; life gained; value      |
| Footer               | The opponent's stats only if "Switch player stats" was pressed first                                                                                                   |

**Not in the CSV:** the order of plays (so which turn a card was played, and when the hero flipped), the opponent's hero, life lost to yourself by turn, copies of each card, banishes and Runechants.

Self-loss has no separate turn column, but can be recovered from Total Value using the inspected export formula: subtract damage threatened, damage blocked, damage prevented and life gained. These signed per-row losses are **Assumed**, checked against the **Observed** signed game total. The summary averages also support the total, allowing for rounding; neither check proves the timing. See the [worked example and pinned source](../packages/talishar/report-example.md). The CSV row numbers are positions in the export, not confirmed game-turn numbers. Going second, the export has one more row than the summary's turns: the first row is the opponent's first turn, which Talishar's stats screen calls turn 0 (seen in the maintainer's export of 28 Oct 2026).

The format is Talishar's and can change without notice, so the parser is tested against real files, starting with this one.

**Self-loss and blood debt (the maintainer, 23 Oct):** total self-loss gives us a starting point, and blood debt can be worked out and tracked. The export records `Total Life Self-Lost` as −18 in this game. Keep that sign when parsing. Use the total as a check on the losses tracked through the game, rather than treating it as an amount that cannot be placed by turn. The report needs to state the inputs used to track blood debt and any other self-loss. Where those inputs leave the timing uncertain, label that part Assumed; do not silently spread the total across turns or call it all blood debt.

### FaBlazing, the next day

The same game is usually in the next day's FaBlazing import, unless the player turned stats off. The CSV's card counts, turns, first player and result should pick out one game, and we already know the version's list. A match adds the turn log (the order of plays, so the flip turn and the chains), the opponent's hero and life by turn. **Unverified:** that the match is unique enough. The first test is finding the maintainer's game of 22 Oct.

### The player's note

What neither source records: when you flipped (until FaBlazing fills it in), what was banished, and a line on what went wrong. Short and optional.

## What we measure

Each measure carries its evidence label (the council's rule): **Observed** in the CSV or the log, **Assumed** where it relies on a model or a proxy, **Extrapolated** beyond what the games cover.

| Measure                                                                                                                   | Source                                                                                  | Label                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Life by turn                                                                                                              | Starting life, CSV damage taken and life gained, tracked self-loss including blood debt | Observed inputs; any timing that relies on a model or proxy is Assumed               |
| Share of life lost to yourself                                                                                            | CSV damage taken and signed self-loss total                                             | Assumed: adding these observed inputs relies on them not overlapping                 |
| Blocking by turn, and **entering the blender**: the turn life falls low enough that the deck blocks with most of its hand | CSV                                                                                     | The blocking is Observed; the threshold is Assumed until the population data sets it |
| Damage dealt by turn N                                                                                                    | CSV                                                                                     | Observed                                                                             |
| Flip turn                                                                                                                 | FaBlazing log, or the note                                                              | Observed from the log; the note's is the player's word                               |
| Plan chains (a Gate and a blood debt card in one turn, and so on)                                                         | FaBlazing log                                                                           | Assumed (they're proxies; see [fablazing-chains.md](fablazing-chains.md))            |

A version's results are reported as counts ("7 of 10"), not percentages, and few games are called **promising** or **inconclusive**, never proven. A step the plan relies on that nobody else plays isn't a reason to drop it: finding those is the point.

The CSV's self-loss total is Observed. Gross life lost and its self-loss share are Assumed because the calculation relies on damage taken excluding self-loss. Independently known final life can check that calculation; a result of “Loser” alone does not establish zero life. Working out blood debt from tracked state is a separate calculation; document its inputs and check it against the recovered row losses and the observed total. A matched FaBlazing game's end-of-turn life totals are Observed too and can check the life curve.

### Where the FaBlazing population fits

- **Opponents:** what each hero does to Viserai, so the blender threshold and the engine's opponents are set by matchup.
- **A baseline:** "your plan flips on turn 3; the field flips on turn 2".
- **Outliers:** a player whose results beat their deck may have found something.

## What to build, in order

The immediate implementation order is in [AGENTS.md](../AGENTS.md): the standalone CSV parser, a report from its typed record, then deck versions. The list below describes the wider loop; upload and comparison follow the maintainer's review of those first pieces.

1. **Deck versions.** Opening a deck in FaBrary saves the list as a version. [Snapshot contents, repeat exports, ownership and deletion](deck-versions.md) are documented separately. FaBrary's import link sends the cards and nothing comes back, so the FaBrary deck id isn't known; the player can paste the FaBrary link onto the version if they want to. A new table needs grants and an entry in `06_privileges.test.sql`.
2. **Upload a game.** A CSV dropped onto a version, parsed and stored with the note. The CSV's cards are checked against the version's list; on a mismatch the site warns and suggests the version that fits.
3. **A report per game.** Life by turn, blocking, the blender, life lost to yourself, damage dealt.
4. **The deck's plan.** Turn goals written on the deck, carried across versions, each with the measure that checks it.
5. **Versions compared against the plan.** "Flipped by turn 3: v2 7 of 10, v3 4 of 9."
6. **The FaBlazing match.** Find the uploaded game in the next import and add the turn log and the opponent.
7. **Suggest the next change.** Tie a failing step to the cards that would fix it: entering the blender points at defence and at life lost to yourself, not at "a yellow banisher". This is where gap analysis becomes strategy-shaped.

Later, if wanted: once a match finds a player's hashed FaBlazing id, their games could be found without uploads. That needs the id to be stable over time, which is inferred, not confirmed.

## Open

- **For the maintainer:** what "the blender" threshold is to a player, before the data sets it, and the first deck plan to test.
- **Unverified (game logic):** that life lost to yourself is mostly blood debt.
- **Self-loss attribution:** agree which inputs separate blood debt from other self-loss in each CSV row. The report recovers signed self-loss timing from Total Value as Assumed, checked against the observed total; assigning its cause still needs evidence. The maintainer confirmed that self-loss can be tracked.
- Whether Talishar offers the CSV when stats are turned off.
- Whether the council should see a draft of steps 4 and 5: how to compare versions fairly on 10 to 20 games each, and how to weigh the player's note against the logs.
