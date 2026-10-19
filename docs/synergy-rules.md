# Derived synergy rules (draft)

The design for phase two step 1: how derived synergy edges are made from card facts, how community feedback changes them, and how synergy joins the ranking. The README sets out the shape ("Synergy graph", "Derived synergy rules", "Suggested core"). This page fills in the rules.

**Everything here is unverified.** Claude drafted it from the verified attributes and the roles in [roles.md](roles.md). Every rule, weight and direction needs the maintainer's check before code is written. Reply in the pull request with `OK` or `<rule>: wrong because…`, the same way as the attribute reviews.

## Starting point: roles already do most of it

[roles.md](roles.md) already puts every card into engines as a **generator** or a **payoff**, and `fits()` links a generator to a payoff in the same engine. That's a synergy graph without direction or weight. So the first set of derived rules is **the role fits, made directed and weighted**, not a second set of rules that could disagree with the roles.

- **Direction:** generator → payoff. A Gate generator helps a Gate target; the Gate target does nothing for the Gate generator.
- **Weight:** set for each pair of generator role and payoff role (table below), 0–1.
- **The reason shown in the UI** comes from the two role names, e.g. "Creates a Gate → a blood debt action card a Gate can play from banish".
- **Corrections by hand** keep working: a card's `roles: { add, remove }` changes its edges too.
- Roles with no kind (Rune Gate, Runechant discount, Arcane payoff, Runechant trigger, Disruption, Tutor) make **no edges**. This follows the maintainer's decision that attacks spend Runechants anyway (15 Oct 2026). See question 1.

Beyond the role fits, a few attributes name another card or group directly. They become edges of their own (below).

## Rule set 1: role fits

| Engine | From (generator)                          | To (payoff)        | Weight | Why                                                                                        |
| ------ | ----------------------------------------- | ------------------ | -----: | ------------------------------------------------------------------------------------------ |
| Gate   | Gate generator                            | Gate target        |    0.8 | A Gate plays a blood debt card out of banish, and lets Usurper traverse                    |
| Gate   | Gate generator                            | Banish-play payoff |    0.6 | The payoff gets better when the Gate plays it from banish                                  |
| Banish | Hand banisher, Deck or graveyard banisher | Plays from banish  |    0.5 | Something in banish to play, but only if the banished card is the right one                |
| Banish | Self-banisher                             | Plays from banish  |    0.3 | Fills the banished zone, but only with itself                                              |
| Banish | Hand banisher                             | Banish-type payoff |    0.6 | Lets you choose a Shadow or Runeblade card to banish                                       |
| Banish | Deck or graveyard banisher, Self-banisher | Banish-type payoff |    0.3 | The banished card's type is down to luck, or fixed                                         |
| Banish | Any banisher                              | Banish trigger     |    0.7 | Fires its "when banished" effect                                                           |
| Aura   | Aura generator, Sinchant                  | Aura payoff        |    0.5 | Counts auras played or created this turn                                                   |
| Tempo  | Go again granter, Eloquence               | Tempo payoff       |    0.5 | More actions in a turn                                                                     |
| Usurp  | Usurp                                     | Usurp payoff       |    0.8 | Triggers on usurp, or needs a usurp this turn (Runechant of Lust, Usurp the Shadow Throne) |

Where a card pair matches more than one row, the edge takes the **highest** weight, not the sum, and records every matching reason.

## Rule set 2: direct references

These attributes already name the cards they work with ([attribute-vocabulary.md](attribute-vocabulary.md), "Card references"), so the edge is the authored fact itself.

| Attribute               | Edge                                 | Weight | Example                                   |
| ----------------------- | ------------------------------------ | -----: | ----------------------------------------- |
| `tutors`                | tutor → each card it can find        |    0.6 | Sinspeaker Gloomblade → each sinchant     |
| `enablesPlayFromBanish` | enabler → each card it lets you play |    0.8 | Embrace Sin → each sinchant               |
| `supports`              | card → each card in its target group |    0.7 | Envelop in Darkness → each Rune Gate card |

Only a handful of cards have these (4 tutors, 2 enablers, 3 supports), so they're cheap to check one by one.

## Not edges

- **Conditions that depend on deck density**, like "if the banished card is Shadow". Any Shadow card helps a little, so pairwise edges would link the card to most of the pool and say nothing. That's what condition availability (phase two step 7) measures, per deck.
- **Granted effects aimed at a broad group**, like "your next Runeblade attack action" (Mauvrion Skies). Same problem: an edge to every Runeblade attack. These are already counted by the roles (Runechant granter, Go again granter).
- **Anti-synergy**, like `turnsBanishedFaceDown` removing Gate targets. The README keeps weights at 0–1. See question 4.

## Size

From the role counts in roles.md, a rough upper bound (cards that fit more than one row are counted twice): Gate about 1,000 edges, banish about 2,000, aura about 1,000, tempo about 65 and usurp about 22. That's **about 4,000 directed edges** across 627 cards. That's fine for the browser to hold, but it has two consequences:

- **The graph can't draw them all.** By default it shows edges between cards in or near the core.
- **Synergy has to saturate in the ranking** (below). Otherwise any card in a busy engine wins just by having many partners.

## Cards, variants and sides

- **Edges are between cards, not variants.** `card_synergies` and `synergy_feedback` are keyed by card. A variant gets its card's edges. Where pitch variants differ (Arcane Cussing makes 3/2/1 Runechants), the card's roles already merge them.
- **Engines lean towards a side:** Gate and usurp towards Usurper, banish towards both. See question 3.

## Community feedback

- **No feedback:** the edge uses the rule's weight.
- **With feedback:** the edge's weight is the rater-weighted average of the votes: confirm counts as the rule's weight, reject as 0 and reweight as its own weight. Only scorer, curator and admin roles count, the same as scores.
- **Community edges** (`card_synergies`, from the related-cards picker): the rater-weighted average weight, shown only once at least 2 people have added it, the same as the minimum rating count.
- **Derived and community edges stay separate** in the data and are drawn differently. Where both exist for one pair, the ranking uses the higher one.
- Computed by the `community-scores` Edge Function alongside scores, so it's one job and one schedule.

## Synergy in the ranking

The README says cards are picked greedily by `value + synergy with cards already picked`. Proposed detail:

```
synergy(card, picked) = λ × Σ over engines  min(1, Σ weight of edges between card and picked cards in that engine)
```

- **Both directions count.** A Gate target gains from Gate generators already picked, and a Gate generator gains from Gate targets already picked.
- **Saturates per engine at 1.** Two strong partners are about as good as ten, so busy engines don't swamp the value.
- **λ is a "synergy strength" setting,** next to risk on the Set up tab, from 0 (pure value, today's ranking) to a maximum of about one band of value (10 on the 0–100 scale). The default is for the scoring group to confirm.
- **Pinned cards and cards in the deck count as picked from the start,** so the ranking builds around them.
- The label changes from "Ranked by your priorities" to **"Suggested core"** once λ is above 0.

## How it gets built, test first

1. `packages/cards/src/synergy.ts`: the `SynergyRule` type from the README, rule set 1 driven by the role table, rule set 2 from the reference attributes. Each rule gets a test with **real card pairs that must, and must not, make an edge**, from verified cards (e.g. Become the Shadow Lord → Abyssal Bite must; Abyssal Bite → Become the Shadow Lord must not).
2. Migration: `card_synergies` and `synergy_feedback` with the CHECK from the README, row level security, grants and the privileges test.
3. Community edge aggregation in `@vdb/scoring` (unit tests), then in the Edge Function.
4. Synergy in `suggestCore` and the engine board, behind λ = 0 by default until the scoring group has confirmed it.
5. The confirm-suggestions queue and the related-cards picker.

## Questions for the maintainer

1. **Runechant engine:** it has no payoffs, so Runechant generators get no edges. Should Rune Gate cards, Runechant discounts or arcane payoffs become payoffs for synergy, even though the role fits leave them out?
2. **The weights** in both tables: are the relative sizes right? Self-banisher → Plays from banish at 0.3 is the one I'm least sure of.
3. **Side:** should an engine's synergy be scaled by side focus (Gate and usurp count less on full Forsaken), or are the edges side-neutral?
4. **Anti-synergy:** do we want negative edges (Grille of Repentance turning Gate targets face-down), or leave that to deck analysis?
5. **"Enables traverse"** (README "Planned"): traverse is a hero ability, not a card. Should it be a property of the card that boosts its value on that side, rather than an edge?
6. **Roles open question 1** carries over: is Banish-play payoff a Gate payoff or a banish payoff? The table makes it a Gate payoff.
