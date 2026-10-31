# Where Viserai lists aren't (spike)

**UNVERIFIED.** Drafted by Claude on 30 Oct 2026 from real games. Every figure is an association, not a cause. What any card does, and which cards are worth trying, is game logic for the maintainer to judge.

## The question

[viserai-ceiling.md](viserai-ceiling.md) looked at the lists people play and found none near 55%. That only studies the planes that came home. This page looks the other way: how Viserai loses, the deck shapes nobody plays, the cards other heroes beat Viserai with, and the legal cards nobody tries. The maintainer's framing, 29 Oct 2026: everyone plays 18+ blues and an incremental Runechant plan, so the next deck has to come from somewhere else.

## How

- The same kept sides as the ceiling spike: 21 Sep to 27 Oct 2026, detailed, at least 4 turns, not abandoned, at most 20 per player a day and format. Block slop and games decided by fatigue are left out: 27,347 Viserai sides.
- Opponents are the other side of those games: 29,235 sides, all heroes, with their lists. Their figures are **only from games against Viserai**.
- The legal pool is the project's own card table (`public.cards`, Generic, Runeblade and Shadow, 627 cards), joined to FaBlazing ids through `fablazing_card_map`. It comes from the importer, so it may hold cards that aren't legal in Classic Constructed.
- Produced with a one-off script, not in the repo. Reproduce it with the `game`, `archetypes` and `ceiling` packages in `services/fablazing`.

## 1. How Viserai loses

- **No bad game length.** Viserai wins 29.0% of games that end by turn 5, 30.6% at 6–7, 30.4% at 8–9 and 30.4% at 10+. There's no length to survive to.
- **Turn 1 doesn't separate wins from losses.** Both threaten 4.7 on their first own turn. Redline Aurora (75%+ red, 795 sides in the same games) threatens 7.6, bricks in 16% of its own turns 1 to 4 against Viserai's 28%, and is otherwise about level with Viserai on turns 2 to 4.
- **Losses trail by a little every round.** Own turns 2 to 5 threaten 9.4, 10.4, 9.7 and 8.7 in losses against 11.3, 12.4, 11.8 and 11.0 in wins, and take about 1 more damage each round.

So losses are a steady deficit, not one collapse. Turn 1 is weak for every Viserai list, so the data can't say whether fixing it helps: nobody has.

## 2. Deck shapes nobody plays

Lists sit in a narrow band (10th to 90th percentile of lists, by copies):

- blue: 16 to 24, median 20
- red: 29 to 39
- attack actions: 28 to 39
- generic cards: 0 to 4, median 0
- defence reactions: 0 to 3, median 0

Outside the band:

- **Under 16 blues:** about 2,100 sides, around 26% won. Tried, and worse.
- **10 or more generics:** 343 sides by 55 players, 35.6% by side but 25.4% [17.2–33.4] counting each player once, the same as Viserai overall. Mostly Looking for a Scrap, Sink Below and Call for Backup. No real edge.
- **Fewer cheap attacks:** lists with under 10 attacks costing 0 or 1 won **36.5%** (4,269 sides), against 27.6% for 25 or more. Lists with 25 to 29 attack actions won 34.8% (5,173), against 27.3% for 35 or more. The strongest shape signal: fewer, bigger attacks over the incremental plan. It probably overlaps with the Widespread archetypes (3 and 4 in [deck-archetypes.md](deck-archetypes.md)).

## 3. What beats Viserai

Legal cards in at least 3% of opponents' lists across 3 or more heroes, but under 5% of Viserai lists. "Effect" is the opponents' win rate against Viserai with the card minus without it, within the same hero, weighted by sides with the card.

- Command and Conquer: in 25.0% of opponents' lists, 0.4% of Viserai's; effect +9.3 points
- Sirens of Safe Harbor (blue): 4.3% and 0%; +9.3
- Fiddler's Green: 10.8% and 0%; +9.2
- Fearless Confrontation: 4.8% and 0.1%; +8.3
- Sigil of Solace: 18.2% and 0.2%; +7.7
- Sirens of Safe Harbor (red): 3.3% and 0%; +7.3
- Oasis Respite: 3.4% and 0%; +7.2
- Rockyard Rodeo: 13.4% and 0%; +7.1
- Shelter from the Storm: 26.4% and 1.3%; +7.0
- Ripple Away: 18.6% and 0.6%; +7.0
- Overcrowded: 17.7% and 1.0%; +6.7
- Call to the Grave: 16.5% and 0%; +6.6
- Enlightened Strike: 16.5% and 0.4%; +3.2
- Scar for a Scar: 5.0% and 0.4%; −2.1
- Pummel: 8.7% and 0.6%; −4.1

Many of the strongest are life gain or prevention (Sigil of Solace, Oasis Respite, Fiddler's Green, Shelter from the Storm). That reads as opponents outlasting Viserai's damage. The list answers two questions: what Viserai has to play around, Command and Conquer above all at a quarter of opponents; and which generics already work in this field, all legal for Viserai and almost unused by it. Shelter from the Storm and Ripple Away are the block slop package the maintainer set aside.

## 4. The unused pool

Runeblade and Shadow cards in the pool that appear in under 1% of Viserai lists:

- attack actions: 163 of 207
- actions: 109 of 138
- instants: 9 of 13
- defence reactions: 10 of 11

The data can't judge cards nobody plays. The full list is in the script's output, not repeated here.

## Gaps worth testing

1. **A list that fixes turn 1.** The weak spot every Viserai list shares, untried. The maintainer's redline experiment (Enlightened Strike, Scar for a Scar) aims here.
2. **Fewer, bigger attacks** over incremental Runechants: the strongest underplayed shape.
3. **Reach against life gain**, and a plan for Command and Conquer: opponents beat Viserai by outlasting it.

Each needs games, not more of this data: export them, and measure turn 1, bricks and how often the new cards are played.

## Caveats

- Associations only. Players who choose unusual lists may differ from those who don't.
- Opponents' figures are from games against Viserai, which they win about 70% of, so they describe this matchup, not the field.
- The legal pool comes from the importer and isn't checked against Classic Constructed legality.
