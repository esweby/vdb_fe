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

| # | Runs more than lists overall | Sides | Players | Won |
| - | --- | --- | --- | --- |
| 1 | Sloth, Sinspeaker, Usurp the Shadow Throne, Greed, Pull from Beyond (blue), Shadow of Ursur | 8,241 | 750 | 29.8% |
| 2 | Sinspeaker, Bloodfrenzy (red), Plundersong, Sloth, Greed, Demonbound (red) | 5,802 | 729 | 25.7% |
| 3 | Vantom Wraith (both), Widespread Destruction, Revel in Runeblood, Widespread Annihilation, Malefic (yellow) | 5,281 | 517 | **34.5%** |
| 4 | Widespread Annihilation, Widespread Ruin, Deadwood Dirge, Revel, Widespread Destruction, Eloquent Eulogy | 4,444 | 525 | 30.9% |
| 5 | Bloodfrenzy (blue), Shadowrealm Walker (both), Embrace Ursur (blue), Demonbound (blue), Widespread Destruction | 1,652 | 279 | 27.1% |
| 6 | Sink Below, Shelter from the Storm, Haunting Rendition, Dimenxxional Ferryman, Fate Foreseen, Ripple Away | 1,592 | 242 | **41.3%** |
| 7 | Shadowrealm Walker (red), Runeblood Incantation (red), Enshrine Sin (red), Demonbound (both), Malefic (yellow) | 1,147 | 159 | 33.2% |
| 8 | Seeds of Agony, Rites of Nightfall, Demonbound (blue), Enshrine Sin (red), Vantom Wraith (red), Invert Existence | 1,064 | 189 | 26.9% |

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

| Group | Sides | Players | Won | Threatened a turn | Brick | Big | Peak | Played Usurp | In losses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lookalikes (60%+) | 419 | 92 | 32.7% [28.4–37.3] | 9.0 | 28% | 26% | 32% | 28% | 18% |
| 1: sinchants and Usurp | 8,241 | 750 | 29.8% | 9.0 | 26% | 24% | 34% | 22% | 16% |
| 3: Vantom and Widespread | 5,281 | 517 | 34.5% | 9.4 | 29% | 31% | 46% | 1% | 1% |
| 4: Widespread and Deadwood | 4,444 | 525 | 30.9% | 8.7 | 30% | 26% | 36% | 6% | 4% |
| 6: defence reactions | 1,592 | 242 | 41.3% | 4.7 | 58% | 6% | 6% | 12% | 11% |

FaBlazing doesn't log a game's last attack, so a Usurp that won the game can be missed. Losses are the cleaner count, which is why they get their own column.

Against the write-up:

1. **RG.** Partly borne out. Archetype 3 has the higher average (9.4 against 9.0) and slightly more bricks (29% against 28%). But it has the *higher* ceiling: 31% of its turns are big, and 46% of its sides reach 18, against 26% and 32% for the lookalikes. It also wins more (34.5% against 32.7%, with overlapping intervals).
2. **Flipping.** Not measured here. The turn types (`fablazing turns`) count flips and returns, and could split them by archetype next.
3. **Usurp every game.** Not borne out by the logs. The lookalikes played Usurp in 28% of games, and in 18% of losses. Even archetype 1 plays it in 22%. The earlier one-off count found the same: Usurp turns are big, about 20 threatened, but rare.

Archetype 6 is the odd one out. It threatens half as much, bricks on 58% of turns, and still wins most. That fits a defensive plan that wins long games, not the burst model behind these thresholds.

## Caveats

- **Who plays it.** A deck that strong players choose will look strong. Archetype 6 has 242 players, about 6.6 sides each, so it isn't a handful of people, but its win rate isn't adjusted for player skill.
- **Matchups.** The win rates aren't split by opponent. A defensive list may do well into the aggressive heroes that are common now.
- **Lift is inside one archetype.** A card's lift compares lists in the same cluster that do and don't run it. It isn't a cause, and small samples (n under 100) swing.
- **Game logic.** Whether these packages make sense together is the maintainer's call.

## Next

- Split the lookalikes by whether they run 3 Usurp, and by flips and returns.
- Weigh each player equally (one vote per player) to check archetype 6's 41%.
- Split the top archetypes by opponent.
