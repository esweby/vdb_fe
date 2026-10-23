# Questions to put to users (phase three or later)

Things we decided on one player's say-so, or can't decide without more players. Each is a
candidate for a poll once there are enough users. Nothing here is implemented as a rule until
a test covers it, and every answer is a player's reading, not a verified rule.

## Card availability

Source: the Cards tab availability (`apps/web/src/decks/cardAvailability.ts`,
`useCardAvailability.ts`).

1. **When is a card too hard to use?** The maintainer's view: if a card can't be used inside
   the first 4 turns, it is useless. Ask whether other players agree, and whether the line
   moves by card type (an engine piece versus a one-off payoff).
2. **Is "rarely available" 1 in 4?** `RARELY_BELOW` is 25%, a round number. Ask players what
   rate makes them cut a card.
3. **Hand or turns?** Availability is measured on the opening hand of 4, hand only. The
   maintainer's rule is about 4 turns, which also counts draws and the arsenal. Ask which
   players think in terms of, and whether to wait for scenarios with steps.

## Decks still being built

4. **How should a half-built deck be judged?** Today it is padded to 60 with blanks
   (`FULL_DECK`). Ask whether players would rather see it against their sideboard, or against
   recommended fill cards.
