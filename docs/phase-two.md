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

Blue Arknight Descendancy and Arknight Shard were approved by the maintainer and added to the verified rules on 24 Oct. Descendancy offers a choice of paying 0–3 life when banished face up, creating that many Runechants, and retains its cost reduction. Shard creates a Runechant when pitched. Descendancy's new `lifePaidUpTo` fact still needs a card re-import to keep the hosted effects draft in step with its verified rules; the maintainer runs the hosted import. Goldfish asks for the payment and records it for undo, redo and replay. Scripts pay zero unless `choices.lifePayment` explicitly selects another offered amount. This is not the calibration's tactical life policy: the engine records life lost but does not model an opponent or immediate danger.

Yellow Embrace Sin and red Sinspeaker Gloomblade were approved by the maintainer and added to the verified rules on 24 Oct. Other pitches are not verified. Embrace grants one play of an aura with Runechant in its name from banish that turn, at its normal cost; a separate permission does not spend it. Its next-attack +2 remains outside the engine's scope and is shown in the draft's notes. Sinspeaker's optional search is offered only when it attacks after being played from banish. It puts the chosen aura directly into the arena, without playing it, then shuffles. Declining the ability does not shuffle; searching without finding a card does. Both drafts work from the existing local card facts; this pair adds no new facts to import. The script's default search preference is still an unverified policy, not part of the card-rules approval.

Red Cull and Scar for a Scar were approved by the maintainer and added to the verified rules on 24 Oct. Other pitches remain unverified. Cull models your hand banish; opposing heroes' hands remain out of scope. It asks whether to use its instant permission, with a reminder that a hero must have lost life that turn. Yes uses no action point; No plays it as an action. This only works in the engine's action phase, not an opposing turn or a new priority window. Scar asks whether you have less life than an opposing hero and gives go again only for Yes, not on equal life. Both answers are recorded for undo, redo and replay. Scar's approved importer fact corrects its misleading natural-go-again keyword and still needs a card re-import after merging. Its registered rule also overrides stale natural-go-again data, so the engine does not grant it automatically before that import. No local or hosted card records were changed for this registration.

Scripts must supply the relevant `choices.conditions` values, `hero_lost_life_this_turn` and `less_life_than_opposing_hero`. These are fixed, explicit answers for that run, not a model of changing life totals. A missing answer stops the run instead of silently skipping the card or defaulting to Yes. The maintainer approved both the input method and the final card readings on 24 Oct. The private calibration deck now has verified rules for 54 of 54 copies, across all 21 distinct cards; this is card coverage, not a claim that the engine is calibrated.

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

**24 Oct 2026**

- **Become the Shadow Lord and Descendancy:** one Runechant from BSL's banish, then three from paying life for Descendancy, cause two top-deck banishes and one traverse, ending on Usurper. A queued Forsaken trigger must not traverse back after the first has traversed. The interaction test continues through a Gate, Descendancy and a legal Seven Sin Nebula swing.

**25 Oct 2026**

- **Descendancy comfort:** at least 25 life after paying its life cost. Paying three from 28 is comfortable; paying three from 27 is not. This is not a ban on the previously discussed below-25 pressure exceptions.
- **One reviewed Nebula hand:** on Usurper with one action point, zero resources, Nebula unused and a card already played from banish, pitch blue Arknight Shard to swing Nebula and keep blue Become the Shadow Lord for next turn. This approves that exact hand, not a general pitch preference. See [the worked hands](gate-weapon-worked-hands.md).
- **Two reviewed Gate lines:** on Usurper with one action point and unused Nebula, at 35 life with three resources, four Runechants, one Gate, blue Descendancy already face up in banish and red Open the Gate held, activate the Gate on Descendancy, play it and swing Nebula, retaining Open the Gate. No more life is paid in this fragment. Separately, with two resources, one Runechant, one Gate and red Bloodfrenzy face up in banish as the turn's first blood debt attack, play Bloodfrenzy then Nebula without spending the Gate when no traverse back is wanted. These approve the exact worked lines, not arbitrary Gate targets or an automatic policy.
- **Traverse back and spare resources:** the maintainer also approved the Bloodfrenzy line with three resources and an explicit wish to return to Forsaken: Gate on Bloodfrenzy, play it, swing Nebula and accept the end-phase traverse. With Usurper, one action point, an unused Nebula, a card already played from banish and one floating resource, swing Nebula after other plays are finished when the hand is empty or blue BSL is explicitly reserved. With no floating resource, that fragment skips the swing rather than pitching the reserved BSL. These do not decide when returning is worthwhile or which cards to reserve.
- **Bounded Descendancy extension:** blue Descendancy need not have Open the Gate beside it in hand or be alone in banish. The maintainer approved Gate → Descendancy → Nebula on Usurper with one action point, an unused Nebula, Descendancy face up in banish as the first blood debt attack, at least four Runechants, at least 25 current life after any earlier payment, and enough floating resources for the whole line. No automatic pitching or further life payment; other hand cards are left alone. The below-25 danger exception and other Gate targets are not approved by this extension.

- **Reviewed Shard-funded Descendancy:** on Usurper with one action point, exactly 25 life, zero resources, four Runechants, one Gate and unused Nebula, with blue Descendancy face up in banish as the first blood debt attack and blue Shard plus blue BSL in hand, pitch Shard, Gate Descendancy, play it and swing Nebula. Keep BSL. Shard makes the fifth Runechant and three resources; the line leaves one resource and pays no life. This approves that exact funding line, not a general pitch preference or a wider hand shape.

## Open

**For the maintainer**

- Review the cards in **Ready to check**. The rejected drafts' notes (gain a resource, like Fyendal's; draw a card; Hope Merchant's Hood's shuffle and draw) are features to add.
- Details of number entry when scoring on a MacBook keyboard (carried from phase one).
- A player check of the legality filter (carried from phase one).

**Engine features, most cards unlocked first**

1. ~~An **activate** action~~: built (20 Oct 2026).
2. ~~**Cost reductions**~~: built (20 Oct 2026). Per Runechant, from the banished zone and after a usurp are drafted and wait for the maintainer's check. Blue Usurp the Shadow Throne was accepted by the maintainer and added to the verified rules on 24 Oct. It costs six less and can be played from banish after an earlier usurp that turn. Its on-hit effect remains outside the engine's scope. Reductions given to a later card (Bequest the Vast Beyond, Sonata Dystopia) aren't drafted yet.
3. **Opt reordering:** choosing the order of the cards kept on top.
4. **Counts as a Runechant** (sinchants), and usurping them.

**Smaller**

- Matchup plans that offer to add cards added to the deck since.
- Phase one's M8 leftovers: a shared type and spacing scale, and a full keyboard and screen-reader pass.
