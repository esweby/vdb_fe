# Attribute vocabulary

This page defines what we record about each card. Every hand-authored entry has to fit this vocabulary, and the importer rejects anything that doesn't. The code is in [`packages/cards/src/attributes.ts`](../packages/cards/src/attributes.ts).

**Purpose.** Attributes describe what a card contributes to **Viserai's engine**: Runechants, Gates, banishing, playing from banish and arcane damage. They're used for filters, deck analysis, synergy rules and scenarios. They don't implement game rules, and they don't try to capture everything a card does. Overall value (a +3 power buff, card draw and so on) is captured by **scores**, not attributes.

## Generated automatically (from the dataset)

| Attribute        | From                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `hasGoAgain`     | the "Go again" keyword                                                                              |
| `hasBloodDebt`   | the "Blood Debt" keyword                                                                            |
| `hasUsurp`       | the "Usurp" keyword                                                                                 |
| `hasRuneGate`    | the "Rune Gate" keyword                                                                             |
| `specialization` | "<Hero> Specialization" in the card text. Other heroes' specializations are excluded from the pool. |

## Written by hand

| Attribute                                    | Meaning                                                                                                                                                                                                                              | Example                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `tokens`                                     | Tokens this card creates: which token, how many (a number, or `X` for variable), when, and under which conditions. One entry per separate creation.                                                                                  | Hocus Pocus: 1 Runechant `on_attack`                                                |
| `banishesOwn`                                | Cards this card banishes from **your own** hand, top of deck or graveyard, and whether it's optional. These feed Gates and play-from-banish.                                                                                         | Become the Shadow Lord: a card from hand, `on_play`                                 |
| `playableFromBanish`                         | The card can be played from your banished zone, with any conditions.                                                                                                                                                                 | Bounding Demigon: if you've played a non-attack action this turn                    |
| `arcaneDamage`                               | Arcane damage the card deals: amount, when and conditions.                                                                                                                                                                           | Arcanic Crackle: 1 `on_attack`                                                      |
| `grantedTo` (on `tokens` and `arcaneDamage`) | The effect is given to a later card: `next_attack_action`, `next_runeblade_attack_action` or `next_shadow_attack`.                                                                                                                   | Mauvrion Skies: your next Runeblade attack action creates 3 Runechants when it hits |
| `goAgain`                                    | **Conditional** go again: the card only gets go again if its `conditions` are met (or as described in `notes`). Replaces the dataset's "Go again" keyword, which can't tell natural from conditional, so `hasGoAgain` becomes false. | Embrace Ursur: if the banished card is Shadow                                       |
| `grantsGoAgain`                              | **Granted** go again: gives go again to a later card (`next_attack_action` or `next_runeblade_attack_action`).                                                                                                                       | Mauvrion Skies                                                                      |
| `costReducedPerRunechant`                    | "Costs {r} less for each Runechant you control."                                                                                                                                                                                     | Rune Flash                                                                          |
| `notes`                                      | Free text for the reviewer: doubts, or things the vocabulary can't express yet.                                                                                                                                                      |                                                                                     |

**When an effect happens (`trigger`):** `on_play`, `on_attack`, `on_hit`, `on_defend`, `on_pitch`, `on_banished`, `on_leave_arena`, `on_destroyed`, `on_usurped`, `start_of_turn`, `start_of_action_phase`, `combat_chain_closes`, `activated` (an instant ability on the card), `your_attack_action_played` (when you play an attack action card), `your_attack_action_hits` (when an attack action card you control hits).

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

## Review workflow

1. Batches live in [`packages/importer/src/authored/`](../packages/importer/src/authored/), one file per batch, with every entry `verified: false`.
2. `npm run review-sheet -w @vdb/importer -- <batch>` writes `docs/reviews/<batch>.md`: card text next to the plain-English draft.
3. The reviewer replies in the pull request with `OK` or `<card>: wrong because…`.
4. Fixes are applied, approved cards get `verified: true`, the pull request merges, and the import is re-run.
