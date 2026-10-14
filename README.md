# Viserai Deck Builder

Viserai is, as of writing, probably the most complicated hero released in Flesh and Blood. He is the first double-sided hero, and the two sides play in very different ways. This application is a hero-specific deck building tool. It uses card data attributes and community scoring to rank cards against the priorities the user sets and, from phase two, to build a synergy graph and suggest a core of cards.

## The hero

Type: Shadow Runeblade Hero
Health: 40
Int: 4

**Front: Viserai, the Forsaken**
Whenever you create 1 or more Runechants, banish the top card of your deck. Then if you've created 3 or more Runechants this turn, traverse. (Flip: Your health does not change.)

**Back: Viserai, Usurper**
The first attack action card with blood debt you play each turn gets go again. At the beginning of each end phase, if you've created or activated a Gate to i'Arathael this turn, you may traverse.

## Tokens

The supporting tokens used in this deck:

- **Runechant** (Runeblade Token - Aura)
  When you play an attack action card or activate a weapon attack, destroy this and deal 1 arcane damage to target opposing hero.
- **Gate to i'Arathael** (Shadow Token - Aura)
  Instant - {r}, destroy this: You may play target action card with blood debt from your banished zone this turn.
- **Eloquence** (Generic Token - Aura)
  When you play a non-attack action card, destroy this and the card gets **go again**.

# Application

The application is a deck building tool for Viserai in **Classic Constructed**. It only includes cards Viserai can use. A smaller card pool lets the user experience focus on more granular deck building tools and simulators.

The core of the application is a scoring and synergy system built around Viserai's goals. User scores are collected into a community view, and individuals can also work from their own scores, or from a blend of the two.

## How it works

1. **Card facts** are entered once by us: type, stats, keywords, and what the card does (creates Runechants, creates Gates, has blood debt, and so on). This includes weapons and equipment.
2. **Scorers score cards** against a set of dimensions, for example Runechant creation, Gate creation and utility. They can also mark that one card helps another.
3. **Community scores** are calculated from the scorers' scores. They are never stored by hand.
4. **The user sets priorities** by giving each dimension a weight. Cards are ranked by those weights (and, from phase two, by their synergy with each other, as a suggested core). The user can build from that core or build a deck manually with the scores as live feedback.

### Design principles

- **Not a general Flesh and Blood simulator.** The value is the connection between Viserai-specific card knowledge, deck composition, hypotheses and reproducible tests. The engine stays deliberately simple. It answers questions like "does this deck have enough Shadow cards to support its Gate creators?" and never claims to know how to play the game well.
- **Mechanics and judgement are kept apart.** A derived (mechanical) relationship between two cards isn't necessarily a strategically worthwhile one. Card facts, derived synergies and human opinions are stored, shown and weighted as different kinds of evidence.

### Card facts vs. opinions

Card data comes in three kinds, and each is kept separate:

| Kind | Example | Stored in |
| --- | --- | --- |
| **Facts**: objective, entered by us | type, pitch, defense, `hasBloodDebt`, tokens created and under which conditions | `cards` / `printings` tables |
| **Opinions**: one per user, per card, per dimension | "I rate this 80 for Gate creation" | `card_scores` table |
| **Aggregates**: calculated | community score, number of ratings | `community_scores` table, written by a scheduled job |

A card has the facts shared by all its versions, and one or more **printings** for the facts that differ between versions (usually pitch). A non-exhaustive example:

```TypeScript
enum Condition {
  BanishRunebladeCard = "banish_runeblade_card",
  BanishShadowCard = "banish_shadow_card",
  IsBanished = "is_banished",
  PlayedFromBanish = "played_from_banish",
  HasRunechantsInPlay = "has_runechants_in_play",
  HasBeenGated = "has_been_gated",
  HasLifeCost = "has_life_cost",
}

type Token = "runechant" | "gate" | "eloquence";

interface TokenCreation {
  numCreated: number;
  conditions: Condition[]; // empty = always creates
}

const becomeTheShadowLord: Card = {
  name: "Become the Shadow Lord",
  type: "action",
  subtypes: [],
  classes: ["shadow", "runeblade"], // to be checked against the real card
  text:
    "Banish a card from your hand. If it's Runeblade, create a Runechant token. " +
    "If it's Shadow, create a Gate to i'Arathael token. Go again",

  attributes: {
    canBanishFromHand: true,
    hasBloodDebt: false,
    hasGoAgain: true,
    tokens: {
      runechant: { numCreated: 1, conditions: [Condition.BanishRunebladeCard] },
      gate: { numCreated: 1, conditions: [Condition.BanishShadowCard] },
    },
    whileInBanish: { canPlay: false, conditions: [] },
  },

  printings: [{ pitch: 3, defense: 3 }],
};
```

`tokens` is a map keyed by token, so a new token never needs a schema change. Eloquence is included in the `Token` type because it's in the token list. An example card that creates it will be added once a card in the pool is confirmed to do so.

Scores are **not** part of the card. They are queried separately:

```TypeScript
interface CardScore {
  dimension: string; // "runechantCreation", "gateCreation", "utility", ...
  yourScore: number | null; // 0–100
  communityScore: number | null; // 0–100
  ratingCount: number;
}
```

### Weapons and equipment

Weapons and equipment are a first-class part of the design, not an add-on. Viserai's weapon is one of the two things that use up Runechants, and equipment is always available instead of being drawn. Treating them as ordinary cards would lead to the wrong answers. Every part of the system has to account for them:

| Area | How weapons and equipment are handled |
| --- | --- |
| **Card facts** | Every card has a `type` (action, attack action, instant, weapon, equipment, …) and `subtypes`, which include the slot (head, chest, arms, legs, off-hand) and handedness for weapons. Pitch, defense and power are nullable on printings, because not every card type has them. |
| **Decks** | A deck is a **card pool** (every card the player brings, including weapons, equipment and sideboard cards) plus one or more **loadouts**. A loadout is what starts a game: the main deck, the weapons and one equipment piece per slot. **A loadout is always a subset of the pool**: no loadout can contain more copies of a card than the pool has. Removing a card from the pool removes it from every loadout. Adding a card to the pool adds it to the default loadout, unless it's marked as a sideboard card. In FaB terms, the pool is the registered deck plus sideboard. Phase one creates one loadout per deck automatically, and choosing between several loadouts can come later without a schema change. |
| **Scoring** | Weapons and equipment are scored on the same dimensions, with the same side rules, as any other card. |
| **Suggested core** | Weapons and equipment don't take up deck space, so they don't compete with deck cards. They're ranked separately, by slot, and the top option for each slot is suggested. |
| **Synergy** | Weapons and equipment are nodes in the graph like any other card. Derived rules can target them, for example cards that care about weapon attacks. |
| **Deck analysis** | Equipment and weapons are always available, so they're counted separately from cards that have to be drawn. Totals show "from the deck" and "always available" apart. |
| **Game engine** | Weapons and equipment are objects in play, each with a slot, a used-this-turn marker, a destroyed state and a general `counters` map. The map means equipment with its own counters fits without engine changes. |
| **Scenarios** | Weapon and equipment slots are always visible to conditions. Filters can target them, and steps include "attack with weapon" and "use equipment". |

Format rules, such as pool size, deck size and how many weapons a hero can carry, are kept as configuration and checked by an experienced player, not hard-coded from memory.

### Scoring

- Users score on a **0–100 scale** using a slider. Internally the maths uses `score / 100`, so the two scales are the same thing. The slider snaps to steps of 10 to reduce noise.
- Score dimensions live in their own table, so new ones can be added without changing the schema. The initial list is decided by the scoring group. A starting draft, taken from the hero and token text:
  - Runechant creation
  - Gate creation
  - Banish (from hand or deck)
  - Playable from banish
  - Enables traverse
  - Utility

  The scoring group agrees to score every dimension on every card they review, or to drop the dimension. Otherwise a dimension that most scorers skip turns into a wall of zeros (see below).
- **Roles.**
  - `user`: personal scores and decks only.
  - `scorer`: scores count toward community scores.
  - `curator`: a scorer who can also flag fringe cards and promote scenarios to the library. This is where experienced deck builders go.
  - `admin`: everything, including the hidden `rating_weight`. Kept to the maintainer, so nobody can quietly give themselves more weight.
- **Rater weighting.** Every scorer's score counts equally by default. Each user has a hidden `rating_weight` (default `1.0`) that only admins can change, so known or power users can be given more influence. It's never returned to non-admin users and never used in client-side score resolution. It's applied only by the community score job on the server.

#### Reviews and blank scores

A **review** means "I have looked at this whole card": every dimension, every printing, both sides. A card is either reviewed by a scorer or it isn't. Reviews aren't recorded per printing or per side.

**Reviewing is an explicit action, separate from saving.** Saving scores saves work in progress. A scorer can work through a card over several sessions, and nothing they save counts toward community scores yet. When they're done, they press **Mark reviewed**. Only then do their scores for that card count, with blanks resolved as below. Without this, saving a single score would quietly turn every other dimension into a 0.

Before confirming, **Mark reviewed** shows a summary of what every printing and side will resolve to on every dimension, with the source of each value: set, inherited from the level above, "not relevant", or blank (counts as 0). Zeros that come from a blank are highlighted. This catches the common trap where a scorer rates the red printing 80, leaves yellow and blue blank, and never set a card-level score, so yellow and blue would count as 0. The summary offers a one-click fix: copy a score to the other printings, set a card-level score for them to inherit, or confirm the zeros.

After a card is reviewed, changes to its scores apply immediately, and the card stays reviewed.

Scores can be given at four levels, from most specific to least:

1. printing + side
2. printing
3. card + side
4. card (the top level)

The rules:

- **A blank uses the level above it.** If a scorer gives the card one Gate creation score and leaves the printings blank, every printing uses the card score.
- **A blank at the top level, on a reviewed card, is a 0.** The scorer looked at the card and decided it doesn't matter there. The UI shows it as "not relevant".
- **Lower levels have an explicit "not relevant" button**, which writes a 0. This is for a scorer who splits a card because one side doesn't care about it. They press "not relevant" on that side. Leaving the side blank means "same as the card".
- **Each scorer's score is resolved first, then averaged.** For each scorer, the app finds the score that applies to a given printing, side and dimension using the rules above. The community score is the weighted average of those resolved scores. A 0 counts with the scorer's full weight, because a 0 is a rating like any other.
- **Throughout the scoring UI, inherited values are shown.** Each blank cell shows the value it will inherit and where it comes from, greyed out, so inheriting and 0 are never confused.
- **A card nobody has reviewed is unknown.** It gets no score, is left out of the suggested core and shows an "unreviewed" badge. A "needs review" list shows scorers which cards are left to cover.

#### Why unreviewed cards have no default score

An obvious idea is to start every card at 50 (0.5) and let ratings pull it up or down. It's been considered and rejected, for four reasons:

1. **A default applies to every dimension, including ones the card has nothing to do with.** Take a card that never creates Gates, and give it a default of 50 worth one rating. One scorer reviews it and correctly leaves Gate creation blank (0). Its Gate creation score is `(50 + 0) / 2 = 25`. Worth three ratings, it would be `(150 + 0) / 4 = 37.5`. The card shows up among Gate creators until enough scorers outvote a number nobody chose.
2. **Unknown isn't the same as average.** At 50, a card nobody has looked at ranks above a card the group deliberately rated 30. The suggested core would favour cards because nobody has reviewed them yet.
3. **It hides what's missing.** A default looks like real data. The "unreviewed" badge and the "needs review" list tell scorers exactly where coverage is thin, and a default would hide both.
4. **The fringe default is different.** It's a deliberate judgement by a curator about a specific card ("this is probably weak"), not something given to every card for lack of information.

The real concern behind a default is one enthusiastic rater pushing a card up. That's handled more directly:

- Scorers are an invited group, so the risk is small to begin with.
- The rating count is shown next to every community score. **Rating count means people**: the number of scorers who have marked the card reviewed. A fringe default is never counted as a rating.
- A **coverage indicator** shows how much of the scoring group has reviewed a card, for example "reviewed by 4 of 7 scorers". It describes coverage, not quality.
- A card needs a rating count of at least **2** before it can appear in the suggested core. This minimum is a setting.
- Curators can flag cards as fringe (below).

Revisit this if scoring is ever opened to the public.

#### Fringe cards

A curator can flag a card as fringe, meaning it's playable but not expected to make most lists. A fringe card starts with a low default score. That default counts as several ratings, so a single scorer's high rating can't lift the card on its own. As scorers rate it, the community average pulls it away from the default. A card the group genuinely rates highly rises on its own, while a card only one person likes stays low.

```
community score = (k × fringe default + Σ weight × resolved score) / (k + Σ weight)
```

`fringe default` (for example 20) and `k` (how many ratings the default is worth, for example 3) are settings an admin can tune. Cards that aren't flagged use the plain weighted average.

The maths keeps three numbers separate, and the UI only ever labels the first as "ratings":

- **Rating count**: how many scorers have reviewed the card. The fringe default isn't included.
- **Total weight**: the sum of the scorers' weights plus `k` for fringe cards. Used only in the maths.
- **Community score**: the result of the formula.

This is deliberate: a lone high rating on a fringe card gives a rating count of 1, so the card stays below the 2-rating minimum for the suggested core, as well as being held down by the default. Don't "fix" this by counting the default as ratings.

Fringe is one flag per card, and the default is applied in the same way to each side's score. A per-side flag can be added later if the scoring group finds it necessary.

#### Other scoring notes

- **Printings and pitch variants.** Pitch variants usually differ in value, so scores can be set per printing. For cards whose effect doesn't change between pitches, a single card-level score covers every printing. Some cards are only printed in one colour, so they only have one printing.
- **Deck-dependent value.** Some cards vary in value with the deck's makeup, which static scores can't capture. This is handled by deck analysis (see Utilities), not by the scores.

### Hero sides

Viserai has two sides that play differently. Going by the hero text, Runechant creation drives traverse on Viserai, the Forsaken, while Gates and blood debt matter on Viserai, Usurper. A card's value can differ between the sides, and users will want to ask questions and filter against one side or the other.

Scoring every card twice would double the scorers' work and the interface's complexity. So side is optional:

- **Scores default to both sides.** A scorer gives one score, and it applies to both sides.
- **The user chooses.** Each card has a "Same score for both sides" toggle. When it's ticked, there is one slider. When it's unticked, there are separate Forsaken and Usurper sliders, each with a "not relevant" button. A user setting decides whether the toggle starts ticked (the default) or unticked, so people who always think per side don't have to untick it on every card.
- Blank and "not relevant" sides follow the rules in Reviews and blank scores.

For users building decks, side becomes a **side focus** slider (Forsaken ↔ Usurper) alongside the source blend. The suggested core, the sorts and the filters all use the score for the chosen focus, or a blend of the two. Deck analysis can show totals for each side as well as for each pitch.

### Synergy graph (phase two)

Each card is a node, and each synergy is a **directed** edge with a weight: "card A helps card B". A Gate creator might enable a blood debt card, without the blood debt card doing anything for the Gate creator. A relationship that works both ways is two edges, one in each direction.

Edges come from two sources, which are kept separate and drawn differently in the graph because they're different kinds of evidence:

- **Derived edges**: generated from card facts by rules (see below). Each edge carries the rule's description, so users can see why it exists.
- **Community edges**: opinions from scorers, aggregated with the same rater weighting as scores.

Scorers create community edges in two ways. Nobody browses thousands of possible card pairs, so neither way asks them to.

1. **Related cards**: on each card's page, a picker to add "this card helps…" and "is helped by…" cards, with an optional note and a "works both ways" tick.
2. **Confirm suggestions**: a queue of edges proposed by the derived rules, which scorers confirm, reject or reweight. This also tests the rules: an edge that keeps being rejected points to a rule that needs correcting.

#### Derived synergy rules

A rule says "if card A has this fact and card B has that fact, add an edge from A to B with this weight". Rules are written in code, in the repo, and maintained by the maintainer. Getting the game logic right needs a player's judgement, so the logic of every rule is checked by the maintainer or an experienced player from the scoring group. Rules drafted by anyone else, including AI tools, are treated as unverified until checked.

The example below shows the shape of a rule only. Its logic is deliberately simplified and isn't a real rule:

```TypeScript
interface SynergyRule {
  id: string;
  description: string; // shown in the UI so users can see why an edge exists
  from: (card: Card) => boolean;
  to: (card: Card) => boolean;
  weight: number; // 0–1
}

// Illustrative only: lacks the nuance a real rule needs
const gateFeedsBloodDebt: SynergyRule = {
  id: "gate-feeds-blood-debt",
  description: "Creates a Gate, which can play blood debt cards from banish",
  from: (c) => (c.attributes.tokens.gate?.numCreated ?? 0) > 0,
  to: (c) => c.attributes.hasBloodDebt,
  weight: 0.8,
};
```

Rules are kept in code because:

- **Corrections are easy.** When a rule is wrong or too simple, it's a code change with a clear diff and a reason in the commit message.
- **Any logic is possible.** A function can express nuance, like conditions, zones and costs, that a fixed database format can't.
- **Type checking.** Rules are checked against the card attribute types, so renaming an attribute can't silently break a rule.

Each rule should have a test with real card pairs that must, and must not, produce an edge. That way a correction doesn't break something else.

### Suggested core

This is a visualisation tool, not an automatic deck generator. The suggested core is a highlighted set of cards that responds to the user's priorities. It doesn't have a fixed size.

In phase one there's no synergy yet, so the output is labelled **"Ranked by your priorities"**, not "suggested core", to avoid implying that synergy is included. From phase two, when synergy joins the ranking, it becomes the suggested core and is also highlighted on the graph. Rules elsewhere in this document that apply to the suggested core, like the minimum rating count and leaving out unreviewed cards, apply to the phase one ranking too.

The user's priorities are a weight for each dimension, for example `{ runechantCreation: 1.0, gateCreation: 0.5, utility: 0.3 }`.

1. **Source blend and side focus**: one slider between "my scores" and "community scores", and one between Forsaken and Usurper, decide which score each card uses.
2. **Card value** = `Σ priority[d] × score[card][d]`
3. **Ranking**: cards are ranked by value. From phase two the ranking adds synergy: cards are picked greedily, one at a time, by `value + synergy with cards already picked`.
4. **Threshold**: the user moves a cut-off (by count or by score) to grow or shrink the core.
5. **Pin and exclude**: the user can pin cards (always in the core, and the ranking builds around them) or exclude cards. Cards in the deck being built count as pinned.
6. **Constraints**: Classic Constructed copy limits (max 3 of each card), at least 2 community ratings (when using community scores), and no unreviewed cards.
7. **Weapons and equipment**: ranked separately by slot, as described in Weapons and equipment.

From there the user can add the core to a deck, or ignore it and build manually. Either way, the deck builder shows the deck's totals for each dimension as it changes.

The hero's card pool is small, so the ranking runs in the browser. Changing a priority recalculates instantly, with no backend call.

## Utilities

Deck building utilities give initial impressions of a deck and lightly check whether it meets the goals the user set for it.

### Deck analysis

Answers questions about the deck being built, using card facts and the deck's composition.

**Pitch breakdown.** For each dimension, how much of it is in red, yellow and blue cards. For example: "8 Gate creators, 6 of them blue". Weapons and equipment are shown separately as "always available". Calculated directly from the deck list and shown in the deck builder (phase one).

**Condition availability (phase two).** Many effects are conditional, and how often the condition can be met depends on the rest of the deck. For example, Become the Shadow Lord only creates a Gate if you banish a Shadow card from hand, so it needs another Shadow card in hand. The card facts already record these conditions. The app turns each one into a built-in scenario and reports how often the condition is **available**, for example "a Shadow card to banish is in hand 55% of the time".

This is deliberately **not** called expected output. Having a Shadow card in hand doesn't mean you'll play the line that creates the Gate. That depends on decisions the engine doesn't make. Every number is shown with the assumptions it used, and the user can change them.

The default depends on what the engine can do:

- **Until scripted steps exist: opening hand, hand only.** Players would expect "start of turn 2, hand and arsenal", but without steps, nothing ever gets put in arsenal, so that setting would quietly mean "turn 2, hand only" under an assumed turn model. That's less honest than the opening hand.
- **Once steps exist: start of turn 2, hand and arsenal**, using a default "arsenal the best card matching the condition" step. This is the number players will recognise. The opening hand stays as an option. True expected output can only come later, under the explicit assumptions of scripted steps (see Scenarios).

**In the deck builder.** Analysis also drives the deck builder's card list, not just a summary panel:

- **Filters**: by pitch, dimension and card type together, for example "blue Gate creators" or "red cards that create Runechants".
- **Sort by dimension**: within the current filter, using the user's score source (mine, community or blend).
- **Gaps** (phase two): highlight dimensions that are thin in a pitch colour (for example "no yellow Gate creation") and filter to the cards that would fill them.
- **Condition availability** (phase two): sort or filter by how often a card's condition is available in this deck.

### Shared game engine

Goldfishing and Scenarios share one engine: a plain TypeScript module with no React and no network calls. It holds the game state, which is the zones, weapon and equipment slots, token counts, hero side, turn number and a seeded shuffle, and it applies actions to that state. The seed means any shuffle can be reproduced exactly, which is how the two tools link together (see below).

**The engine only moves cards and counts things. It doesn't know any card rules.** Game logic lives in separate rule sets that are switched on explicitly and checked by a player:

- **Synergy rules**: card A helps card B (see Synergy graph).
- **Hero prompts**: suggestions in goldfishing (see below).
- **Condition definitions**: the conditions recorded in card facts, used for condition availability.

### Goldfishing

The draw 4 tool on Fabrary is fairly limited. The goldfish tool is a nicer, more manual Talishar for testing: a **sandbox** for playing a deck's turns alone. The user moves every card by hand and the tool keeps track of the state. The tool enforces no game rules.

**Setup**

- Choose a deck, a loadout and a starting side (Forsaken by default).
- Shuffle, then draw up to intellect (4). The seed is shown, and a seed can be entered to replay a specific shuffle.
- The hero, weapons and equipment from the loadout start in play.

**Zones**

Deck, hand, arsenal, pitch, arena (cards in play), graveyard and banished, plus the weapon and equipment slots. Every zone shows its card count. The deck stays face down, apart from cards the user chooses to look at.

**Card actions.** Available by drag and drop, a menu on each card, and keyboard shortcuts:

- Move to any zone
- Put on top of or at the bottom of the deck
- Play (to the arena, then the graveyard)
- Pitch (to the pitch zone, adding its pitch value to the resource counter)
- Banish, face up or face down
- Look at the top N cards of the deck, and reorder or move them
- Search the deck for a card, then shuffle

**Weapon and equipment actions**

- **Attack with the weapon**: marks the weapon as used this turn and logs the attack. Activating a weapon attack destroys Runechants, so this is where a Runechant prompt would appear (see Hero prompts).
- **Use or destroy equipment**: marks a piece as used, or moves it to the graveyard.
- **Counters** on any weapon or equipment piece, with + and − buttons.
- End turn resets the "used this turn" markers.

**Tokens and counters.** Each has + and − buttons:

- Runechants, Gates to i'Arathael and Eloquence
- Runechants created and Gates created or activated this turn. These are the counts the hero's traverse conditions depend on. Adding a token with + also counts it as created this turn.
- Resources available
- Life total
- Damage dealt this turn and in total (entered manually)
- Hero side, with a flip button

**Turns.** A turn counter is always visible, so the user gets a feel for what the deck can do in a given turn.

- **End turn**: a helper, not a rule. It moves pitch zone cards to the bottom of the deck (in an order the user chooses, or random), resets the "this turn" counters, draws up to intellect and moves the turn counter on. The user can skip it and move things by hand.
- **Turn recap**: at the end of each turn, a short summary of what happened: cards played and pitched, weapon attacks, resources spent, tokens created and used, damage dealt, and whether the side changed. Recaps build into a turn-by-turn history for the session.
- **Undo and redo** for every action, plus an action log.
- **Restart** with the same seed or a new one.

**Hand summary.** A side panel shows the current hand and arsenal's totals for each dimension and pitch, alongside what the weapons and equipment add. It uses the same numbers as Deck analysis.

**Hero prompts (maybe, later).** Optional and off by default, turned on in user settings. When a hero ability or token might trigger, the tool asks, for example "You created Runechants. Banish the top card of your deck?" on Forsaken, or "Attack played. Destroy 3 Runechants and deal 3 arcane damage?". The user confirms each one, and nothing happens automatically. Prompts are a separate rule set, checked like the synergy rules.

Goldfish sessions aren't saved to the database. A session can be shared as a link containing the deck, loadout, seed and action log.

### Scenarios

Scenarios are a **rule engine** for decks, in the style of Marketo smart lists and flows. The user builds a rule from blocks, such as "by turn 2, with these assumptions, does my hand meet these conditions?", and runs it against a deck. The app shuffles and plays out the rule thousands of times and reports how often it succeeds.

**Feasibility.** This is very achievable if it's built in two stages, and the boundary between them stays firm:

1. **Conditions (the smart list).** A tree of AND / OR groups containing filter blocks, checked against the cards available at a point in time. This is the most valuable part and the simplest. Ready-made query builder components (for example `react-querybuilder`) provide the Marketo-style editing interface without building it from scratch.
2. **Steps (the flow).** An ordered list of simple, scripted actions run before the conditions are checked, such as "pitch a blue card" or "put the highest Gate creation card in arsenal". Every step is deterministic: it uses a fixed rule to choose the card ("the first match" or "the highest score"), never a judgement. This keeps it a script and not a game-playing AI. Steps are added once conditions work.

The limit: the engine never decides what to do. Whatever the user's rule says happens, happens. Choosing the best play would need a game-playing AI, which is out of scope.

#### The scenario contract

These rules are fixed before stage one is built:

- **Typed and validated.** A scenario definition is a typed structure, checked against a schema (for example with `zod`) before it runs, and carries a version number so old scenarios can be migrated. A definition is data, never executable code.
- **Fixed cards.** Each fixed card removes exactly one copy from the deck before shuffling. Three copies with one fixed leaves two in the deck. Fixing two copies needs two fixed-card entries. If the deck doesn't have enough copies, the scenario can't run on that deck, and it reports an error rather than quietly passing or failing.
- **When conditions are checked.** Once per run, at the horizon: after turn N's draw and turn N's steps.
- **What conditions can see.** Only the zones listed in the scenario's access setting, plus the weapon and equipment slots, which are always visible.
- **Counting.** Each copy of a card counts separately. A block can be set to count distinct cards instead.
- **AND / OR.** Standard boolean logic. Groups can be nested. A block is `count of cards matching a filter, in the visible zones` compared with a number.
- **Success.** A run succeeds if the whole condition tree is true at the horizon. The success rate is successful runs ÷ total runs.
- **Scores.** Any filter or step that uses scores takes the score source (mine, community or blend) and side focus from the scenario definition. It doesn't use whatever the user's current sliders say.

#### Building a rule

- **Horizon**: opening hand, or by turn N.
- **Turn model** (chosen by the user for each scenario): how unused cards carry between turns. Either every card is used or pitched and a fresh hand is drawn, or cards stay and the hand is drawn back up to intellect.
- **Access**: which zones count, for example hand only, hand and arsenal, or hand and the top card of the deck.
- **Fixed cards** (optional): cards assumed to already be somewhere, for example "Become the Shadow Lord in arsenal".
- **Score source and side focus**: used by any score-based filter or step.
- **Steps** (stage 2): scripted actions for each turn.
- **Conditions**: AND / OR groups of blocks.

Illustrative examples (the logic still needs checking by a player):

- "Opening hand has Become the Shadow Lord and at least one other Shadow card"
- "By turn 2, hand and arsenal contain cards that create 3 or more Runechants in total"
- "Each turn, put the best blood debt card in arsenal. By turn 3, is there a Gate creator in hand?"

**Starter set of filters and steps.** Each filter and step is a small typed definition in code, so adding one later is a small change. The starter set is a guess, to be reviewed by the scoring group:

| Filters | Steps |
| --- | --- |
| Specific card or printing | Draw N |
| Card fact (blood debt, creates Runechants, creates Gates, go again…) | Pitch a card matching a filter |
| Class (Shadow, Runeblade, generic) | Put a card matching a filter in arsenal |
| Card type (attack action, non-attack action, instant, weapon, equipment…) | Block with N cards (lowest score first) |
| Pitch colour | Banish a card matching a filter from hand |
| Dimension score threshold | Attack with weapon |
| Total of a fact across matching cards (e.g. Runechants created) | Use equipment |
| Hero side | Flip hero side |

Steps that choose a card use a fixed tie-break: highest score on a chosen dimension, then lowest pitch, then first in hand.

#### Running a scenario

- Runs in the browser, in a Web Worker so the page doesn't freeze. The default is 10,000 runs.
- Results show the success rate, a breakdown by turn when the horizon is longer than the opening hand, and the deck size and composition the run used.
- **Why runs failed**: failures are grouped by which condition block was false, for example "62% of failures: no blue card in hand". A run can fail for several different reasons, and a few sample hands wouldn't show that.
- **Failed hands**: a sample of failed runs, each with an "Open in goldfish" button that loads that exact shuffle by its seed. This lets the user see why it failed and try to play it out by hand. It's an illustration, not the full picture: the grouping above is the full picture.

#### Saved scenarios

- Users save scenarios to their account and can run them all against any deck. Results are shown as a table of scenarios and success rates.
- **Visibility**: each scenario is private (the default), shared by link, or in the library. Anyone with the link can view and copy a shared scenario. The library is a curated set: curators can promote a scenario into it, and every user can run library scenarios against their decks.
- **Compare decks**: run the same scenarios against two decks, or two versions of one deck, side by side, with the same seeds and the same scores. This shows whether a change helped.
- **Reproducibility**: a seed alone can't reproduce a result if the deck, scores or engine have changed since. Every saved result records all of its inputs:
  - a snapshot of the deck and loadout
  - the scenario definition and its version
  - the seed, number of runs and other simulation settings
  - the version of the community scores (or the personal scores) used
  - the engine version

  If any input differs when a scenario is re-run, the UI says which one, so old and new numbers aren't compared as like for like. No sophisticated versioning system is needed: recording the inputs is enough to spot differences.
- Changing a deck in the deck builder can re-run saved scenarios automatically, as a live check.

## Talishar Integration

Ideally, decks created here can be played on Talishar, with match data collected into our database for a weekly stats update. What do the games say about these decks? This will be expanded on once the core of the application is built. Match results could later feed into rater weighting.

# Architecture and Build

## Frontend

- TypeScript
- React
- Redux
- TanStack Router
- Local CSS
- Suggested core ranking, personal score resolution, the game engine and scenarios all run client-side

## Shared code

The repo is a workspace (monorepo) so logic is written once:

- `packages/scoring`: score resolution (review and blank rules, fringe default). Used by the frontend for personal scores and by the community score Edge Function.
- `packages/engine`: the game engine and scenario runner (phase two).
- `packages/cards`: card types and attribute types, shared by everything.

Edge Functions run on Deno, so how they import a workspace package (bundling, an import map or a relative import) needs to be confirmed during setup, before any scoring code is written.

## Backend

- Supabase
  - User registration and login
  - Card database
  - User decks
  - User scoring
  - Row level security: users can only write their own scores, curators can set fringe flags and library scenarios, and `rating_weight` can be read and written by admins only
  - **Community score job**: a Supabase Edge Function (TypeScript) that recalculates the `community_scores` table when scores change or on a short schedule. It runs on the server because it needs the hidden `rating_weight` values, which must never reach the browser. It uses `packages/scoring`, the same score resolution module as the frontend, so the review and blank rules are written once.

### Tables

```
users            (id, ..., role, rating_weight default 1.0, preferences jsonb)
                 -- role: user | scorer | curator | admin
                 -- rating_weight: admin-only; never returned to non-admins or used client-side
                 -- preferences: e.g. { scoreSidesTogether: true }
cards            (id, name, type, subtypes text[], classes text[], text,
                  attributes jsonb, fringe boolean default false)
                 -- type: action | attack_action | instant | weapon | equipment | ...
                 -- subtypes include the equipment slot and weapon handedness
printings        (id, card_id, pitch null, defense null, power null, ...)
score_dimensions (id, key, label)
card_scores      (user_id, card_id, printing_id null, side null, dimension_id, score 0–100)
                 -- printing_id null = card level; side null = both sides
                 -- an explicit "not relevant" is stored as score 0
                 -- a missing row uses the level above (see Reviews and blank scores)
                 -- UNIQUE NULLS NOT DISTINCT (user_id, card_id, printing_id, side, dimension_id)
                 --   one row per scope; NULLS NOT DISTINCT (Postgres 15+) makes two card-level
                 --   rows for the same dimension a conflict, which a plain UNIQUE would allow
                 -- printing_id must belong to card_id (check via foreign key on (card_id, printing_id))
card_reviews     (user_id, card_id, reviewed_at)
                 -- PRIMARY KEY (user_id, card_id)
                 -- written only by "Mark reviewed"; covers every printing and both sides
                 -- no rows for a card = unreviewed
card_synergies   (user_id, from_card_id, to_card_id, weight, note null)
                 -- directed: "from helps to"; a two-way relationship is two rows
synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict, weight null)
                 -- verdict: confirm | reject | reweight
                 --   confirm: the edge uses the rule's weight (weight must be null)
                 --   reject: this user's vote is for no edge (weight must be null)
                 --   reweight: the edge uses this weight (weight required)
                 -- enforced with a CHECK constraint
decks            (id, user_id, name, ...)
deck_cards       (deck_id, printing_id, quantity, sideboard boolean default false)
                 -- the card pool, incl. weapons and equipment
deck_loadouts    (id, deck_id, name, is_default)
loadout_cards    (loadout_id, printing_id, quantity)
                 -- main deck + weapons + equipment for one game; a subset of the pool
scenarios        (id, user_id, name, definition jsonb, definition_version,
                  visibility default 'private')
                 -- visibility: private | link | library (library set by curators only)
community_scores (card_id, printing_id null, side null, dimension_id,
                  score, rating_count, total_weight, scores_version, computed_at)
                 -- written by the community score job
                 -- UNIQUE NULLS NOT DISTINCT (card_id, printing_id, side, dimension_id)
                 -- rating_count = people; total_weight includes the fringe default
scenario_results (id, scenario_id, user_id, deck_snapshot jsonb, definition jsonb,
                  definition_version, seed, runs, settings jsonb, scores_version,
                  engine_version, results jsonb, run_at)
```

## Middleware

- **Go on AWS Lambda**, separate from Supabase, for data-intensive work. It reads and writes the Supabase Postgres database directly.
  - Talishar integration tool
    - Send your deck to play on Talishar
    - Retrieve game data
  - Weekly stats aggregation from match data
  - Later candidates: heavy batch jobs, such as running every library scenario against every public deck, or moving the community score job here once it outgrows an Edge Function

## Phase One: minimum viable release

The goal is one complete loop: **accurate cards → scoring → community scores → priorities → ranked cards → deck**.

**Time budget: 3–4 weeks, part-time, for the build.** The project should stay small enough to build and refine without taking over. The interface is functional, not polished.

**Card data is budgeted separately: about 1 week.** It's the largest hidden task. To keep it manageable:

- **Import base facts from an existing dataset**: name, type, subtypes, classes, text, and each printing's pitch, cost, power and defense. An open community dataset such as `the-fab-cube/flesh-and-blood-cards` on GitHub is the first candidate. Check its licence and how current it is before relying on it, and expect some cleanup.
- **Hand-author only what's specific to Viserai**: `attributes` such as tokens created, conditions and blood debt.
- **Have a player check the result**, especially the conditions.

**If the budget runs out, ship a smaller working loop** rather than dragging all of phase one over the finish line. In priority order:

1. Accurate card and printing data
2. Personal scoring with clear review semantics
3. Community scores
4. Ranking by priorities
5. Basic deck editing and pitch breakdown

Never cut corners on the scoring model to hit the date. Cut interface features instead.

**In phase one**

- Supabase
  - Tables listed above, with row level security
  - Load the relevant cards and printings with accurate facts, **including weapons and equipment** with their types and slots
  - Community score job
- Frontend
  - Basic internal component library and navigation
  - Card table with search, filters (pitch, type, dimension) and sorting
  - Scoring: one score or split by side, "not relevant", inherited values shown, "Mark reviewed" with its summary
  - "Needs review" list for scorers
  - Priorities, source blend and side focus, and "Ranked by your priorities", with weapons and equipment ranked by slot
  - Minimal deck builder: card pool, one default loadout with weapon and equipment slots, dimension totals and pitch breakdown

**Not in phase one**

- Synergy graph visualisation, derived synergy rules and community synergy edges (phase two)
- Synergy in the suggested core ranking (phase two)
- Gap highlighting and condition availability (phase two)
- Choosing between multiple loadouts in the interface (the schema supports it)
- Admin interface: roles, `rating_weight`, fringe flags and fringe settings are edited in the Supabase dashboard
- Invite flow: scorers sign up normally, and an admin sets their role in the dashboard
- Per-side fringe flags
- Goldfishing, Scenarios and Talishar

**Rule of thumb:** if a feature threatens the budget, it moves to phase two rather than delaying launch. The underlying scoring model matters more than visual polish.

**Exit criteria**

1. **Phase one ships to the scoring group first.** They use it to score cards.
2. **Public launch requires the coverage pass**: the scoring group has reviewed most cards, so "Ranked by your priorities" isn't empty on day one. Unreviewed cards are left out of the ranking. The exact coverage threshold is decided by the scoring group.

## Phase Two

Build in this order, because each step uses the one before it:

1. **Synergy:** derived rules with tests, the confirm-suggestions queue, related-cards picker, synergy in the ranking
2. **Graph visualisation** with the suggested core highlighted, and derived and community edges drawn differently
3. Gap highlighting in the deck builder
4. Shared game engine (zones, weapon and equipment slots, seeded shuffle, actions, undo), with tests
5. Goldfish tool (sandbox, tokens and counters, turn counter and recap)
6. Scenarios stage 1: the scenario contract, condition builder, Web Worker runner, failure grouping, saved scenarios
7. Condition availability (built-in scenarios) in Deck analysis
8. Compare decks, failed hands opening in goldfish
9. Scenarios stage 2: scripted steps
10. Hero prompts in goldfish (optional)

## Phase Three

- Go on AWS Lambda for Talishar integration
- Weekly stats update from match data

# Open questions

## General

- Confirm the initial score dimensions with the scoring group.
- Should a user's personal scores be visible to other users, or private?
- Format rules for Classic Constructed (pool size, deck size, weapon limits) to be confirmed by an experienced player and stored as configuration.

## Goldfishing and Scenarios

- **Steps and filters.** Review the starter set with the scoring group: what's missing, and what's never used?
- **Condition availability default.** Once steps exist, confirm with the scoring group that "start of turn 2, hand and arsenal, arsenal the best matching card" is the default players expect.
