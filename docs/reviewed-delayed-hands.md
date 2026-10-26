# Two reviewed delayed-play hands

Policy `reviewed-delayed-hands-v1` adds two exact hands approved by the maintainer. These are exceptions in the opt-in Gate policy (`gates` and `both`), not changes to the default script or card rules. The wider strategy remains **UNVERIFIED**. Earlier reports retain their original policy IDs.

Policy `reviewed-delayed-hands-v2` adds the next two hands approved on 26 October. The earlier exceptions remain. Cards explicitly kept by a reviewed fragment stay protected for the rest of that turn, including subsequent policy attempts and baseline steps. This extra protection expires on the next turn; caller-supplied keep choices still apply normally.

Both hands start with one action point, no floating resources and one Gate. The targets must be face up in banish with verified rules. A previous blood debt attack, a protected pitch card or a different hand prevents the exception. Selection uses visible zones and the supplied life total, not the hidden deck.

## Keep BSL

Usurper, 38 life, five Runechants and unused Seven Sin Nebula. The hand is red Sinspeaker, red Bloodfrenzy, blue Become the Shadow Lord and red Demonbound. Two red Malefic Incantations each have one counter. Blue Descendancy and blue Demonbound are in banish and currently cost zero.

Pitch red Sinspeaker → Gate on blue Descendancy → play Descendancy from banish → play blue Demonbound from banish. Keep BSL. Do not force a sword swing. This is the approved alternative to pitching BSL for Descendancy and Nebula, not a claim of greater damage.

## Keep the Gate and both blues

Forsaken, 30 life, one Runechant, no auras and no Runechant created this turn. The hand is blue Usurp the Shadow Throne, red Demonbound, yellow Murmuring and blue Bloodfrenzy. Blue Descendancy and blue Murmuring are face up in banish; Murmuring costs two and has its own banish permission.

Pitch yellow Murmuring → play blue Murmuring from banish. Keep the Gate, blue Usurp and blue Bloodfrenzy. The fragment ends on one Runechant. No extra life payment is chosen: an explicit positive or conditional life-payment instruction prevents this exception. This gives up immediate pressure to keep the next hand's options.

## Scope and checks

The life values above identify the reviewed hands. They do not replace the existing over-17 Descendancy guard or establish new general health thresholds. Equipment abilities and combat hits are not part of these lines. Existing per-turn return/hold answers still control the end phase.

The runner records separate `keep-bsl-delayed-descendancy` and `keep-gate-delayed-murmuring` match counts. These count selected fragments, not damage improvements or completed T5 chains.

Tests cover both Gate-enabled modes, preserved cards, caller keep choices, return/hold answers, different life totals, target visibility and earlier attacks. The original captured states are private simulation evidence, not observed games. Their full hidden decks are not included here.

See [worked Gate and sword lines](gate-weapon-worked-hands.md) and [explicit return decisions](traverse-back-policy.md).

## Equal-blue pitch: keep BSL

Usurper, 34 life, one action point, no floating resources, five Runechants and one Gate. Four Runechants and one Gate were created this turn, with no Gate activation yet. The explicit answer is to hold Usurper. There are no auras and Nebula is unused. Hand: blue BSL and blue Murmuring. The face-up banished zone is exactly blue Usurp, yellow Sloth, blue Descendancy, yellow Embrace Sin and red Bloodfrenzy.

Pitch blue Murmuring → Gate on Descendancy → play Descendancy from banish → Nebula. Keep BSL rather than Murmuring. In the captured replay both pitch choices threaten nine attack and five arcane, leave one resource and lose two life at end phase. This is not a general ranking of blue cards.

Match ID: `keep-bsl-equal-blue`. This exact sword line is selected only in `both` mode, and not if `nebulaAfterDescendancy` is explicitly false. It does not override Gate-only mode to swing the sword.

## Embrace funds Murmuring: keep Shard and Usurp

Forsaken, 28 life, one action point, no resources, one Runechant and one Gate. No Runechant or Gate was created or activated this turn. One red Malefic has one counter and Nebula is unused. Hand: blue Shard, blue Usurp, yellow Embrace Sin and red Scar. The face-up banished zone is exactly blue Bloodfrenzy, blue BSL, blue Murmuring, yellow Bloodfrenzy and blue Descendancy. Cull instant mode and Scar go again must both be explicitly No. No extra life payment is chosen.

Pitch yellow Embrace Sin → play blue Murmuring from banish. Keep Shard, Usurp and the Gate, ending the fragment on two Runechants. This threatens four attack and no arcane. Pitching both blues for Descendancy instead threatens six attack and two arcane, leaves one Runechant and two floating resources, and has no action point for Nebula. Both captured fragments lose four life including end phase. Equipment abilities and combat hits are excluded.

Match ID: `keep-shard-usurp-murmuring`, in `gates` or `both` mode. The kept blues must remain protected after the fragment: otherwise a later automatic pitch of Shard can make a third Runechant, traverse, regain an action point and spend the Gate. The approved choice is to keep those cards, not to resume that line. End-phase return/hold answers are still honoured.

## Paired check of v2

Compared v1 and v2 on the same 1,000 seeds in all four fixed Cull/Scar answer cases, in both Gate-only and Gate-and-weapon modes: 8,000 pairs and 16,000 complete runs of eight turns. Starting life was 40, with hold on odd turns and return on even turns if offered. The private 54-card deck and verified facts were reconstructed from both saved states; the old replays reproduced their original trace prefixes. Rules data version: `0d49faac`.

7,996 pairs had identical complete states, steps and traces. The four changed pairs were the two newly reviewed seeds repeated in the applicable cases and modes. The earlier reviewed seeds were unchanged. There were no failed runs. This reuses the discovery cohort; it is not independent validation or an estimate of how often these hands occur in games.

For the equal-blue seed (447312734), v2 retained BSL for two extra pre-refill turns without changing the eight-turn totals for threatened damage, arcane or self-loss. For the Shard/Usurp seed (1288097984), v2 finished with two less threatened attack damage, one more arcane and three less self-loss, and retained four extra blue card-turns before refill. Total Gate activations were unchanged. These are changes in the affected run, not average benefits across all games.

All figures are **Assumed** goldfish results. There is no opponent, blocking, incoming damage or life gain. Threatened attack damage is printed power plus usurp bonuses, with arcane separate. The check does not establish optimal play or run the observed-data T5/T6 tests. Full private decks and hidden-state snapshots are not committed.
