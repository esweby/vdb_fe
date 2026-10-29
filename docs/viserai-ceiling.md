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

### Matchups

Viserai without block slop or fatigue, by opponent with 50 or more sides:

- Above 50%: Malice 53.8% (n=2,381) and Vynnset 50.4% (n=466). Forsaken Viserai at 67.0% is a mirror where the other side ended on the Forsaken.
- The common aggressive heroes are the worst: Fang 21.3% (n=1,596), Jarl 20.2% (n=1,939), Ira 21.5% (n=984) and Boltyn 27.6% (n=2,207).

## What this says so far

- No archetype as a whole is near 55% once block slop is set aside. The best real group is archetype 3, at 34.5% in [deck-archetypes.md](deck-archetypes.md).
- A handful of pilots reach 55–68% over 50 to 70 games, so a 55%+ result **in some hands** isn't ruled out. Their lists don't travel: in other players' hands the best one wins about 40%, so it's mostly the pilot.
- The players with the most Viserai games top out just under 50%. That points to a hero that's playable but well short of 55% in the current field. It's especially weak into the aggressive heroes that make up most of it.

## Not yet answered

1. **Deck or pilot** is answered above: mostly the pilot. The archetype 4 list is the best lead, at about 40% for others.
2. **Skill adjustment across heroes.** The S3 store and the cache hold Viserai games only, so there's no record of how these players do on other heroes. That needs the full daily files (about 200 MB a day) from FaBlazing, which is the maintainer's call.
3. **The fatigue reading** of `count_loser_deck` needs confirming with FaBlazing.
