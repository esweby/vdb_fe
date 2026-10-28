# One real game against the line chooser

**UNVERIFIED, and not a calibration: this is one game.** Written by Claude on 28 Oct 2026. It sets the maintainer's Talishar match report beside the [line chooser](turn-objectives.md#scoring-settings) (`chooseLine`, `playByObjectives` in `packages/engine/src/rules/objectives.ts`, default settings, main at dc6c3a5). It sorts each gap by where it comes from: the chooser's choices, or what the engine doesn't model. Flesh and Blood rules and card readings here are for the maintainer to check.

## The game

Talishar's stats export, 28 Oct 2026 (`game-stats-2026-10-28T17-10-19.csv`). The maintainer played Viserai, went first and won in 14 of their own turns. The opponent's stats weren't exported.

- **The list.** The main 52 are the hosted deck `bbc67162` ("Regular"), the same as `apps/web/scripts/fixtures/maintainer-52.txt`. Six cards that were played or seen in the game come from its sideboard: Cull, Embrace Sin, Razor Reflex, Weeping Battleground, Call for Backup and Plundersong Gloomblade. So the game was played after sideboarding, and the report doesn't say what came out. The engine runs the main 52. Of the six, it models Cull, Embrace Sin and Plundersong. Razor Reflex, Weeping Battleground and Call for Backup aren't modelled.
- **Rows.** Each Talishar row is one round: the maintainer's turn ("played", "pitched", "threatened") and then the opponent's ("blocked", "taken"). The in-game stats screen in the screenshot leaves out the CSV's turn 1, so its row _n_ is the CSV's turn _n_ + 1. Its "Self-Lost" column isn't in the CSV. Its total (−17) plus the −1 implied by turn 1's value makes the CSV's −18.
- **Value.** Talishar's value per turn works out as threatened + damage blocked + life gained + self-lost on every row (for example, turn 11: 23 + 0 + 0 − 1 = 22).
- **The last attack isn't counted.** The maintainer's last attack, a Usurp the Shadow Throne, won the game, but Talishar doesn't count its damage (the maintainer, 28 Oct 2026). Turn 14 shows 5 threatened and 0 dealt, so the game's totals (130 threatened, 41 dealt) are a little low. The comparison below covers turns 1–12, so its figures don't change.

| Own turn | Played | Pitched | Resources used | Threatened | Dealt | Self-lost | Cards blocked (their turn) | Taken |
| -------: | -----: | ------: | -------------: | ---------: | ----: | --------: | -------------------------: | ----: |
|        1 |      1 |       2 |              2 |          0 |     0 |        −1 |                          0 |     0 |
|        2 |      2 |       1 |              2 |          4 |     0 |        −1 |                          0 |     2 |
|        3 |      1 |       1 |              1 |          5 |     0 |        −1 |                          0 |     2 |
|        4 |      1 |       1 |              2 |          4 |     0 |        −2 |                          2 |     0 |
|        5 |      5 |       1 |              2 |         18 |    11 |        −6 |                          2 |     0 |
|        6 |      2 |       4 |              9 |         18 |     5 |        −1 |                          0 |     0 |
|        7 |      3 |       1 |              3 |         14 |     7 |         0 |                          0 |     0 |
|        8 |      3 |       1 |              1 |         10 |     1 |         0 |                          0 |     0 |
|        9 |      1 |       1 |              2 |          0 |     0 |        −1 |                          1 |     3 |
|       10 |      3 |       1 |              1 |          9 |     0 |        −2 |                          1 |     5 |
|       11 |      4 |       3 |              7 |         23 |    10 |        −1 |                          0 |     5 |
|       12 |      5 |       2 |              5 |         20 |     7 |        −1 |                          0 |     4 |
|       13 |      0 |       0 |              0 |          0 |     0 |        −1 |                          2 |     0 |
|       14 |      2 |       2 |              7 |          5 |     0 |         0 |                          2 |     1 |

Self-lost is from the screenshot, shifted by one row; turn 1's −1 is inferred from its value.

## The chooser on the same list

`playByObjectives` with the default settings: 200 goldfish games going first, seed 20261028 (the same games as `compare-line-scoring.ts`), 12 turns, no opponent. These are averages over the 200 games, set against one game.

"Threatened" is the line's own count (power + arcane + 2 per usurp), the one the chooser scores. The batch count in `turn-objectives.md` (7.7 a turn over turns 1–4) leaves arcane out (`batch.ts` counts printed power and usurps), so it reads lower on the same games. Both are shown here. Whether Talishar's "threatened" includes arcane is the maintainer's to say.

| Turn | Threatened | No arcane | Burst 9+ | Big 14+ | Cards played | Pitched | Pitch value | Hand held | Flipped | Life lost |
| ---: | ---------: | --------: | -------: | ------: | -----------: | ------: | ----------: | --------: | ------: | --------: |
|    1 |        6.6 |       5.7 |      29% |      9% |          2.6 |     0.9 |         2.2 |       0.1 |     29% |       1.5 |
|    2 |        9.9 |       8.4 |      56% |     24% |          3.1 |     1.2 |         2.8 |       0.3 |     33% |       2.1 |
|    3 |        9.2 |       8.1 |      51% |     21% |          2.8 |     1.3 |         3.1 |       0.3 |     23% |       2.5 |
|    4 |       10.1 |       8.6 |      60% |     26% |          3.0 |     1.3 |         3.0 |       0.3 |     33% |       3.2 |
|    5 |        9.8 |       8.6 |      61% |     22% |          3.0 |     1.3 |         3.1 |       0.3 |     29% |       3.5 |
|    6 |        9.5 |       8.3 |      55% |     21% |          2.9 |     1.3 |         3.1 |       0.4 |     27% |       3.9 |
|    7 |        9.6 |       8.5 |      59% |     20% |          2.9 |     1.3 |         3.2 |       0.3 |     28% |       4.3 |
|    8 |        9.4 |       8.3 |      57% |     22% |          2.8 |     1.3 |         3.4 |       0.4 |     26% |       4.7 |
|    9 |        9.3 |       8.2 |      54% |     18% |          2.8 |     1.3 |         3.2 |       0.4 |     26% |       5.2 |
|   10 |        7.7 |       7.0 |      39% |     10% |          2.5 |     1.2 |         3.0 |       0.6 |     20% |       5.5 |
|   11 |        8.1 |       7.3 |      41% |     14% |          2.4 |     1.3 |         3.4 |       0.7 |     18% |       6.0 |
|   12 |        7.0 |       6.4 |      32% |      9% |          2.1 |     1.0 |         2.8 |       0.9 |     10% |       6.3 |

Burst and big burst use the line's count (with arcane). Without arcane they're 40% and 7% over turns 1–12. "Pitch value" is the resources the pitched cards make, which is close to what the line spends, because the chooser pitches only to pay. The chooser activated equipment in no turn of any game.

## Side by side

| Measure                        | The game (one)    | Chooser (200 games)                 |
| ------------------------------ | ----------------- | ----------------------------------- |
| Threatened, own turns 1–4      | 3.3 (0, 4, 5, 4)  | 8.9 (7.7 without arcane)            |
| Threatened, own turns 5–12     | 14.0              | 8.8 (7.8)                           |
| Threatened, own turns 1–12     | 10.4              | 8.8 (7.8)                           |
| Burst (9+), turns 1–12         | 7 of 12 (58%)     | 50% (40%)                           |
| Big burst (14+), turns 1–12    | 5 of 12 (42%)     | 18% (7%)                            |
| Nothing threatened, turns 1–12 | 2 of 12 (1 and 9) | under 1%                            |
| Cards played, turns 1–12       | 2.6               | 2.7                                 |
| Turns playing 4 or more cards  | 3 of 12           | not counted                         |
| Cards pitched, turns 1–12      | 1.6               | 1.2                                 |
| Resources, turns 1–12          | 3.1 used          | 3.0 pitched                         |
| Life self-lost per turn, 1–12  | 1.4               | 4.1 (1.5 on turn 1, 6.3 by turn 12) |

The game's turns 13 and 14 are left out so the spans match the 12 the engine ran.

## Where the gaps come from

### From the chooser's choices

1. **It goes all-in from turn 1.** In the game the maintainer threatened 0, 4, 5 and 4 over the first four turns, set up, and blocked with 2 cards in the opponent's turn 4. The chooser threatens about 9 a turn from turn 2 and bursts in more than half of those turns. That's because every setting rewards damage now, and the chooser doesn't use the turn number. This matches the turn-1 disagreement in the goldfish game (`turn-objectives.md`). Part of it is the opponent (below): the maintainer took 2 damage in each of rounds 2 and 3.
2. **It never has a quiet or blocking turn.** The game had 0-threat turns at 1, 9 and 13, and turns 9 and 13 kept cards to block. `holdBack` has no default, so the chooser holds about 0.3 hand cards a turn early and plays or pitches the rest. That's a setting the maintainer left open, not a rule the engine lacks. What it should be still needs an opponent to decide (below).
3. **Its life loss climbs.** The chooser loses about 1.5 life on turn 1 and about 6 a turn by turn 12. Blood-debt cards build up in its banish, and `lifeLost` costs only 0.5 per life. The game lost about 1.4 a turn, with one bad turn (−6 on turn 5). This is the clearest choice gap, and the one most worth the maintainer's look. Two things are open: whether the chooser should play banished blood-debt cards out sooner or banish fewer, and whether Talishar's "Self-Lost" counts blood debt the same way. Both are UNVERIFIED.
4. **It's even where the game was spiky.** On average the two play about the same number of cards (2.7 a turn against 2.6) and pitch about the same (1.2 against 1.6, about 3 resources). But the game went slow early (0, 4, 5, 4) and then hit 18, 18, 14, 10, 0, 9, 23 and 20, with three turns of 4 or 5 cards. The chooser does about 9 every turn, and its big bursts (18% of turns) are half as common as the game's (5 of 12). Some of this may be choice: the width weight (0.5 a card) is small next to the burst bonuses, and nothing rewards saving up for a bigger turn. Most of it is likely the modelling gaps below. One game can't separate the two.

### From what the engine doesn't model

1. **The opponent.** There's no blocking, no damage taken and no clock. In the game only 41 of the 130 threatened was dealt; the report doesn't say how the opponent stopped the rest. In the opponent's turns the maintainer blocked 28 damage, with 10 hand cards and equipment, and took 22. Pressure in rounds 2, 3 and 9–12 probably shaped the turns that followed, and the engine can't see that.
2. **Combat bonuses.** The engine counts printed power and usurps. It misses Otherworldly Sins' +3 (played once in this game) and other combat effects, such as the +2 on a blue Demonbound Gloomblade in this game (its source is unknown). These raise exactly the turns that turn a burst into a big burst.
3. **Equipment.** Talishar shows Grasp of the Arknight activated 4 times, Fyendal's Spring Tunic twice and Snapdragon Scalers once. Face Purgatory blocked once. The engine models none of the four (task 8), so it never activates equipment. The Seven Sin Nebula (3 activations, 2 hits) is the weapon, which the engine does attack with.
4. **Runechant of Greed counting as a Runechant.** Greed was played once in the game. Without this, the engine reaches 3 Runechants (flip and usurp) later than the real card allows.
5. **The sideboard.** The game had Cull ×2, Razor Reflex, Weeping Battleground and Embrace Sin, and Call for Backup blocked. The engine ran the main 52. Razor Reflex, Weeping Battleground and Call for Backup aren't modelled in any case.
6. **Counting.** If Talishar's "threatened" leaves arcane out, the right engine figure is the lower, no-arcane one.

## Not concluded

- Nothing here changes a weight. One game against 200 goldfish games can show which direction the gaps go, not how big they are.
- Whether the maintainer's slow first four turns were the hand, the opponent's pressure or a choice can't be read from the report. The turn-by-turn log of plays would answer it, and so would the FaBlazing data, which shows building early goes with worse results from turn 2 (`turn-objectives.md`).
- How the scratch figures were made: a throwaway script around `playByObjectives` over `runBatch`'s seeds, plus `compare-line-scoring.ts --runs 200`. Neither is checked in.
