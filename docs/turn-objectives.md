# Turn objectives (draft)

**UNVERIFIED.** Drafted by Claude on 28 Oct 2026 from real games, for the maintainer to check. Nothing here is game logic the maintainer has approved, and nothing in the engine uses it yet.

## Why

The auto-player behind the full analysis plays every card it can, reds first, and pitches the highest pitch. On the maintainer's 52-card list it threatens about 4.6 damage a turn. The maintainer usually gets 9 to 14. In a goldfish game on 28 Oct, the maintainer's play came to 4, 5, 11 and 16 damage over four turns. Approving exact lines one at a time can't close that gap.

The proposal is to replace exact lines with **objectives**. Each turn, the engine searches its legal lines (plays, pitches, banish targets, the arsenal, the Tunic, the Nebula swing). It takes the first objective, in order, that one of those lines meets. The objectives come from what real players do and what goes with winning, not from a guess.

## The data

`fablazing turns` (in `services/fablazing`) over the 30 cached days, 21 Sep to 20 Oct 2026: 23,222 Viserai sides, after leaving out abandoned games, sides without detail, short games and players over the cap. Viserai wins about 30% of them. The figures are **associations, not causes**: a winning player may be able to take a line because they're already ahead.

Each own turn is sorted into a type:

| Type   | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| burst  | 9 or more damage threatened that turn, arcane included                           |
| defend | not a burst, and 2 or more hand cards blocked with in the opponent's turn before |
| build  | not a burst or defend, and a hand card played                                    |
| quiet  | none of these                                                                    |
| +flip  | traversed to the Usurper that turn                                               |
| +back  | traversed to the Forsaken that turn                                              |

The 9 is the bottom of the maintainer's usual 9 to 14. The 2 blocks is a guess.

How a round splits into each player's turn is inferred from the order of the log, not documented by FaBlazing. Going second, round 0 is only the opponent's first turn.

## Draft objectives

Win rates are for sides that had that type on that turn. Each row is tried in order; the engine takes the first that a line meets.

### Going first

**Turn 1**

| Order | Objective | Data                                                                                             |
| ----- | --------- | ------------------------------------------------------------------------------------------------ |
| 1     | Set up    | Build 33% (63% of sides). Flipping on turn 1 goes with worse results: 26–29%, even with a burst. |

**Turn 2**

| Order | Objective              | Data                    |
| ----- | ---------------------- | ----------------------- |
| 1     | Burst, flip, then back | 43% (n=1,320)           |
| 2     | Burst and flip         | 37% (n=3,604)           |
| 3     | Burst, or defend       | 28% each                |
| 4     | Build                  | 22%: the weakest turn 2 |

### Going second

**Turn 1** (the opponent's first turn comes before it)

| Order | Objective              | Data          |
| ----- | ---------------------- | ------------- |
| 1     | Burst, flip, then back | 39% (n=849)   |
| 2     | Burst and flip         | 34% (n=2,225) |
| 3     | Defend                 | 30% (n=2,405) |
| 4     | Build                  | 25%           |

So going second, a hand that can't burst blocks rather than builds.

**Turn 2**

| Order | Objective                            | Data   |
| ----- | ------------------------------------ | ------ |
| 1     | Burst and back, or burst, flip, back | 37–38% |
| 2     | Burst and flip, or burst             | 31–33% |
| 3     | Defend or build                      | 26%    |

### Turn 3 on, either way

| Order | Objective                            | Data   |
| ----- | ------------------------------------ | ------ |
| 1     | Burst and back, or burst, flip, back | 38–40% |
| 2     | Burst, or burst and flip             | 32–37% |
| 3     | Defend or build                      | 22–28% |

From turn 2, building or defending goes with losing. That may only mean those players had weak hands or were forced to block. The data can't tell.

### Sequences that stand out

| Own turns 1–4                                                       | Won | Sides               |
| ------------------------------------------------------------------- | --- | ------------------- |
| Going first: build > burst+flip+back > burst+flip+back > burst+flip | 59% | 129                 |
| Going first: build > burst+flip > burst+back > burst+flip           | 54% | 271                 |
| Going first: build > burst+flip > burst > burst                     | 41% | 648 (the commonest) |
| Going first: build > build > burst+flip > burst                     | 31% | 332                 |
| Going second: defend > burst+flip > burst+back > burst+flip         | 53% | 74                  |
| Going second: burst+flip > burst > burst > burst                    | 44% | 171                 |

The shape that wins most is: flip with a burst, come back to the Forsaken, flip again.

## Choosing between lines

When more than one line meets an objective (draft):

1. Most damage threatened.
2. Then most left for next turn: Runechants carried, blood debt cards face up in banish to play, cards in the arsenal.

When nothing offensive is met, defend. The engine has no opponent, so "defend" would mean holding blockers back rather than spending them.

## The maintainer's goldfish game against these objectives

Going first, the maintainer's 52-card list, 28 Oct:

| Turn | Played     | Damage | Draft objective says             |
| ---- | ---------- | ------ | -------------------------------- |
| 1    | build      | 4      | set up: matches                  |
| 2    | build      | 5      | try burst and flip first         |
| 3    | burst+flip | 11     | burst and back would rank higher |
| 4    | burst      | 16     | matches                          |

Turn 2 is the question. The hand was Arknight Descendancy (blue), Demonbound Gloomblade (red), Enshrine Sin (blue) and Murmuring Gloomblade (blue), with 1 Runechant carried and Runechant of Greed in the arsenal. The turn made 2 Runechants. Would playing Greed from the arsenal have made the 3rd and flipped on turn 2? Or was holding it right? Only the maintainer can say.

## Open questions for the maintainer

1. Do these objectives and their order match how you play?
2. **Set up on turn 1:** what should it leave behind? Runechants carried, a blood debt card face up in banish, a sinchant in the arsenal? The data can't see Runechants or the banished zone, so this has to come from you.
3. **Coming back:** is "back" a goal in itself, so you can flip again next turn, or a side effect of using a Gate?
4. **Burst at 9:** is that the right line, or should there be a second level, for example 14?
5. **Defending without an opponent:** how many cards should the engine hold back, and which?
6. **Turn 2 of your game:** could Greed have flipped it?

## Not covered

- Card-level choices: which blue to pitch, which Gloomblade to banish. These come next, from the cards each turn type used (the `fablazing turns` output lists them).
- The opponent's hero. The data could split by matchup, but the samples get small.
