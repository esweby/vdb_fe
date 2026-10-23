# Handover: card availability on a half-built deck

Card availability (PR #226) is shown, sorted and filtered on the Cards tab. This note is for
the next worker. Maintainer decisions are quoted from 23 Oct.

## Decisions

- **60 is the full deck.** A deck under 60 is measured as if padded to 60 with blanks
  (`FULL_DECK` in `apps/web/src/decks/useCardAvailability.ts`). That is a stopgap.
- **Cutoff reading.** The maintainer's view is that a card you can't use inside 4 turns is
  useless. The current measure is the opening hand of 4 (`RARELY_BELOW` = 25%, in
  `cardAvailability.ts`), which is not the same thing. Both stay UNVERIFIED until the maintainer
  or an experienced player settles them. Don't change the number on a guess.

## To do

Replace the blank padding with real cards, in one of two ways. Ask the maintainer which first,
or build the first and leave the second:

1. **Fill from the sideboard.** Pad the main deck with sideboard cards up to 60 before
   running the scenarios. Decide the order (the sideboard's own order, or most likely to be
   played) and whether copies limits still apply.
2. **Fill from hidden recommendations.** Extend the recommendation engine to produce
   recommendations that are not shown to the user, and use the top ones to fill the deck to 60
   for the measurement only. They must never be added to the deck or shown as part of it. Mark
   the choice of fill cards UNVERIFIED.

Either way:

- Test first: a failing test per rule (padding source, never over 60, a deck of 60 or more is
  unchanged, sideboard cards that aren't in the deck are never shown as counted).
- The padding lives in `useCardAvailability.ts` where `deckSize` is set; the batch takes
  `core` cards, so filled cards go in as `core`, not blanks.
- Availability should say when it was measured against filled cards, so it isn't read as the
  deck's own number.
- Revisit the 4-turn question in [future-questions.md](future-questions.md) before changing
  what "available" measures.
