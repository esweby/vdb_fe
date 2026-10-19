# Derived synergy rules

The design for phase two step 1: how derived synergy edges are made from card facts, how community feedback changes them, and how synergy joins the ranking. The README sets out the shape ("Synergy graph", "Derived synergy rules", "Suggested core"). This page fills in the rules.

**Status.** Claude drafted this from the verified attributes and the roles in [roles.md](roles.md). The maintainer answered the open questions on 19 Oct 2026 ([Decisions](#decisions-19-oct-2026)). Where a rule comes from those answers it says so. Everything else, including every default weight, is still **unverified**. Default weights are only starting points: admins tune them in the app (see [Weights](#weights-admin-only)).

## Starting point: roles already do most of it

[roles.md](roles.md) already puts every card into engines as a **generator** or a **payoff**, and `fits()` links a generator to a payoff in the same engine. That's a synergy graph without direction or weight. So the first set of derived rules is **the role fits, made directed and weighted**, not a second set of rules that could disagree with the roles. A few cross-engine rules from the maintainer's answers sit on top.

- **Direction:** generator → payoff. A Gate generator helps a Gate target; the Gate target does nothing for the Gate generator.
- **Weight:** set for each rule, 0–1.
- **The reason shown in the UI** comes from the rule, e.g. "Creates a Gate → a blood debt action card a Gate can play from banish".
- **Corrections by hand** keep working: a card's `roles: { add, remove }` changes its edges too.
- Runechant triggers (attacks), Runechant discounts, arcane payoffs, Disruption and Tutor make **no role-fit edges**. Attacks spend Runechants anyway (maintainer, 15 Oct 2026). The Runechant links that do matter are the enabling ones in rule set 2.

Beyond these, a few attributes name another card or group directly. They become edges of their own (rule set 3).

## Rule set 1: role fits

| Engine | From (generator)                          | To (payoff)        | Default weight | Why                                                                                        |
| ------ | ----------------------------------------- | ------------------ | -------------: | ------------------------------------------------------------------------------------------ |
| Gate   | Gate generator                            | Gate target        |            0.8 | A Gate plays a blood debt card out of banish, and lets Usurper traverse                    |
| Gate   | Gate generator                            | Banish-play payoff |            0.7 | The payoff gets better when the Gate plays it from banish                                  |
| Banish | Hand banisher, Deck or graveyard banisher | Plays from banish  |            0.7 | Each card in banish is like an extra playable card in hand                                 |
| Banish | Self-banisher                             | Plays from banish  |            0.4 | Fills the banished zone, but only with itself                                              |
| Banish | Any banisher                              | Banish-play payoff |            0.6 | Fills the zone it plays from                                                               |
| Banish | Hand banisher                             | Banish-type payoff |            0.6 | Lets you choose a Shadow or Runeblade card to banish                                       |
| Banish | Deck or graveyard banisher, Self-banisher | Banish-type payoff |            0.3 | The banished card's type is down to luck, or fixed                                         |
| Banish | Any banisher                              | Banish trigger     |            0.7 | Fires its "when banished" effect                                                           |
| Aura   | Aura generator, Sinchant                  | Aura payoff        |            0.5 | Counts auras played or created this turn                                                   |
| Tempo  | Go again granter, Eloquence               | Tempo payoff       |            0.5 | More actions in a turn                                                                     |
| Usurp  | Usurp                                     | Usurp payoff       |            0.8 | Triggers on usurp, or needs a usurp this turn (Runechant of Lust, Usurp the Shadow Throne) |

Banish weights are higher than the first draft: filling the banished zone is like having an extra 2–3 playable cards in hand, which is very strong (maintainer, 19 Oct 2026). Banish-play payoffs are payoffs of both the Gate and the banish engines, so they get edges from both.

Where a card pair matches more than one rule, the edge takes the **highest** weight, not the sum, and records every matching reason.

## Rule set 2: enabling links (maintainer, 19 Oct 2026)

Synergies that cross engines and aren't obvious from the roles, but are real.

| From                          | To             | Default weight | Why                                                                                                                          |
| ----------------------------- | -------------- | -------------: | ---------------------------------------------------------------------------------------------------------------------------- |
| Runechant generator           | Rune Gate card |            0.4 | Rune Gate plays it from banish if you control at least as many Runechants as its cost (e.g. Revel in Runeblood enabling one) |
| Runechant generator, Sinchant | Usurp card     |            0.6 | Every usurp card needs a Runechant or a sinchant to usurp (maintainer, 19 Oct 2026)                                          |
| Hand banisher                 | Gate target    |            0.6 | Banishes a blood debt card from hand where a Gate can play it, which lets Usurper traverse (e.g. Cull)                       |
| Deck or graveyard banisher    | Gate target    |            0.3 | The same, but whether a blood debt card is hit is down to luck                                                               |

The two Runechant rows are the "non-obvious" kind. If they turn out too broad (most Runechant makers linking to every Rune Gate card), the related-cards picker and the confirm-suggestions queue are where scorers trim them.

## Rule set 3: direct references

These attributes already name the cards they work with ([attribute-vocabulary.md](attribute-vocabulary.md), "Card references"), so the edge is the authored fact itself.

| Attribute               | Edge                                 | Default weight | Example                                   |
| ----------------------- | ------------------------------------ | -------------: | ----------------------------------------- |
| `tutors`                | tutor → each card it can find        |            0.6 | Sinspeaker Gloomblade → each sinchant     |
| `enablesPlayFromBanish` | enabler → each card it lets you play |            0.8 | Embrace Sin → each sinchant               |
| `supports`              | card → each card in its target group |            0.7 | Envelop in Darkness → each Rune Gate card |

Only a handful of cards have these (4 tutors, 2 enablers, 3 supports), so they're cheap to check one by one.

## Traverse (maintainer, 19 Oct 2026)

"Enables traverse" isn't a rule of its own. It's a label on the edges that lead to a traverse:

- **Usurper:** creating a Gate, or using one to play a card from banish. So Gate generator → Gate target and banisher → Gate target edges carry "enables traverse". Cull, banishing a blood debt card for a Gate to play, is the typical odd case.
- **Forsaken:** creating 3 Runechants in a turn. That's a property of the card (Runechant burst), not an edge, and the traverse timeline already models it.

The graph and the reasons show the label; the ranking doesn't treat it differently yet.

## Not edges

- **Conditions that depend on deck density**, like "if the banished card is Shadow". Any Shadow card helps a little, so pairwise edges would link the card to most of the pool and say nothing. That's what condition availability (phase two step 7) measures, per deck.
- **Granted effects aimed at a broad group**, like "your next Runeblade attack action" (Mauvrion Skies). Same problem: an edge to every Runeblade attack. These are already counted by the roles (Runechant granter, Go again granter).
- **Anti-synergy**, like Grille of Repentance turning Gate targets face-down. Left to deck analysis: cards like that won't rank highly anyway (maintainer, 19 Oct 2026).

## Weights (admin only)

Rules are code; weights are data (maintainer, 19 Oct 2026).

- Each rule has an id and a default weight in code. A `synergy_rule_weights` table (rule id, weight, updated by, updated at) overrides the default. Everyone can read it; only admins can write it.
- An admin-only page lists every rule with its description, how many edges it makes, an example pair, and a weight slider. Changing a weight re-ranks straight away for everyone on their next load.
- This is the first in-app admin page. The README's phase one note ("edited in the Supabase dashboard") still holds for roles, `rating_weight` and fringe settings.

## Size

From the role counts in roles.md, a rough upper bound (cards that fit more than one rule are counted twice): Gate about 1,000 edges, banish about 2,500, aura about 1,000, enabling links about 1,000, tempo about 65 and usurp about 22. That's **about 5,500 directed edges** across 627 cards. That's fine for the browser to hold, but it has two consequences:

- **The graph can't draw them all.** By default it shows edges between cards in or near the core.
- **Synergy has to saturate in the ranking** (below). Otherwise any card in a busy engine wins just by having many partners.

## Cards, variants and sides

- **Edges are between cards, not variants.** `card_synergies` and `synergy_feedback` are keyed by card. A variant gets its card's edges. Where pitch variants differ (Arcane Cussing makes 3/2/1 Runechants), the card's roles already merge them.
- **Sides: not decided** (maintainer unsure, 19 Oct 2026). Each engine gets a side tag (Forsaken, Usurper or both; the Gate engine Usurper, the Runechant enabling links Forsaken, the rest both), recorded but **not used** in the first build: edges count the same on either side. Whether side focus should scale them is for the scoring group once they can see the suggested core.

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
- **Saturates per engine at 1.** Two strong partners are about as good as ten, so busy engines don't swamp the value. Enabling links count under the engine of their payoff.
- **λ is a "synergy strength" setting,** next to risk on the Set up tab, from 0 (pure value, today's ranking) to a maximum of about one band of value (10 on the 0–100 scale). The default is for the scoring group to confirm.
- **Pinned cards and cards in the deck count as picked from the start,** so the ranking builds around them.
- The label changes from "Ranked by your priorities" to **"Suggested core"** once λ is above 0.

## How it gets built, test first

1. `packages/cards/src/synergy.ts`: the `SynergyRule` type from the README and rule sets 1–3, each with an id and default weight. Each rule gets a test with **real card pairs that must, and must not, make an edge**, from verified cards (e.g. Become the Shadow Lord → Abyssal Bite must; Abyssal Bite → Become the Shadow Lord must not; Cull → a blood debt action must).
2. Migration: `card_synergies`, `synergy_feedback` (with the CHECK from the README) and `synergy_rule_weights` (admin write), with row level security, grants and the privileges test.
3. The admin weights page.
4. Community edge aggregation in `@vdb/scoring` (unit tests), then in the Edge Function.
5. Synergy in `suggestCore` and the engine board, with λ = 0 by default until the scoring group has confirmed it.
6. The confirm-suggestions queue and the related-cards picker.

## Decisions (19 Oct 2026)

1. **Runechant engine:** Runechants do have synergies, but non-obvious ones: enabling a Rune Gate card (Revel in Runeblood) or a usurp card. Every usurp card needs a Runechant or a sinchant to usurp. Added as rule set 2.
2. **Weights:** adjustable by admins in the app, not fixed in code.
3. **Sides:** unsure; maybe engines that count for both. Engines are tagged by side but not scaled yet.
4. **Anti-synergy:** left to deck analysis.
5. **Traverse:** cards do enable it, sometimes oddly (Cull banishing a blood debt card for a Gate; a card creating a Gate). A label on edges, plus the Runechant burst property on Forsaken.
6. **Banish-play payoff:** filling the banished zone is like 2–3 extra playable cards in hand, which is very strong. Banish weights raised, and banish-play payoffs linked from both the Gate and banish engines.

Still open: whether side focus scales synergy (3), and the default λ (scoring group).
