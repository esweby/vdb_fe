# Roles and engines (first pass)

**Unverified.** A first pass drafted from the card attributes, for the maintainer to correct. Only the Gate target decision below has been checked. The rules live in [`packages/cards/src/roles.ts`](../packages/cards/src/roles.ts), with a test for each one.

## The model

- An **engine** is a plan Viserai can run: Runechants, Gates or banish.
- A **role** is a job a card does in an engine, read from its attributes, so new cards get roles automatically. Each role has a kind:
  - **Generators** make the engine's resource.
  - **Payoffs** use the resource or get better because of it.
  - **Supports** feed the generators.
- Some roles sit **outside the engines**. They're recorded, but they don't link to anything.
- **Two cards fit** when a role of one feeds a role of the other in the same engine. Generators fit payoffs, supports fit generators, and Gate generators fit Gate targets. Fits are mechanical links, not judgements, and they don't change scores (README "Mechanics and judgement are kept apart").
- A card can have several roles. Become the Shadow Lord, for example, is a Gate generator, a hand banisher and a banish-type payoff.

Counts are cards in the current pool of 627, including weapons and equipment. 441 cards have no role yet, most of them generics.

## Runechant engine

Forsaken: create Runechants to banish your top card; create 3 in a turn to traverse.

| Role                | Kind      | Rule                                                             | Cards | For example                                    |
| ------------------- | --------- | ---------------------------------------------------------------- | ----: | ---------------------------------------------- |
| Runechant generator | generator | Creates Runechants itself                                        |    57 | Arcane Cussing, Arknight Ascendancy            |
| Runechant burst     | generator | Creates X, or 3 or more, at once (one card can trigger traverse) |    17 | Arcane Cussing, Blessing of Occult             |
| Runechant granter   | generator | Gives Runechant creation to a later card                         |     3 | Mauvrion Skies, Runic Reaping, Sonata Dystopia |
| Rune Gate           | payoff    | The Rune Gate keyword                                            |    10 | Widespread Ruin, Deathly Delight               |
| Runechant discount  | payoff    | Costs less for each Runechant                                    |    10 | Amplify the Arknight, Bequest the Vast Beyond  |
| Arcane payoff       | payoff    | Needs arcane damage dealt, or 3 or more Runechants created       |     9 | Arcanic Spike, Consuming Volition              |
| Runechant trigger   | support   | A weapon that attacks (weapon attacks fire Runechants)           |     6 | Nebula Blade, Rosetta Thorn                    |

## Gate engine

Usurper: the first blood debt attack each turn gets go again; create or use a Gate to traverse.

| Role               | Kind      | Rule                                                 | Cards | For example                          |
| ------------------ | --------- | ---------------------------------------------------- | ----: | ------------------------------------ |
| Gate generator     | generator | Creates a Gate to i'Arathael                         |    13 | Become the Shadow Lord, Breach Flesh |
| Gate target        | generator | A blood debt action card a Gate can play from banish |    72 | Abyssal Bite, Widespread Ruin        |
| Banish-play payoff | payoff    | Better when played from banish                       |    13 | Bounding Demigon, Embalm             |

Gate targets count as generators (maintainer, 15 Oct 2026). Gate generators and Gate targets still fit each other.

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

## Outside the engines

| Role             | Rule                                            | Cards | For example                                 |
| ---------------- | ----------------------------------------------- | ----: | ------------------------------------------- |
| Go again granter | Gives go again to a later card                  |    10 | Mauvrion Skies, Machinations of Dominion    |
| Eloquence        | Creates Eloquence                               |     3 | Eloquent Eulogy, Requiem for the Damned     |
| Sinchant         | A Runechant aura                                |     7 | Runechant of Envy, Runechant of Greed       |
| Usurp            | The Usurp keyword                               |    11 | Bloodsong Gloomblade, Demonbound Gloomblade |
| Disruption       | Banishes, discards or destroys opponents' cards |    26 | Widespread Ruin, Bloodsong Gloomblade       |
| Tutor            | Searches your deck                              |     4 | Become the Arknight, Sinspeaker Gloomblade  |

## Open questions

1. **What are the Gate engine's payoffs?** Banish-play payoff is a placeholder.
2. **Is Gate target still too broad at 72 cards?**
3. **Do attack action cards count as Runechant triggers?** They fire Runechants too, but that's most of the deck, so only weapons are counted for now.
4. **Do sinchants, Eloquence or go again belong in an engine,** perhaps an aura engine?
5. **Should a card's roles be correctable by hand,** e.g. a `roles` entry in its authored attributes for edge cases the rules get wrong? Not built yet.
6. **Which roles become deck targets** (e.g. "at least 6 Gate generators")? This is in the plan's "later" list.
