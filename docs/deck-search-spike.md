# Deck-search spike

Status, 30 Oct 2026: **UNVERIFIED.** The blocking model, the score and the pilot are Claude's draft. The maintainer hasn't checked them, and no deck here has been played.

The question was whether searching over decks with the goldfish is useful enough to justify verifying more cards. The search looks for a ceiling, not proof. The maintainer can play anything it finds.

## Method

- **Pool:** every verified card and pitch in local Supabase, 172 variants. Weapons and equipment aren't searched. They come from the first start list: Seven Sin Nebula, Face Purgatory, Fyendal's Spring Tunic, Grasp of the Arknight and Snapdragon Scalers.
- **Search:** a hill climb. Each step makes 1–3 single-copy swaps within copy limits. Every deck plays the same seeds, and a swap is kept only if it beats the best score by 0.15. The run used 40 steps per start and 300 four-turn games per deck.
- **Starts:** `maintainer-52`, `marlynn-57` (both fully verified) and one random 52-card deck.
- **Confirmation:** each start and its best deck replayed 1,000 games on fresh seeds, at each hold-back level.
- Code: [deckSearch.ts](../apps/web/src/calibration/deckSearch.ts), [deck-search.ts](../apps/web/scripts/deck-search.ts). One run takes about an hour on 9 threads.

```bash
node apps/web/scripts/deck-search.ts --start apps/web/scripts/fixtures/maintainer-52.txt --start apps/web/scripts/fixtures/marlynn-57.txt --random 1 --steps 40 --runs 300 --confirm 1000 --out spike.json
```

### Blocking model (UNVERIFIED)

The maintainer's point (30 Oct): other decks can give up two cards for 6 defence without hurting their turn, but Viserai is aggro locked. So each turn must leave `holdBack` hand cards unused (0, 1 or 2). Those cards count as blockers spent on the opponent's turn. They go to the graveyard and the turn is replayed without them, so the next hand draws back up to four rather than keeping them. The climb used hold 2.

### Score (UNVERIFIED)

Each turn scores the damage it threatens, plus 4 for a burst (9+) and 4 more for a big turn (14+). The score is the mean of those turns. A brick is under 5.

## Results

On fresh seeds, 1,000 games of 4 turns each:

| Deck | Hold | Mean threat | Brick | Burst 9+ | Big 14+ | Score |
|---|---|---|---|---|---|---|
| maintainer-52 start | 0 | 9.19 | 18% | 54% | 19% | 12.12 |
| | 1 | 7.85 | 22% | 39% | 10% | 9.84 |
| | 2 | 5.27 | 49% | 14% | 2% | 5.91 |
| maintainer-52 best | 0 | 9.68 | 11% | 58% | 22% | 12.88 |
| | 1 | 8.30 | 18% | 43% | 13% | 10.53 |
| | 2 | 5.71 | 42% | 17% | 3% | 6.51 |
| marlynn-57 (no swap kept) | 0 | 9.59 | 18% | 58% | 24% | 12.87 |
| | 1 | 8.02 | 25% | 43% | 12% | 10.24 |
| | 2 | 5.41 | 52% | 16% | 3% | 6.20 |
| random start | 2 | 4.73 | 49% | 2% | 0% | 4.79 |
| random best | 2 | 4.85 | 46% | 1% | 0% | 4.91 |

### What changed in maintainer-52

The climb kept 3 steps, 7 copies in total:

- **Out:** 1 Demonbound Gloomblade (blue), 1 Embrace Ursur (red), 1 Murmuring Gloomblade (blue), 1 Runechant of Sloth (yellow), 2 Shadow of Ursur (blue), 1 Usurp the Shadow Throne (blue).
- **In:** 1 Arknight Descendancy (blue), 1 Enshrine Sin (red), 1 Otherworldly Sins (yellow), 1 Potion of Luck (blue), 1 Runic Reaving (blue), 1 Shadowake Gloomblade (red), 1 Vantom Wraith (red).

The net change is two fewer blues. The gain held at every hold level, including hold 0, which the climb never scored.

## Was it useful?

The checks agreed before the run:

- **Did it climb sensibly?** Partly. maintainer-52 improved in three steps. marlynn-57 found no swap worth 0.15 in 40 steps. The random deck barely moved, so 40 steps is far too few to build a deck from scratch.
- **A sane pitch mix?** Yes, roughly. It dropped two blues and added a spread of reds and a yellow, not a pile of one card.
- **Did the results hold on fresh seeds?** Yes, for maintainer-52: about +0.6 score at hold 2, with brick rate down 7 points at hold 2 and 7 points at hold 0.
- **Would the maintainer play it?** Open. That's the real test.

Holding back costs a lot: two blockers roughly halve the threat and push the brick rate to about half of all turns, in every deck tried. That's the aggro lock in numbers.

Reading: the search is good at **tuning** a verified list around its edges and poor at **finding** a new deck from scratch. Verifying more cards widens what it can tune with. It wouldn't by itself turn up a new archetype unless the start lists point there.

## Limits

- No opponent. Blocking is modelled only as cards lost, with no damage taken or prevented.
- The pilot is the engine's baseline line picker with unverified default weights.
- `searchTurn` sees the deck order, so it plays with perfect knowledge of draws within a turn.
- Only the 172 verified variants. Anything unverified can't be picked, and unverified cards in a start list are replaced at random.
- One seed per climb, 40 steps, 300 games per evaluation. Small gains under the margin are invisible.
