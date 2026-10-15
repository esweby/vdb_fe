# Roles and engines (first pass)

A first pass at the jobs cards do for Viserai, drafted from the card attributes to help discover synergies. **Rules marked "checked" were confirmed by the maintainer; everything else is unverified.** The rules live in [`packages/cards/src/roles.ts`](../packages/cards/src/roles.ts), with a test for each one.

## The model

- An **engine** is a plan Viserai can run: Runechants, Gates, banish, auras or tempo.
- A **role** is a job a card does in an engine, read from its attributes, so new cards get roles automatically. Each role has a kind:
  - **Generators** make the engine's resource.
  - **Payoffs** use the resource or get better because of it.
  - Some roles have **no kind**: they're recorded and can be counted, but they don't link to anything.
- **Two cards fit** when one has a generator role and the other a payoff role in the same engine. Fits are mechanical links, not judgements, and they don't change scores (README "Mechanics and judgement are kept apart").
- A card can have several roles. Become the Shadow Lord, for example, is a Gate generator, an aura generator, a hand banisher and a banish-type payoff.
- **Corrections by hand:** where a rule gets a card wrong, its authored attributes can add or remove roles, e.g. `roles: { add: ["banish_trigger"], remove: ["gate_target"] }`. Role names are checked against the list.
- Some roles sit **outside the engines**. They're recorded, but they don't link to anything.

Counts are cards in the current pool of 627, including weapons and equipment. 298 cards have no role yet, most of them generics.

## Runechant engine

Forsaken: create Runechants to banish your top card; create 3 in a turn to traverse.

| Role                | Kind      | Rule                                                                                        | Cards | For example                                    |
| ------------------- | --------- | ------------------------------------------------------------------------------------------- | ----: | ---------------------------------------------- |
| Runechant generator | generator | Creates Runechants itself                                                                   |    57 | Arcane Cussing, Arknight Ascendancy            |
| Runechant burst     | generator | Creates X, or 3 or more, at once (one card can trigger traverse)                            |    17 | Arcane Cussing, Blessing of Occult             |
| Runechant granter   | generator | Gives Runechant creation to a later card                                                    |     3 | Mauvrion Skies, Runic Reaping, Sonata Dystopia |
| Rune Gate           | payoff    | The Rune Gate keyword                                                                       |    10 | Widespread Ruin, Deathly Delight               |
| Runechant discount  | payoff    | Costs less for each Runechant                                                               |    10 | Amplify the Arknight, Bequest the Vast Beyond  |
| Arcane payoff       | payoff    | Needs arcane damage dealt, or 3 or more Runechants created                                  |     9 | Arcanic Spike, Consuming Volition              |
| Runechant trigger   | none      | An attack action card, or a weapon that attacks. Not linked: most of the deck. **Checked.** |   228 | Widespread Ruin, Nebula Blade                  |

## Gate engine

Usurper: the first blood debt attack each turn gets go again; create or use a Gate to traverse.

| Role               | Kind      | Rule                                                                                                                      | Cards | For example                          |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------- | ----: | ------------------------------------ |
| Gate generator     | generator | Creates a Gate to i'Arathael                                                                                              |    13 | Become the Shadow Lord, Breach Flesh |
| Gate target        | payoff    | A blood debt action card. A Gate plays it out of banish, so it isn't stuck there, and lets Usurper traverse. **Checked.** |    72 | Abyssal Bite, Widespread Ruin        |
| Banish-play payoff | payoff    | Better when played from banish                                                                                            |    13 | Bounding Demigon, Embalm             |

## Banish engine

Both sides fill the banished zone.

| Role                       | Kind      | Rule                                                   | Cards | For example                                       |
| -------------------------- | --------- | ------------------------------------------------------ | ----: | ------------------------------------------------- |
| Hand banisher              | generator | Banishes from your hand (or makes every hero do so)    |    17 | Become the Shadow Lord, Consuming Aftermath       |
| Deck or graveyard banisher | generator | Banishes your top card, graveyard or defending cards   |    11 | Blood Tribute, Dabble in Darkness                 |
| Self-banisher              | generator | Banishes itself                                        |    14 | Carrion Husk, Deep Recesses of Existence          |
| Plays from banish          | payoff    | Its own text lets it be played from banish             |    39 | Abyssal Bite, Bloodfrenzy Gloomblade              |
| Banish-type payoff         | payoff    | Cares whether the banished card is Shadow or Runeblade |     9 | Become the Shadow Lord, Ebon Fold                 |
| Banish trigger             | payoff    | Does something when it's banished                      |     2 | Arknight Descendancy, Open the Gate to i'Arathael |

## Aura engine

Runechants, Gates and Eloquence are all aura tokens (README "Tokens").

| Role           | Kind      | Rule                                                        | Cards | For example                              |
| -------------- | --------- | ----------------------------------------------------------- | ----: | ---------------------------------------- |
| Aura generator | generator | Creates any token, or is an Aura card                       |    75 | Arcane Cussing, Annals of Sutcliffe      |
| Sinchant       | generator | A Runechant aura                                            |     7 | Runechant of Envy, Runechant of Greed    |
| Aura payoff    | payoff    | Cares about auras played or created this turn, or destroyed |    12 | Condemn to Slaughter, Hit the High Notes |

## Tempo engine

More action cards in a turn.

| Role             | Kind      | Rule                                                  | Cards | For example                              |
| ---------------- | --------- | ----------------------------------------------------- | ----: | ---------------------------------------- |
| Go again granter | generator | Gives go again to a later card                        |    10 | Mauvrion Skies, Machinations of Dominion |
| Eloquence        | generator | Creates Eloquence                                     |     3 | Eloquent Eulogy, Requiem for the Damned  |
| Tempo payoff     | payoff    | Needs an attack or non-attack action played this turn |     5 | Bounding Demigon, Revel in Runeblood     |

## Outside the engines

| Role       | Rule                                            | Cards | For example                                 |
| ---------- | ----------------------------------------------- | ----: | ------------------------------------------- |
| Usurp      | The Usurp keyword                               |    11 | Bloodsong Gloomblade, Demonbound Gloomblade |
| Disruption | Banishes, discards or destroys opponents' cards |    26 | Widespread Ruin, Bloodsong Gloomblade       |
| Tutor      | Searches your deck                              |     4 | Become the Arknight, Sinspeaker Gloomblade  |

## Open questions

1. **Is "Banish-play payoff" a Gate payoff or a banish payoff?**
2. **Do the Aura and Tempo engines hold up,** and what else belongs in them?
3. **Which roles become deck targets?** For example, a deck could aim for "at least 8 Gate generators", like its pitch targets, and the core builder would fill toward it and show how far off you are.
