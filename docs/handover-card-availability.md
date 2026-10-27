# Handover: card availability on a half-built deck

Card availability (PR #226) is shown, sorted and filtered on the Cards tab. This note is for
the next worker. Maintainer decisions are quoted from 23 Oct.

## Decisions

- **60 is the full deck.** A deck under 60 is measured filled to 60 from its sideboard
  (`measuredDeck` in `apps/web/src/decks/sideboardFill.ts`), then blanks for whatever the
  sideboard can't reach.
- **Fill from the sideboard** (the maintainer, 27 Oct 2026), chosen over hidden
  recommendations. The sideboard's own order; copy limits still apply across the deck and the
  fill; never over 60; a deck of 60 or more is unchanged; filled cards go in as `core` cards.
  The Cards tab says when availability was measured with filled cards. Sideboard cards are
  never shown as counted.
- **Blanks pad the rest** when the sideboard can't reach 60, and **weapons and equipment in the
  sideboard aren't used to fill** (the maintainer, 27 Oct 2026).
- **Cutoff reading.** The maintainer's example of a useless card was one that can't be used
  inside 4 turns. It was an illustration, not a decision. The current measure is the opening
  hand of 4 (`RARELY_BELOW` = 25%, in `cardAvailability.ts`), which is not the same thing. Both
  stay UNVERIFIED until the maintainer or an experienced player settles them. Don't change the
  number on a guess.

## To do

The sideboard fill is done. Still open:

1. **Fill from hidden recommendations** instead, if players prefer it (question 4 in
   [future-questions.md](future-questions.md)). Extend the recommendation engine to produce
   recommendations that are not shown to the user, and use the top ones to fill the deck to 60
   for the measurement only. They must never be added to the deck or shown as part of it. Mark
   the choice of fill cards UNVERIFIED.

For any change to the fill:

- Test first: a failing test per rule (`sideboardFill.test.ts`, `CardAvailability.test.tsx`).
- Revisit the 4-turn question in [future-questions.md](future-questions.md) before changing
  what "available" measures.
