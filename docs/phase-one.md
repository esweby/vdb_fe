# Phase One Plan

This is the working plan for phase one: what to build, in what order, and how we'll know each part is done. The design itself is in the [README](../README.md).

**Goal:** one complete loop: accurate cards → scoring → community scores → priorities → ranked cards → deck.
**Budget:** 3–4 weeks part-time for the build, plus about 1 week for card data.
**Exit:** ship to the scoring group, then a coverage pass before public launch.

## Card data findings (14 Oct 2026)

Checked the `the-fab-cube/flesh-and-blood-cards` dataset.

- **Usable.** The data is good and well structured. Each entry is one name + pitch, with cost, power, defense, types, keywords (e.g. `Go again`) and full text, plus legality and ban flags for Classic Constructed. There's no LICENSE file, but its README says the data can be used for any project. Card text and images are Legend Story Studios' property either way, so link to image URLs rather than rehosting images.
- **The new heroes aren't on `main` yet.** Viserai, the Forsaken and Viserai, Usurper (and Become the Shadow Lord) are only on the `usurp-the-shadow-throne` feature branch, which may change before release. The importer pins a specific commit (currently `01fc934`) and is re-run when the branch merges.
- **Naming clash.** The dataset's "card" is one name + pitch, which is our `printing`. Its "printing" means a physical print run, such as an edition or foil. To avoid confusion, rename our `printings` to **`variants`** before any migrations are written.
- **The pool is much bigger than expected.** A rough legality filter (Runeblade, Shadow or Generic; Classic Constructed legal; not banned) gives:

  | | Deck cards (name + pitch) | Weapons and equipment |
  | --- | --- | --- |
  | Runeblade / Shadow | 380 | 42 |
  | Generic | 507 | 118 |
  | **Total** | **887** | **160** |

  That's 633 distinct card names, not the ~150 the README assumed. The browser handles this size easily. The real impact is on **scorer workload** and **hand-authored attributes**. The filter is approximate and needs checking by a player.

- **Example card checked.** Become the Shadow Lord is a blue-only Shadow Runeblade Action: cost 0, pitch 3, defense 3, Go again. That matches the README example.

**Response to the pool size (decided):** import everything. There's no focus pool flag. Generics surface on their own: scorers score the generics they actually build with, and unreviewed ones stay out of the ranking. The "needs review" list and attribute authoring put Runeblade and Shadow cards first. Clearly irrelevant generics, such as old equipment, can be hidden later with a flag.

## Milestones

Each milestone ends with something that works. "Days" means part-time working sessions, and the numbers are rough. Excluding card data, they add up to about 19–26 sessions. That fits 3–4 weeks only at around 5–6 sessions a week, so the cut line below matters.

### M0: Setup and spikes (2–3 days)

These three tasks go first because any of them could change the plan.

- [ ] Install the Supabase CLI and Docker. `supabase init`, local stack running.
- [ ] Confirm how the GitHub integration applies `supabase/migrations` to the hosted project, and which branch it deploys from.
- [ ] Check the hosted project's Postgres version is 15 or later (needed for `UNIQUE NULLS NOT DISTINCT`).
- [ ] Workspace (npm workspaces): `apps/web`, `packages/cards`, `packages/scoring`, `supabase/`.
- [ ] **Spike:** a Supabase Edge Function imports a function from `packages/scoring` and runs locally and when deployed.

**Done when:** a trivial function from `packages/scoring` is called by both a test in the web app and a deployed Edge Function.

### M1: Schema and security (3–4 days)

- [ ] Migrations for every phase one table in the README.
- [ ] Constraints: `UNIQUE NULLS NOT DISTINCT` on `card_scores` and `community_scores`; `variant` belongs to `card`; the `synergy_feedback` CHECK; loadout quantities ≤ pool quantities.
- [ ] Row level security for each role: user, scorer, curator, admin. `rating_weight` is readable by admins only.
- [ ] Seed the draft score dimensions.
- [ ] Tests for row level security (e.g. pgTAP, or a script that signs in as each role).

**Done when:** migrations apply cleanly to a fresh local database, and the row level security tests pass for every role.

### M2: Card data (≈1 week, separate budget)

- [ ] Importer: reads the pinned dataset commit and upserts `cards` and `variants`, using the dataset's `unique_id` as a stable external ID. Safe to re-run.
- [ ] Legality filter, with the result checked by a player.
- [ ] Map dataset fields to ours: types → `type`, `subtypes`, `classes`; keywords → `hasGoAgain` and similar. Generate as many `attributes` as possible from the data.
- [ ] Hand-author the Viserai-specific `attributes` (`tokens`, `conditions`, blood debt and so on), Runeblade and Shadow cards first, generics as needed.
- [ ] A player checks a sample of authored attributes, and every condition.

**Done when:** every legal card is in the database, weapons and equipment have their slots, and every Runeblade and Shadow card has checked attributes.

### M3: Scoring logic (3–4 days)

- [ ] `packages/scoring`: resolving each scorer's score through the levels (variant + side → variant → card + side → card), top-level blank = 0 on reviewed cards, fringe default, rating count vs. total weight.
- [ ] Unit tests for every rule in README "Reviews and blank scores", including the red-80-yellow-blank trap and the fringe card with a single rating.
- [ ] Community score Edge Function: reads scores, reviews and weights, writes `community_scores` with a `scores_version`.

**Done when:** tests cover every rule, and the job produces correct community scores for a hand-built test fixture.

### M4: Frontend shell (2–3 days)

- [ ] Vite + React + TypeScript + Redux + TanStack Router in `apps/web`.
- [ ] Supabase auth (sign up, sign in, sign out), with role available in the app.
- [ ] Navigation and a minimal component library: button, input, slider, table, tag, dialog.

**Done when:** a user can sign in and move between empty pages.

### M5: Card table and scoring UI (4–5 days)

- [ ] Card table: search, filters (pitch, type, class, dimension), sorting.
- [ ] Card page: every dimension, the "Same score for both sides" toggle (default from preferences), per-variant scores, "not relevant", inherited values greyed in.
- [ ] Save as draft, and **Mark reviewed** with the summary and one-click fixes.
- [ ] "Needs review" list, Runeblade and Shadow cards first.

**Done when:** a scorer can review a card from start to finish, and the community score updates.

### M6: Ranking (2–3 days)

- [ ] Priorities editor (a weight for each dimension), source blend, side focus.
- [ ] "Ranked by your priorities": threshold, pin and exclude, minimum rating count, unreviewed cards left out.
- [ ] Weapons and equipment ranked separately by slot.

**Done when:** changing a priority re-ranks instantly, and the ranking matches hand-calculated results for a test fixture.

### M7: Minimal deck builder (3–4 days)

- [ ] Card pool and default loadout, sideboard flag, weapon and equipment slots.
- [ ] Copy limits, plus format limits from configuration.
- [ ] Dimension totals and pitch breakdown, with "always available" (weapons and equipment) shown separately.
- [ ] Add ranked cards to the deck.

**Done when:** a user can build a legal deck from the ranking or by hand and save it.

## Cut line

If time runs out, ship in this order and stop where the budget ends. Never cut the scoring model; cut interface features instead.

1. M0–M3, the foundations. Can't be cut.
2. M5 scoring UI (without polish)
3. M6 ranking
4. M7 deck builder
5. Polish: component library breadth, filters, preferences

## Exit criteria

1. Ships to the scoring group, who use it to score.
2. Public launch once the scoring group has reviewed most Runeblade and Shadow cards, plus the generics they use. They decide the exact threshold.

## Decisions (14 Oct 2026)

- Rename `printings` → `variants`: **yes** (done in README).
- No focus pool flag: generics surface on their own; trim irrelevant generics later.
- Build on the pinned pre-release `usurp-the-shadow-throne` branch until it merges: **yes**.
- Importer language: **TypeScript**.

## Supabase setup (current state)

- GitHub integration is connected to `esweby/vdb_fe`, working directory `.`.
- "Deploy to production" is **off**. Branching (preview databases per pull request) needs the Pro plan, so it isn't available.
- Workflow until then: develop and test migrations against the local Supabase stack. Turn on "Deploy to production" with `main` as the production branch once the first migrations are ready, so merging to `main` applies them.
