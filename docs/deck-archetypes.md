# Deck archetypes (spike)

**UNVERIFIED.** Drafted by Claude on 28 Oct 2026 from real games, to help find the maintainer a deck. The archetypes are clusters, not names a player gave them, and the card names in each are what the clustering found, not a judgement of the cards. Every figure is an association, not a cause.

## How

`fablazing decks` (in `services/fablazing`) groups each kept Viserai side's list by the cards it runs, with k-means on card inclusion. It uses the cards in at least 2% of lists, with k-means++ seeds and 10 restarts, keeping the tightest. Sides are kept by the same rules as `fablazing turns`: detailed, at least 4 turns, not abandoned, and at most 20 per player a day and format. A list is the cards FaBlazing recorded for the side, which can include the sideboard. Lists average 62–64 cards in every archetype.

```
go run ./cmd/fablazing decks [-k 8] [-format 0|1] [-seed 1] ~/.cache/vdb/fablazing/viserai/*.csv
```

## The data

21 Sep to 27 Oct 2026, both formats, all 74 files: 29,223 kept sides. The days from 21 Oct come from the pipeline's raw store in S3, including the three that were missing (18 Oct format 1 and 19 Oct). Viserai wins 30% of the kept sides.

There are 23,096 different lists among 34,297 detailed sides, so almost nobody plays the same 60. About 10 cards are in more than 70% of lists, including Become the Shadow Lord, Malefic Incantation (red), Murmuring Gloomblade (red), Arknight Descendancy and Cullingsong Gloomblade. The archetypes differ in what goes around them.

## Archetypes (k = 8)

The same 8 come out with seeds 1, 2 and 3, within a few dozen sides. At k = 12 the big ones split, and the top two win rates stay the same groups.

| #   | Runs more than lists overall                                                                                     | Sides | Players | Won       |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----- | ------- | --------- |
| 1   | Sloth, Sinspeaker, Usurp the Shadow Throne, Greed, Pull from Beyond (blue), Shadow of Ursur                      | 8,241 | 750     | 29.8%     |
| 2   | Sinspeaker, Bloodfrenzy (red), Plundersong, Sloth, Greed, Demonbound (red)                                       | 5,802 | 729     | 25.7%     |
| 3   | Vantom Wraith (both), Widespread Destruction, Revel in Runeblood, Widespread Annihilation, Malefic (yellow)      | 5,281 | 517     | **34.5%** |
| 4   | Widespread Annihilation, Widespread Ruin, Deadwood Dirge, Revel, Widespread Destruction, Eloquent Eulogy         | 4,444 | 525     | 30.9%     |
| 5   | Bloodfrenzy (blue), Shadowrealm Walker (both), Embrace Ursur (blue), Demonbound (blue), Widespread Destruction   | 1,652 | 279     | 27.1%     |
| 6   | Sink Below, Shelter from the Storm, Haunting Rendition, Dimenxxional Ferryman, Fate Foreseen, Ripple Away        | 1,592 | 242     | **41.3%** |
| 7   | Shadowrealm Walker (red), Runeblood Incantation (red), Enshrine Sin (red), Demonbound (both), Malefic (yellow)   | 1,147 | 159     | 33.2%     |
| 8   | Seeds of Agony, Rites of Nightfall, Demonbound (blue), Enshrine Sin (red), Vantom Wraith (red), Invert Existence | 1,064 | 189     | 26.9%     |

Win rates hold across formats and who went first, within a few points, except archetype 6: 45% going first, 38% going second.

### Archetype 6: defence reactions and generics

It has no core: no card outside the shared Viserai cards is in 80% of its lists. What they share is defence: Sink Below, Shelter from the Storm, Ripple Away and Fate Foreseen, plus generic blues such as Fearless Confrontation, Truce and Warmonger's Diplomacy. Inside it, lists with Fearless Confrontation won 65% (n=302) against 36% without, and with Ripple Away 55% (n=725) against 30%. Lists with Reduce to Runechant or Bequest the Vast Beyond did worse.

### Archetype 3: Vantom and Widespread

The strongest big group. Inside it, Arknight Shard (36% against 29%) and Widespread Annihilation go with winning. Bloodfrenzy Gloomblade (red) goes with losing: 28% against 37% (n=1,396).

## Placing the Sinspeaker and Usurp list

On 28 Oct the maintainer shared a list ([lists/sinspeaker-usurp.txt](lists/sinspeaker-usurp.txt)): 54 cards with 3 Usurp the Shadow Throne, Sinspeaker, Plundersong, Pull from Beyond, 3 Lust and 2 Sloth, and no Revel, Mordred or Annihilation. Its write-up argued:

1. Against Revel, Mordred and Widespread ("RG") builds: RG has a stronger average turn, but more acute failure states and a lower ceiling.
2. Against flip-focused builds: Gate makers are weak, so this list uses banish effects to stay in Usurper longer instead.
3. It resolves a Usurp the Shadow Throne "essentially every game".

```
go run ./cmd/fablazing like ../../docs/lists/sinspeaker-usurp.txt ~/.cache/vdb/fablazing/viserai/*.csv
```

It sits nearest **archetype 1** (sinchants with Usurp and Pull from Beyond). Nobody plays exactly this list. Among kept sides, by similarity to its 20 main deck cards (shared over all cards, and a recorded list can include the sideboard): 4,285 sides are at 50% or more, 419 at 60%, 51 at 70% and 1 at 80%.

Own turns 1 to 4. Brick means under 5 threatened, big means 14 or more, and peak means a side's best turn reached 18. The thresholds are a guess, UNVERIFIED.

| Group                      | Sides | Players | Won               | Threatened a turn | Brick | Big | Peak | Played Usurp | In losses |
| -------------------------- | ----- | ------- | ----------------- | ----------------- | ----- | --- | ---- | ------------ | --------- |
| Lookalikes (60%+)          | 419   | 92      | 32.7% [28.4–37.3] | 9.0               | 28%   | 26% | 32%  | 28%          | 18%       |
| 1: sinchants and Usurp     | 8,241 | 750     | 29.8%             | 9.0               | 26%   | 24% | 34%  | 22%          | 16%       |
| 3: Vantom and Widespread   | 5,281 | 517     | 34.5%             | 9.4               | 29%   | 31% | 46%  | 1%           | 1%        |
| 4: Widespread and Deadwood | 4,444 | 525     | 30.9%             | 8.7               | 30%   | 26% | 36%  | 6%           | 4%        |
| 6: defence reactions       | 1,592 | 242     | 41.3%             | 4.7               | 58%   | 6%  | 6%   | 12%          | 11%       |

FaBlazing doesn't log a game's last attack, so a Usurp that won the game can be missed. Losses are the cleaner count, which is why they get their own column.

Against the write-up:

1. **RG.** Partly borne out. Archetype 3 has the higher average (9.4 against 9.0) and slightly more bricks (29% against 28%). But it has the _higher_ ceiling: 31% of its turns are big, and 46% of its sides reach 18, against 26% and 32% for the lookalikes. It also wins more (34.5% against 32.7%, with overlapping intervals).
2. **Staying in Usurper.** Borne out: see the split below.
3. **Usurp every game.** Not borne out by the logs. The lookalikes played Usurp in 28% of games and 18% of losses, and even those running 3 played it in only 40%. The earlier one-off count found the same: Usurp turns are big, about 20 threatened, but rare.

### Split by Usurp copies, flips and returns

The lookalikes split by how many Usurp the Shadow Throne the recorded list runs. Flip and back are the sides that flipped to the Usurper, or came back to the Forsaken, by own turn 4. "Usurper turns per flip" is over the whole game: own turns that began as the Usurper, divided by flips.

| Group                       | Sides | Players | Won                   | Played Usurp (losses) | Flip by t4 | Back by t4 | Backs per flip | Usurper turns per flip |
| --------------------------- | ----- | ------- | --------------------- | --------------------- | ---------- | ---------- | -------------- | ---------------------- |
| Lookalikes, 3 Usurp         | 255   | 51      | **36.1%** [30.4–42.1] | 40% (26%)             | 93%        | 27%        | 36%            | **3.45**               |
| Lookalikes, 1–2 Usurp       | 158   | 55      | 25.3% [19.2–32.6]     | 11% (8%)              | 91%        | 49%        | 53%            | 1.95                   |
| 1: sinchants and Usurp      | 8,241 | 750     | 29.8%                 | 22% (16%)             | 91%        | 44%        | 52%            | 2.31                   |
| 3: Vantom and Widespread    | 5,281 | 517     | 34.5%                 | 1% (1%)               | 97%        | 61%        | 64%            | 1.62                   |
| 4: Widespread and Deadwood  | 4,444 | 525     | 30.9%                 | 6% (4%)               | 94%        | 50%        | 58%            | 1.98                   |
| 6: defence reactions        | 1,592 | 242     | 41.3%                 | 12% (11%)             | 67%        | 3%         | 9%             | 8.83                   |
| 7: Shadowrealm and Enshrine | 1,147 | 159     | 33.2%                 | 15% (11%)             | 97%        | 69%        | 68%            | 1.28                   |

Six lookalikes run no Usurp, too few to show.

- **Three Usurp is the version that wins.** Lookalikes with 3 won 36%, against 25% with 1 or 2. The intervals don't overlap, but it's 51 players, so a few strong ones could carry it.
- **Counting each player once, it still leads, but by less and less surely.** Each player's own win rate counts once, with a 95% bootstrap interval over players:

  | Group                 | Players | Won, by side | Won, by player    | Busiest player's sides | Their won | The rest won |
  | --------------------- | ------- | ------------ | ----------------- | ---------------------- | --------- | ------------ |
  | Lookalikes, 3 Usurp   | 51      | 36.1%        | 29.9% [20.1–40.0] | 20%                    | 34%       | 36.6%        |
  | Lookalikes, 1–2 Usurp | 55      | 25.3%        | 24.7% [16.1–34.3] | 9%                     | 20%       | 25.9%        |
  | All kept Viserai      | 1,707   | 30.5%        | 25.5% [24.3–26.8] | 1%                     | 29%       | 30.5%        |

  The busiest player isn't carrying it: without them, the rest still win 36.6%. Every group drops by player, because players with many games win more than players with a few. So compare against all Viserai on the same footing. By player, 3 Usurp is 29.9% against 25.5%, about 4 points up, which is close to the 6 points by side. But with 51 players the interval runs from 20% to 40%, so the data can't confirm it. 1–2 Usurp sits at the baseline.

- **It stays in Usurper about twice as long per flip.** 3.45 own turns against 1.62 for archetype 3, which fits the write-up's plan. It comes back to the Forsaken less: 27% by turn 4 against 61%. Earlier, coming back went with winning across all lists (`docs/turn-objectives.md`), so this list wins a different way.
- **Archetype 6 barely comes back.** Once it flips, it stays: 8.8 own turns per flip. Only 67% flip by turn 4.

Archetype 6 is the odd one out. It threatens half as much, bricks on 58% of turns, and still wins most. That fits a defensive plan that wins long games, not the burst model behind these thresholds.

## Placing the ultra aggro list

On 28 Oct the maintainer shared a second list, "ultra aggro inspired" ([lists/ultra-aggro.txt](lists/ultra-aggro.txt)). It has 59 cards and 23 different cards in the main deck: Bloodfrenzy (red and yellow), Sinspeaker, Swarming Gloomveil, Embrace Ursur, Runic Reaving, Shadowrealm Ripper, all three sinchants and 3 Usurp, with no Pull from Beyond or Plundersong.

It sits nearest **archetype 2** (Sinspeaker, Bloodfrenzy and Plundersong), the weakest big group at 25.7%. Few real lists are close to it. Among kept sides, by similarity to its main deck: 2,263 sides are at 50% or more, **151 (from 40 players) at 60%**, 1 at 70% and none at 80%.

| Group                         | Sides  | Players | Won, by side      | Won, by player    | Threatened a turn | Brick   | Big | Peak | Usurper turns per flip |
| ----------------------------- | ------ | ------- | ----------------- | ----------------- | ----------------- | ------- | --- | ---- | ---------------------- |
| Aggro lookalikes (60%+)       | 151    | 40      | 32.5% [25.5–40.3] | 23.1% [13.1–34.4] | **9.7**           | **23%** | 27% | 40%  | 2.49                   |
| Usurp lookalikes, 3 Usurp     | 255    | 51      | 36.1%             | 29.9% [20.1–40.0] | 8.8               | 30%     | 25% | 34%  | 3.45                   |
| 2: Sinspeaker and Bloodfrenzy | 5,802  | 729     | 25.7%             |                   | 8.7               | 27%     | 23% | 30%  | 2.14                   |
| 3: Vantom and Widespread      | 5,281  | 517     | 34.5%             |                   | 9.4               | 29%     | 31% | 46%  | 1.62                   |
| All kept Viserai              | 29,223 | 1,707   | 30.5%             | 25.5% [24.3–26.8] |                   |         |     |      |                        |

- **It does what it says on the turns.** The lookalikes threaten the most per turn of any group (9.7) and brick the least (23% of own turns 1 to 4).
- **The win rate is one player's.** The busiest player has 23% of the sides and won 50%. The rest won 27.4%, and by player the group is 23.1%, at or below the Viserai baseline. There's too little data to say the list wins more.
- Only 39 of the lookalikes run 3 Usurp, too few to split.

## Caveats

- **Who plays it.** A deck that strong players choose will look strong. Archetype 6 has 242 players, about 6.6 sides each, so it isn't a handful of people, but its win rate isn't adjusted for player skill.
- **Matchups.** The win rates aren't split by opponent. A defensive list may do well into the aggressive heroes that are common now.
- **Lift is inside one archetype.** A card's lift compares lists in the same cluster that do and don't run it. It isn't a cause, and small samples (n under 100) swing.
- **Game logic.** Whether these packages make sense together is the maintainer's call.

## Next

- Recheck the 3-Usurp lookalikes as more days arrive: about 50 players is too few to settle it.
- Weigh each player equally (one vote per player) to check archetype 6's 41%.
- Split the top archetypes by opponent.
