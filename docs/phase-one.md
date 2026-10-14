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

  |                    | Deck cards (name + pitch) | Weapons and equipment |
  | ------------------ | ------------------------- | --------------------- |
  | Runeblade / Shadow | 380                       | 42                    |
  | Generic            | 507                       | 118                   |
  | **Total**          | **887**                   | **160**               |

  That's 633 distinct card names, not the ~150 the README assumed. The browser handles this size easily. The real impact is on **scorer workload** and **hand-authored attributes**. The filter is approximate and needs checking by a player.

- **Example card checked.** Become the Shadow Lord is a blue-only Shadow Runeblade Action: cost 0, pitch 3, defense 3, Go again. That matches the README example.

**Response to the pool size (decided):** import everything. There's no focus pool flag. Generics surface on their own: scorers score the generics they actually build with, and unreviewed ones stay out of the ranking. The "needs review" list and attribute authoring put Runeblade and Shadow cards first. Clearly irrelevant generics, such as old equipment, can be hidden later with a flag.

## Working agreement

- **Test first.** Each checklist item starts with a failing test: Vitest for TypeScript, pgTAP for schema, constraints and row level security. A "done when" isn't met until tests show it.
- **Branches and pull requests only.** CI (typecheck and unit tests, plus database tests from M1) must pass before merging to `main`.

## Milestones

Each milestone ends with something that works. "Days" means part-time working sessions, and the numbers are rough. Excluding card data, they add up to about 19–26 sessions. That fits 3–4 weeks only at around 5–6 sessions a week, so the cut line below matters.

### M0: Setup and spikes (2–3 days)

These three tasks go first because any of them could change the plan.

- [x] Install the Supabase CLI and Docker. `supabase init`, local stack running.
- [x] Confirm how the GitHub integration applies `supabase/migrations`: production deploys are off for now, and there's no branching on the free plan.
- [x] Hosted Postgres is 17.11 (local matches), so `UNIQUE NULLS NOT DISTINCT` is available.
- [x] Workspace (npm workspaces): `packages/cards`, `packages/scoring`, `supabase/`. `apps/web` comes in M4.
- [x] **Spike:** the `community-scores` Edge Function imports `@vdb/scoring` through `deno.json`. It works locally and when deployed.
- [x] CI: typecheck and unit tests on every pull request.

**Done when:** a trivial function from `packages/scoring` is called by both a test in the web app and a deployed Edge Function.

### M1: Schema and security (3–4 days)

- [x] Migrations for every phase one table in the README. Synergy and scenario tables (and the `synergy_feedback` CHECK) move to phase two with their features.
- [x] Constraints: `UNIQUE NULLS NOT DISTINCT` on `card_scores` and `community_scores`; a variant must belong to its card; loadouts always a subset of the pool (default loadout created, clamped, cleaned up by triggers).
- [x] Row level security and column privileges for each role. `rating_weight` lives in its own `rater_weights` table so it can be admin-only.
- [x] Seed the draft score dimensions and scoring settings (`app_settings`).
- [x] pgTAP tests (65) for schema, constraints and row level security, run in CI as `db-test`.

**Done when:** migrations apply cleanly to a fresh local database, and the row level security tests pass for every role.

### M2: Card data (≈1 week, separate budget)

- [x] Importer (`packages/importer`, `npm run import -w @vdb/importer`): downloads the pinned dataset commit, upserts `cards` (keyed by name) and `variants` (keyed by the dataset's `unique_id`). Safe to re-run; keeps `fringe` and `hidden`. Refuses a non-local database without `--yes-remote`.
- [ ] Legality filter (`src/classify.ts`), **to be checked by a player**. First run: 633 cards, 1,047 variants (173 action, 224 attack action, 34 instant, 19 defense reaction, 7 attack reaction, 7 block, 9 resource, 9 weapons, 151 equipment).
- [x] Map dataset fields to ours: types → `type`, `subtypes`, `classes`, `talents`; keywords → `hasGoAgain`, `hasBloodDebt`. Text and attributes are stored per variant as well, because pitch variants can differ (e.g. "create 3/2/1 Runechants").
- [x] Attribute vocabulary (`packages/cards`, [docs/attribute-vocabulary.md](attribute-vocabulary.md)), validated by the importer, with plain-English descriptions and a review sheet generator.
- [x] Other heroes' specializations excluded (removed Doomsday, Eclipse, Oblivion, Soul Harvest, Soul Reaping, Flail of Agony). Pool: 627 cards, 1,041 variants.
- [x] Hand-author attributes in review batches. All 228 Runeblade and Shadow cards, plus the generics Snapdragon Scalers and Base of the Mountain, are authored and verified by the maintainer:
  1. Runechant creators (51)
  2. Gate creators (12)
  3. Blood debt, banish and play from banish (81)
  4. Weapons and equipment (43)
  5. Everything else (42)
- [x] A player checks every authored card, not just a sample, including every condition. The vocabulary grew during review: go again kinds, disruption, instant speed, card groups and references, Rune Gate, banish payoffs and more. See [attribute-vocabulary.md](attribute-vocabulary.md).

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
