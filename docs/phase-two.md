# Phase two

Status, decisions and what's open. The design is in the [README](../README.md); this page is the record of what's built and why. Phase one's plan is [phase-one.md](phase-one.md), and the rules engine's is [rules-engine.md](rules-engine.md).

## Status (20 Oct 2026)

Phase two is largely built. What's left is less building than feeding the engine: the maintainer verifies card drafts, and the engine learns the effects that unlock the most cards. Public launch still waits on the scoring group's coverage pass (phase one, exit criterion 2).

| Area                                                                                                  | State                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Synergy: derived rules, explorer, packages, hidden gems                                               | Built                                                  |
| Confirm synergies: relevant links only, 20 a sitting; quick questions on card pages and the home page | Built                                                  |
| Synergy in the core builder, preference sliders, Suggest equipment                                    | Built                                                  |
| Gaps and condition availability                                                                       | Built                                                  |
| Scenarios: Run and Create, saved scenarios, the library, compare decks, failed hands, scripted steps  | Built                                                  |
| Goldfish on the rules engine, laid out as a playmat                                                   | Built                                                  |
| Matchups: per-hero board plans, played in goldfish and scenarios                                      | Built                                                  |
| Rules engine, steps 1 to 9                                                                            | Built. Cards are added as the maintainer verifies them |
| Accounts and decks: usernames fixed once set; rename, delete and public or private                    | Built                                                  |

## Verifying cards

1. The importer records each card's facts, reading Opt from its text. Hand-written facts sit in `packages/importer/src/authored`.
2. Effect drafts turn those facts into engine rules. The **Effect drafts** page (`/needs-review/effects`) lists them: **Ready to check** first, with **Partly drafted** and **Can't draft yet** folded away. Combat and effects on an opponent are out of the engine's scope, so they're listed as "left out on purpose" and don't hold a draft back.
3. An admin accepts or rejects each draft, pitch by pitch. A verdict covers that draft only: when a card's facts change, its draft and hash change, and the verdict goes stale.
4. Accepted drafts are added to the engine's verified rules (`CARD_RULES` in `packages/engine/src/rules/viserai.ts`), with tests. Only then do goldfish and scenarios play the card by the rules.

The first batch (24 cards) went in on 20 Oct 2026, with the sinchants. The second (62 cards, mostly equipment, potions and amulets whose activated ability is otherwise out of scope) went in the same evening; a played item now stays in the arena, so it can be activated. The third (5 cards) followed: Amplify the Arknight, Ninth Blade of the Blood Oath, Reduce to Runechant and Rune Flash, which cost less for each Runechant, and Dimenxxional Crossroads. The hosted cards need re-importing after any change to card facts: `npm run import -w @vdb/importer -- --yes-remote`, run from an up-to-date `main`.

Bloodfrenzy Gloomblade's rules were approved by the maintainer on 24 Oct 2026 and added to the verified card rules for all three pitches. They cover Usurp, play from banish and go again after damage dealt that turn, including its remaining Runechants or its own hit. The goldfish assumes Runechant damage is not prevented; damage from a hit is noted by hand. Tests check that overlapping sources of go again return only one action point.

## Decisions (the maintainer)

Game logic decided by the maintainer, with where it lives. Anything not here is still marked UNVERIFIED in code.

**19 Oct 2026**

- Synergy rule set and directions: [synergy-rules.md](synergy-rules.md).
- Matchups are per-hero board plans, kept within the deck's pool.
- A deck's main deck is as built (48 to 56 is common); the rest stays in the sideboard.

**20 Oct 2026**

- **Energy Potion** gains 2 resources.
- **Gaps:** red first. Gate makers aren't needed in every colour, so they're never a gap by colour.
- **Core builder:** defence reactions are suggested only at their best defence (red covers the 4 breakpoint). Equipment can be suggested, as an option. Cards that make Runechants every turn get their own preference.
- **Synergy:** a card that banishes only itself, like Fallen Herald, isn't a hand banisher and doesn't feed other cards, except by filling the banished zone. A blood debt card that can already be played from banish, like Sinspeaker Gloomblade, isn't a Gate target.
- **Opt** matters and is recorded for every card that has it. In scripted runs it keeps on top, best first: the pitch the card wants, then cards playable from banish, then Rune Gate or Usurp cards, then Runeblade or Shadow. The rest go to the bottom.
- **End of turn:** the arena clears to the graveyard. Auras, items, allies and landmarks stay. Runechant and Gate tokens carry over. Revel in Runeblood's clearing comes with its own rules.
- **Sinchants** are destroyed when you play an attack action card, and at the start of your next turn. Each makes a Runechant.
- **Fyendal's Spring Tunic:** remove 3 counters to gain 1 resource.
- **Even Bigger Than That!** needs damage dealt this turn, which is noted by hand.
- **Usernames** can't be changed once set.
- **Dimenxxional Crossroads** pays off cards played from the banished zone, and only the first card of each type played this turn, from anywhere, counts. Losing life on your turn destroys it, so blood debt kills it in your end phase. Its arcane damage isn't modelled.
- **Viserai, the Usurper:** traversing to the Usurper gives the turn's first blood debt attack go again, if it doesn't have it already, whichever card made the third Runechant. That includes traversing by hand in goldfish.
- **Cost reductions:** a cost never goes below 0; Runechants are counted as the card is played, before Usurp destroys one; and only a usurp earlier in the turn counts, not the card's own.

**21 Oct 2026**

- **Base of the Mountain:** "Base of the Mountain banishes a card and then it goes as a defending card and to the graveyard. The only exception to this is when it is paired with the equipment that banishes defending cards when the chainlink closes." A temporary banish isn't a hand banisher, so it doesn't feed Gates, fill the banished zone or link to cards played from banish (it had been asked whether it helps Usurp the Shadow Throne). The exception is Reach of the Abyss, linked by hand (the maintainer thinks it is the only one). It doesn't care whether the banished cards are Shadow or Runeblade, so it isn't linked to banish-type payoffs. It does help "when banished" cards: banishing Arknight Descendancy offers its 3 life for 3 Runechants without leaving it stuck in arsenal. No other card shares the pattern. See [synergy-rules.md](synergy-rules.md).

**23 Oct 2026**

- **Bloodfrenzy Gloomblade:** with two Runechants, one is usurped and the other can deal damage. Damage from that Runechant or from Bloodfrenzy's own hit can give Bloodfrenzy go again.
- **Sideboard plans:** a plan can have a custom name without an opposing hero. Hero-specific plans still work. The Matchups tab keeps saved plans in a compact sidebar beside the editor. Card rows are the default; Pictures remains an option. Weapons and equipment, and population matchup statistics, are folded away. Goldfish and scenarios can play a named plan. Exported versions keep the plans as saved at export time.

## Open

**For the maintainer**

- Review the cards in **Ready to check**. The rejected drafts' notes (gain a resource, like Fyendal's; draw a card; Hope Merchant's Hood's shuffle and draw) are features to add.
- Details of number entry when scoring on a MacBook keyboard (carried from phase one).
- A player check of the legality filter (carried from phase one).

**Engine features, most cards unlocked first**

1. ~~An **activate** action~~: built (20 Oct 2026).
2. ~~**Cost reductions**~~: built (20 Oct 2026). Per Runechant, from the banished zone and after a usurp are drafted and wait for the maintainer's check. Usurp the Shadow Throne's draft also covers play from banish after an earlier usurp that turn (24 Oct). It is **unverified**, ready to check on the effects page, and has not been added to the verified card rules. Its on-hit effect remains outside the engine's scope. Reductions given to a later card (Bequest the Vast Beyond, Sonata Dystopia) aren't drafted yet.
3. **Opt reordering:** choosing the order of the cards kept on top.
4. **Counts as a Runechant** (sinchants), and usurping them.

**Smaller**

- Matchup plans that offer to add cards added to the deck since.
- Phase one's M8 leftovers: a shared type and spacing scale, and a full keyboard and screen-reader pass.
