# Does a 55–65% Viserai deck exist? (spike)

**UNVERIFIED.** Drafted by Claude on 29 Oct 2026 from real games. Every figure is an association, not a cause, and the reading of block slop and fatigue is the maintainer's, recorded below.

## The question

The maintainer's goal for VDB is to find out whether a Viserai list wins 55–65% on Talishar, or whether the hero tops out well below that. This page is the first pass at an answer from the FaBlazing data.

## How

```
go run ./cmd/fablazing ceiling [-min-games 50] [-top 15] ~/.cache/vdb/fablazing/viserai/*.csv
```

- Sides are kept by the same rules as `fablazing decks`: detailed, at least 4 turns, not abandoned, at most 20 per player a day and format.
- **Block slop is reported apart.** It's the archetype from [deck-archetypes.md](deck-archetypes.md) that runs the most Sink Below, Shelter from the Storm, Ripple Away and Fate Foreseen (archetype 6 there). The maintainer, 29 Oct 2026: it's a known block slop list that wins by fatiguing the game, not by using Viserai's mechanics.
- **Games decided by fatigue are reported apart**, whichever side won (the maintainer, 29 Oct 2026). A game counts as decided by fatigue when the loser's deck was empty at the end. `count_loser_deck` is read as the cards left in the loser's deck: it's 0 and 2 after a 19-round game, and 50 and 56 after one round. That reading is inferred, not confirmed by FaBlazing.
- **Pilots** are players with at least 50 kept sides, ranked by the lower edge of their 95% Wilson interval. A short lucky run doesn't outrank a long good one. Players are never named; only counts are printed.

## Results, 21 Sep to 27 Oct 2026

29,223 kept Viserai sides.

- **Viserai without block slop or fatigue:** 30.1% [29.5–30.6] over 27,347 sides. Counting each player once, it's 24.7% [23.4–25.9] over 1,623 players.
- **Block slop:** 41.3% [38.9–43.7] over 1,592 sides, 31.9% by player.
- **Decided by fatigue:** 284 sides, of which Viserai won 13.0%. Fatigue games are rare and mostly losses.

### Pilots

128 players have 50 or more sides.

- 3 won 55% or more.
- 2 have an interval wholly above 50%:
  - The top pilot won 66.7% [54.9–76.6] over 69 sides, every one of them nearest archetype 4 (Widespread Annihilation, Widespread Ruin, Deadwood Dirge, Revel, Eloquent Eulogy).
  - The second won 68.0% [54.2–79.2] over 50 sides, mostly archetype 5.
- **None has an interval wholly above 55%.**
- The busiest pilots, with 140 to 230 sides each, all sit between 46% and 49%.

With 128 pilots, one or two runs this high can happen by chance even if nobody is truly above 50%. So these two are leads, not proof.

### Deck or pilot

Each of the top 5 pilots' **signature** is the cards in at least half of their lists (18 to 24 cards). Lookalikes are other players' sides whose list is at least 50%, 60% or 70% similar to it (shared cards over all cards). The pilot's own sides are left out.

- **Pilot 1** (66.7%, archetype 4): at 70%+, 101 sides by 8 other players won 40.6% [31.5–50.3], or 28.9% counting each player once. Pilot 14 played 30% of them at 50%.
- **Pilot 2** (68.0%): almost nobody plays the list. 18 sides at 60%+, none at 70%+.
- **Pilot 3** (56.9%, archetype 4): at 70%+, 125 sides by 9 players won 56.0%. But 44% of those are pilot 1's, at 71%. Without pilot 1, the rest win about 44%, and 37.2% counting each player once.
- **Pilots 4 and 5** (51.7% and 49.3%, archetype 1): hundreds of other players run close lists, at 30–32%, the same as Viserai overall.

So the lists don't carry the pilots' results. The archetype 4 list (Widespread Annihilation, Ruin, Deadwood Dirge) does about 40% in other strong hands, above the 30% average, but nowhere near 55%. Players who copy a strong list may themselves be stronger than average, so even 40% may flatter the list.

```
go run ./cmd/fablazing ceiling [-like-top 5] [-share 0.5] ~/.cache/vdb/fablazing/viserai/*.csv
```

### Skill across heroes

Whole FaBlazing days for 21–24 Sep and 14–27 Oct 2026, both formats: 33 day-formats. FaBlazing answers status 500 for 25 Sep format 0, 14 Oct format 0, 18 Oct format 1 and 19 Oct format 0, so those are left out on both sides of the comparison. Each day keeps one small row per kept side, every hero, in `~/.cache/vdb/fablazing/sides/`; the day's CSV is deleted after.

```
FABLAZING_API_KEY=... go run ./cmd/fablazing fetch-sides -from 2026-10-14 -to 2026-10-27
go run ./cmd/fablazing skill ~/.cache/vdb/fablazing/viserai/*.csv
```

10,496 Viserai sides without block slop or fatigue on those days, and 166,141 sides on other heroes.

- **53 players** have 20 or more sides on both Viserai and other heroes. They win 33.0% on Viserai and 51.8% on their other heroes: **a gap of −18.8 points [−22.7 to −14.8]**, each player counted once.
- By the player's win rate on other heroes:
  - under 40%: Viserai 23.6% (11 players)
  - 40–50%: 30.4% (10)
  - 50–55%: 35.6% (6)
  - 55–60%: 37.4% (9)
  - 60–65%: 35.0% (9)
  - 65% and up: 34.8% (8)
- Players who win 60% or more elsewhere win about 35% on Viserai. Viserai's rate rises with skill up to about 55% elsewhere, then flattens.
- The top Viserai pilots mostly play nothing else, so they can't be adjusted: of the top 10 on these days, only 2 have 50+ sides on other heroes, at 47.7% and 53.8% there against 43.7% and 38.4% on Viserai.

Other heroes queue against much the same field, so the gap isn't mainly a different set of opponents. But players who split their games may not be typical Viserai players, and 53 is a small group.

The Viserai cap counts only games with Viserai in them, from the Viserai cache; the other heroes' cap counts every game. A player who hits 20 games in a day is capped slightly later on Viserai than elsewhere.

### Matchups

Viserai without block slop or fatigue, by opponent with 50 or more sides:

- Above 50%: Malice 53.8% (n=2,381) and Vynnset 50.4% (n=466). Forsaken Viserai at 67.0% is a mirror where the other side ended on the Forsaken.
- The common aggressive heroes are the worst: Fang 21.3% (n=1,596), Jarl 20.2% (n=1,939), Ira 21.5% (n=984) and Boltyn 27.6% (n=2,207).

## What this says so far

- No archetype as a whole is near 55% once block slop is set aside. The best real group is archetype 3, at 34.5% in [deck-archetypes.md](deck-archetypes.md).
- A handful of pilots reach 55–68% over 50 to 70 games, so a 55%+ result **in some hands** isn't ruled out. Their lists don't travel: in other players' hands the best one wins about 40%, so it's mostly the pilot.
- Players who also play other heroes lose about 19 points by switching to Viserai, and the strongest of them (60%+ elsewhere) win about 35% on it. At that gap, a 55% Viserai would need a pilot winning about 74% elsewhere.
- The players with the most Viserai games top out just under 50%. That points to a hero that's playable but well short of 55% in the current field. It's especially weak into the aggressive heroes that make up most of it.

## Not yet answered

1. **Deck or pilot** is answered above: mostly the pilot. The archetype 4 list is the best lead, at about 40% for others.
2. **Skill adjustment across heroes** is answered above for two weeks and four September days. The top Viserai pilots play almost nothing else, so their own skill is still unmeasured.
3. **The fatigue reading** of `count_loser_deck` needs confirming with FaBlazing.
