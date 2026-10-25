# Gate and sword worked hands

These worked examples follow the guidance in [engine-calibration.md](engine-calibration.md#script-guidance-24-oct-2026). The maintainer approved the exact spare-Shard / reserved-BSL hand on 25 Oct; the other exact selections remain **UNVERIFIED policy examples** for review. They use registered rules for the cards actually played. They are not a new default policy, a claim of optimal play or a change to the calibration baseline.

## Declared inputs

Each example starts from an **Assumed mid-turn position**, not a claim that an opening hand reached that position. Viserai is on Usurper, has one action point and has not attacked with Seven Sin Nebula this turn. An attack played in these examples is the turn's first blood debt attack, so Usurper gives it go again. A reserved card is chosen explicitly by the caller; the examples do not infer which card is a better starter.

The script fragments live in `apps/web/src/calibration/gateWeaponExamples.ts`. Their preconditions are written for review, **not enforced as an automatic selector**. Do not apply a fragment to an arbitrary position and call it the policy. `runScriptFromState` runs the existing script interpreter from the declared state without shuffling a new hand or resetting the turn, resources or tokens.

The first example assumes starting life of 40 and five life lost, giving 35 life now. No more life is paid during that fragment: Descendancy is already banished. The separate `descendancyComfortableAfterPayment(life, payment)` check uses explicit inputs and checks for at least 25 life **after paying**, as confirmed on 25 Oct. Thus 28 minus 3 is comfortable; 27 minus 3 is not. This checks comfort only, not legality or the below-25 pressure exception, and is not wired into an automatic selector.

## Worked lines

| Example                 | Position and explicit choice                                                                                     | Scripted line                                                               | Checked result                                                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Descendancy first       | 3 resources, 4 Runechants, 1 Gate; blue Descendancy face up in banish, red Open the Gate held                    | Gate on Descendancy → play Descendancy → Nebula                             | Gate costs 1; Descendancy costs 1 after its discount; sword costs 1. Four Runechants deal arcane damage. Open the Gate stays in hand. No resource, action point or Runechant remains.                                         |
| Own permission, no Gate | 2 resources, 1 Runechant, 1 Gate; red Bloodfrenzy face up in banish; no traverse back requested                  | Play Bloodfrenzy → Nebula                                                   | Bloodfrenzy uses its own banish permission and usurps the Runechant. The Gate is kept; no resource remains.                                                                                                                   |
| Gate for traverse back  | Same Bloodfrenzy position, but 3 resources and an explicit request to traverse back                              | Gate on Bloodfrenzy → play Bloodfrenzy → Nebula → end turn, accept traverse | The Gate is spent for its end-phase consequence, not because Bloodfrenzy needed permission. Viserai returns to Forsaken. This does not infer momentum or card advantage.                                                      |
| Already spare resource  | A card has been played from banish; 1 resource remains; the hand is empty or BSL is explicitly reserved          | Nebula                                                                      | The floating resource is spent without pitching the reserved starter. With zero resources the swing is skipped and the starter is not pitched.                                                                                |
| Explicit spare pitch    | A card has been played from banish; zero resources; blue Shard explicitly designated spare and blue BSL reserved | Pitch Shard → Nebula                                                        | Shard gives 3 resources and creates 1 Runechant. The swing costs 1 and that Runechant deals arcane damage. Two resources remain; Shard is in pitch and BSL stays in hand. Choosing Shard as spare is still a player decision. |

An additional guard case refuses the sword swing if no card was played from banish that turn. Illegal or unaffordable actions still use the interpreter's existing skipped-step reasons. Each test checks that the input state stays unchanged and the returned state satisfies the engine's invariants.

## What these lines do not establish

- **Open the Gate is not registered in the engine.** It is a held comparator in the first example and is not played or banished. The test does not compare a simulated Open-first line or add its missing rules. The original calibration deck still has 54 of 54 copies covered; that does not cover every card mentioned in strategic guidance.
- **Nebula makes a Runechant on hit, not just for attacking.** Hits are not resolved by this engine. None of these examples awards an on-hit Runechant or treats ending on one as guaranteed. A chance to end on one cannot yet be scored as a known outcome.
- **Life and danger are not inferred.** The comfort check requires explicit life and payment inputs. The below-25 pressure exception, an opponent's blocks and immediate danger are not implemented.
- **Retaining BSL and pitching Shard is not a general rule.** The maintainer approved that exact hand: Usurper, one action point, zero resources, unused Nebula, a card already played from banish, and blue Shard plus blue BSL in hand. The examples do not classify slower hands, choose pitch stacks or judge momentum.
- **No T5 or population rerun is claimed.** There is no automatic Gate-target list or policy selection yet. The four fixed Cull/Scar cases and their thresholds are untouched.

## Next decisions

1. Review the remaining exact selections and define when a traverse back is wanted and which other Gate targets to try. In particular, spending a Gate without being able to play the target is not made automatic here.
2. Turn the reviewed selections into bounded script decisions, then compare baseline, Gates only, weapons only and both on the same inputs. Keep the Cull/Scar assumptions explicit and run T5 alongside the unchanged other checks.
