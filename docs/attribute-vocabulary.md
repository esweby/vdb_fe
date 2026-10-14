# Attribute vocabulary

This page defines what we record about each card. Every hand-authored entry has to fit this vocabulary, and the importer rejects anything that doesn't. The code is in [`packages/cards/src/attributes.ts`](../packages/cards/src/attributes.ts).

**Purpose.** Attributes describe what a card contributes to **Viserai's engine**: Runechants, Gates, banishing, playing from banish and arcane damage. They're used for filters, deck analysis, synergy rules and scenarios. They don't implement game rules, and they don't try to capture everything a card does. Overall value (a +3 power buff, card draw and so on) is captured by **scores**, not attributes.

## Generated automatically (from the dataset)

| Attribute        | From                                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hasGoAgain`     | the "Go again" keyword                                                                                                                                                                                                                                                                                           |
| `hasBloodDebt`   | the "Blood Debt" keyword                                                                                                                                                                                                                                                                                         |
| `hasUsurp`       | the "Usurp" keyword                                                                                                                                                                                                                                                                                              |
| `hasRuneGate`    | the "Rune Gate" keyword. Its rule comes with it: if you control at least as many Runechants as the card's cost, you may play it from your banished zone without paying its cost. Every Rune Gate card gets this automatically.                                                                                   |
| `specialization` | "<Hero> Specialization" in the card text. Other heroes' specializations are excluded from the pool.                                                                                                                                                                                                              |
| `isGateTarget`   | a blood debt action or attack action card: a Gate to i'Arathael can play it from your banished zone                                                                                                                                                                                                              |
| `groups`         | groups the card belongs to, derived from its facts: `runechant_aura` (the sinchants: auras with Runechant in their name), `runeblade_aura`, `runeblade_attack_action`, `runeblade_non_attack_action`, `rune_gate` (cards with the Rune Gate keyword). Defined in [`groups.ts`](../packages/cards/src/groups.ts). |

## Written by hand

| Attribute                                    | Meaning                                                                                                                                                                                                                                                                                                                                                                     | Example                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tokens`                                     | Tokens this card creates: which token, how many (a number, or `X` for variable), when, and under which conditions. One entry per separate creation.                                                                                                                                                                                                                         | Hocus Pocus: 1 Runechant `on_attack`                                                |
| `banishesOwn`                                | Cards this card banishes from **your own** hand, top of deck or graveyard, and whether it's optional. These feed Gates and play-from-banish.                                                                                                                                                                                                                                | Become the Shadow Lord: a card from hand, `on_play`                                 |
| `banishesSelf`                               | The card banishes **itself**: when, under which conditions, and whether it's optional. Feeds Gates and play-from-banish.                                                                                                                                                                                                                                                    | Engulfing Shadows: instead of going to your graveyard                               |
| `playableFromBanish`                         | The card can be played from your banished zone, with any conditions.                                                                                                                                                                                                                                                                                                        | Bounding Demigon: if you've played a non-attack action this turn                    |
| `rewardsPlayFromBanish`                      | The card gets better when played from your banished zone, whether by its own text or with a Gate. Details go in `notes`.                                                                                                                                                                                                                                                    | Shadowrealm Reaper: +1 power and go again from banish                               |
| `arcaneDamage`                               | Arcane damage the card deals: amount, when and conditions.                                                                                                                                                                                                                                                                                                                  | Arcanic Crackle: 1 `on_attack`                                                      |
| `grantedTo` (on `tokens` and `arcaneDamage`) | The effect is given to a later card: `next_attack_action`, `next_runeblade_attack_action`, `next_shadow_attack`, `banished_card` (the card banished this way), `card_in_banished_zone_matching_pitch` or `next_action_card_matching_pitch` (matching this card's colour).                                                                                                   | Mauvrion Skies: your next Runeblade attack action creates 3 Runechants when it hits |
| `goAgain`                                    | **Conditional** go again. `conditions` is required and can't be empty: the condition must always be stated, because it matters to strategy. Replaces the dataset's "Go again" keyword, which can't tell natural from conditional, so `hasGoAgain` becomes false.                                                                                                            | Embrace Ursur: if the banished card is Shadow                                       |
| `grantsGoAgain`                              | **Granted** go again: gives go again to a later card (`next_attack_action` or `next_runeblade_attack_action`).                                                                                                                                                                                                                                                              | Mauvrion Skies                                                                      |
| `disrupts`                                   | Effects on opponents' cards: `banish` (from hand, arsenal, top of deck, graveyard, soul or auras), `discard` (from hand) or `destroy` (auras). Records the `amount` (a number, `X` or `all`), the `target` (`opponent`, `defending_hero`, or `each_hero`, which includes you, so don't also record it in `banishesOwn`), the trigger, conditions and whether it's optional. | Cull: each hero (you included) banishes 1 card from their hand                      |
| `instantSpeed`                               | "You may play this as though it were an instant", with its `conditions` (required).                                                                                                                                                                                                                                                                                         | Cull: if a hero has lost life this turn                                             |
| `tutors`                                     | Searches your deck for a `target` (a `{ group }` or a `{ card }` by name) and puts it into your `hand`, the `arena`, or `banished`. Card names are checked against the imported pool.                                                                                                                                                                                       | Sinspeaker Gloomblade: a Runechant aura into the arena                              |
| `enablesPlayFromBanish`                      | Lets a group or named card be played from your banished zone this turn.                                                                                                                                                                                                                                                                                                     | Embrace Sin: a Runechant aura (sinchant)                                            |
| `supports`                                   | Cards this card works with that no other attribute links, as a group or a named card, with an optional note.                                                                                                                                                                                                                                                                | Envelop in Darkness: works with Rune Gate cards                                     |
| `costReducedPerRunechant`                    | "Costs {r} less for each Runechant you control."                                                                                                                                                                                                                                                                                                                            | Rune Flash                                                                          |
| `costReductions`                             | Fixed cost reductions, each with the condition that unlocks it (required).                                                                                                                                                                                                                                                                                                  | Usurp the Shadow Throne: 6{r} less if you've usurped this turn                      |
| `notes`                                      | Free text for the reviewer: doubts, or things the vocabulary can't express yet.                                                                                                                                                                                                                                                                                             |                                                                                     |

**When an effect happens (`trigger`):** `on_play`, `on_attack`, `on_hit`, `on_defend`, `on_pitch`, `on_banished`, `on_leave_arena`, `on_destroyed`, `on_usurped`, `start_of_turn`, `start_of_action_phase`, `combat_chain_closes`, `would_go_to_graveyard` (instead of going to your graveyard), `activated` (an instant ability on the card), `your_attack_action_played` (when you play an attack action card), `your_attack_action_hits` (when an attack action card you control hits).

**What has to be true (`conditions`):**

| Condition                                                               | Plain English                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `banished_card_is_runeblade` / `banished_card_is_shadow`                | the banished card is Runeblade / Shadow                                         |
| `pitched_attack_action` / `pitched_non_attack_action`                   | an attack / non-attack action card was pitched to play it                       |
| `played_attack_action_this_turn` / `played_non_attack_action_this_turn` | you've played an attack / non-attack action card this turn                      |
| `dealt_arcane_damage_this_turn`                                         | you've dealt arcane damage this turn                                            |
| `played_or_created_aura_this_turn`                                      | you've played or created an aura this turn                                      |
| `played_from_banish`                                                    | it was played from your banished zone                                           |
| `top_card_matches_pitch`                                                | the banished or revealed card matches this card's colour (e.g. Jack-o'-lantern) |
| `destroyed_own_aura`                                                    | you destroyed an aura you control                                               |
| `hero_lost_life_this_turn`                                              | a hero has lost life this turn                                                  |
| `dealt_damage_to_defending_hero_this_turn`                              | you've dealt damage to the defending hero this turn                             |
| `dealt_arcane_damage_to_opponent_this_turn`                             | you've dealt arcane damage to an opponent this turn                             |
| `created_3_or_more_runechants`                                          | it created 3 or more Runechants                                                 |
| `paid_optional_additional_cost`                                         | you paid its optional additional cost                                           |
| `defending_hero_has_soul_cards`                                         | the defending hero has cards in their soul                                      |
| `usurped_this_turn`                                                     | you've usurped this turn                                                        |

## Pitch variants

Card-level attributes apply to every pitch. A variant can **replace** any attribute for its pitch. For example, Arcane Cussing's red, yellow and blue variants each have their own `tokens` (3, 2 and 1 Runechants). Replacing is per attribute, not a deep merge, so a variant that overrides `tokens` must list all of that variant's tokens.

## Worked example

Become the Shadow Lord:

```ts
{
  banishesOwn: [{ from: "hand", trigger: "on_play" }],
  tokens: [
    { token: "runechant", amount: 1, trigger: "on_play", conditions: ["banished_card_is_runeblade"] },
    { token: "gate", amount: 1, trigger: "on_play", conditions: ["banished_card_is_shadow"] },
  ],
}
```

Review sheet line: _Banishes a card from your hand when played. Creates 1 Runechant when played, if the banished card is Runeblade. Creates 1 Gate to i'Arathael when played, if the banished card is Shadow. Go again._

## Known gaps (to extend when a batch needs them)

Seen while reading the cards. Each gets added in a small, tested change when its batch comes up, not in advance:

- Effects that modify token creation rather than creating tokens (Mordred Tide: "create that many plus 1"). Recorded as a note for now.
- Conditions on opponents' auras (Runic Reclamation). Recorded as a note for now.
- Gate-specific effects beyond creating them (Planar Chaos)
- Go again granted to cards other than your next attack (Fasting Carcass: "the next red action card"; Tear Through the Portal: a card in your banished zone). Extend `grantedTo` when a batch needs it.

Added for batch 1: `your_attack_action_played`, `your_attack_action_hits`, `played_attack_action_this_turn`, `grantedTo`, `on_usurped` (Runechant of Lust, from review).

Added after batch 1: `goAgain` (conditional) and `grantsGoAgain` (granted). Go again now has three kinds: **natural** (`hasGoAgain`, from the keyword), **conditional** and **granted**. Deck analysis and synergy rules treat them separately.

Added for batch 2: `next_shadow_attack` (Step through Realms).

Added for batch 3: `banishesSelf`, `would_go_to_graveyard`.

Added from batch 3 review: `isGateTarget` (generated), `rewardsPlayFromBanish`, five conditions, and `goAgain` now requires at least one condition.

Added after batch 3 review: `disrupts` and `instantSpeed`. Hand, arsenal and other disruption and conditional instant speed matter strategically, so they're recorded as data rather than notes. Also three granted-to targets: `banished_card` (Painful Passage), `card_in_banished_zone_matching_pitch` (Tear Through the Portal) and `next_action_card_matching_pitch` (Fasting Carcass).

Card references: generated `groups`, `tutors` and `enablesPlayFromBanish`, so cards that name other cards or kinds of card (Sinspeaker Gloomblade and Embrace Sin with the sinchants, Countdown to Extinction with Darkest Hour) are linked in the data rather than in notes. Phase two's synergy graph can draw these as edges directly.

## Review workflow

1. Batches live in [`packages/importer/src/authored/`](../packages/importer/src/authored/), one file per batch, with every entry `verified: false`.
2. `npm run review-sheet -w @vdb/importer -- <batch>` writes `docs/reviews/<batch>.md`: card text next to the plain-English draft.
3. The reviewer replies in the pull request with `OK` or `<card>: wrong because…`.
4. Fixes are applied, approved cards get `verified: true`, the pull request merges, and the import is re-run.

To re-check only the cards waiting for review, across every batch: `npm run review-sheet -w @vdb/importer -- unverified` writes `docs/reviews/unverified.md`.

## Ways to play a card from banish

`banishPlayRoutes()` in [`routes.ts`](../packages/cards/src/routes.ts) lists every route a card has: `own_text` (`playableFromBanish`), `gate` (`isGateTarget`) and `rune_gate` (`hasRuneGate`). For example, Vantom Banshee has two: a Gate (it has blood debt) and Rune Gate. Deck analysis and scenarios use this rather than any single attribute.
