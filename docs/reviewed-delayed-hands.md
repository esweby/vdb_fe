# Two reviewed delayed-play hands

Policy `reviewed-delayed-hands-v1` adds two exact hands approved by the maintainer. These are exceptions in the opt-in Gate policy (`gates` and `both`), not changes to the default script or card rules. The wider strategy remains **UNVERIFIED**. Earlier reports retain their original policy IDs.

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
