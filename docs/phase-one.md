# Phase One Plan

This is the working plan for phase one: what to build, in what order, and how we'll know each part is done. The design itself is in the [README](../README.md).

**Goal:** one complete loop: accurate cards → scoring → community scores → priorities → ranked cards → deck.
**Budget:** 3–4 weeks part-time for the build, plus about 1 week for card data.
**Exit:** ship to the scoring group, then a coverage pass before public launch.

## Status (19 Oct 2026)

**Shipped to the scoring group.** They're scoring: two scorers have reviewed the whole pool (627 cards) and the maintainer about 130. Exit criterion 1 is met, and the coverage pass for public launch runs alongside phase two.

Carried into phase two (none of these block it):

- A player check of the legality filter (M2).
- Number entry when scoring doesn't work well on a MacBook keyboard. Details to come from the maintainer; a failing test first.
- M8: a shared type scale and spacing scale, and a full keyboard and screen-reader pass.
- The scoring group's open questions: slider wording, risk presets, the spread threshold, the Mine / Blend / Community presets and the strategy question wording.

Phase two starts with synergy. The derived rules are drafted, unverified, in [synergy-rules.md](synergy-rules.md).

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
- [x] Mock scores for local development (`npm run mock-scores -w @vdb/importer`, after the import): five mock scorers review most Runeblade and Shadow cards and about a quarter of the generics, then community scores are recalculated, so the ranking and deck builder have rows to show. A rough guide, not a judgement of any card. Re-running replaces the previous mock data; `-- --seed 2` gives a different set. Local stack only, with no override.
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

- [x] `packages/scoring`: resolving each scorer's score through the levels (variant + side → variant → card + side → card), top-level blank = 0 on reviewed cards, fringe default, rating count vs. total weight. Drafts (cards not marked reviewed) don't count; only scorer, curator and admin roles count.
- [x] Unit tests for every rule in README "Reviews and blank scores", including the red-80-yellow-blank trap and the fringe card with a single rating.
- [x] Community score Edge Function (`supabase/functions/community-scores`): reads scores, reviews and weights with the service role, computes with `@vdb/scoring`, and swaps in `community_scores` atomically through `replace_community_scores` (service role only, pgTAP tested). Verified end to end locally against hand-calculated results.
- [x] When the job runs: **both**.
  - Daily at 03:00 via pg_cron + pg_net (`invoke_community_scores_job`). This needs the Vault secrets `project_url` and `service_role_key` in the hosted project, and does nothing until they exist. Verified locally: the scheduled call reached the function and wrote scores.
  - After each "Mark reviewed": the app calls the function (built in M5).

**Done when:** tests cover every rule, and the job produces correct community scores for a hand-built test fixture.

### M4: Frontend shell (2–3 days)

- [x] Vite 8 + React 19 + TypeScript + Redux Toolkit + TanStack Router in `apps/web`, CSS Modules. Vitest 5 with Testing Library (jsdom).
- [x] Supabase auth (sign up, sign in, sign out) behind an `AuthService` interface (a fake in tests); the role is in Redux. Private pages redirect to sign-in; Needs review is scorers only.
- [x] Navigation and a minimal component library: Button, TextField, Slider ("not set" is distinct from 0), Table, Tag, Dialog.
- [x] Local dev accounts in `supabase/seed.sql` (local resets only). Verified in a browser against the local stack: sign in as a scorer, navigate, sign out, private-page redirect, phone width.

**Done when:** a user can sign in and move between empty pages.

### M5: Card table and scoring UI (4–5 days)

- [x] Card table: search, filters (pitch, type, class), sorting. Dimension filters come with community scores in M6.
- [x] Card page: text, plain-English attributes (incl. per pitch), every dimension, the "Same score for both sides" toggle (default from preferences), per-pitch scores, "not relevant", inherited values shown.
- [x] Scores save as they're set (drafts until reviewed); **Mark reviewed** with the summary and a one-click fix for the blank-pitch trap.
- [x] After **Mark reviewed**, scorers call the `community-scores` function so community scores update straight away.
- [x] "Needs review" list, Runeblade and Shadow cards first. Account page with the sides preference.

**Done when:** a scorer can review a card from start to finish, and the community score updates.

### M6: Ranking (2–3 days)

- [x] Priorities editor (a weight for each dimension), source blend (signed in), side focus. All kept in the URL.
- [x] "Ranked by your priorities": variants ranked by the weighted average of their dimension scores; core size (top N marked Core), pin and exclude (with restore), minimum rating count, unreviewed cards left out; my reviewed scores count when community data is thin. The filter sidebar narrows the candidates.
- [x] Weapons and equipment ranked separately by slot (top 3 each).
- [x] Ranking redesign: priorities above the filters (play style, side and whose scores as presets with a fine-tune slider, core size stepper); a core summary (size, pinned, pitch mix, deck count); rows with the card image, a floor–overall–ceiling range bar and icon actions; a core cut-off line; tabs for deck cards, weapons and equipment, and excluded; cards open in the pop-over, stepping in ranked order; an empty state pointing to Needs review. The Mine / Blend / Community presets are 0, 50 and 100, for the scoring group to confirm.
- [x] Core builder ("Build a core" on the ranking): pitch targets (from the deck, or the example 18 red / 5 yellow / 22 blue, **unverified**), copies of each card, then the core filled from the ranking (`suggestCore`); edit by copies, lock, swap for the next best of the same pitch, or remove; add to the chosen deck or save as a new deck. Pinned cards and cards in the deck start locked. Mechanic minimums (e.g. at least 8 Runechant creators) are next.
- [x] Engine board (replaces the ranked table and the core builder panel): ranked cards laid out by engine, makers beside what uses them, from the card roles (docs/roles.md, unverified); card images; "fits N" badges and partner highlighting on hover; order by score or best fits first. A core tray (90% of the screen height, scrolling inside) holds the priorities (play style, side, whose scores), pitch against targets with fill to targets, each engine's balance with what's missing, copies, and saving to a deck. The core is kept in the URL. No filters on this page, only find a card.
- [x] Build tabs: the ranking page is "Build a core", with the core's count and pitch mix in a sticky header and three tabs (kept in the URL as `tab`). **Set up** is one form: how you want to play, preferences, pitch targets with fill, and strategy questions. **Board** is the engine board beside a slim core rail (cards, copies, saving). **Readings** has the engine balance; the traverse timeline, banished zone and packages are next.
- [x] Strategy questions (`strategy_questions`, `strategy_answers`): asked once per person, not per card. Each person answers 1–10 for themselves; `strategy_community_answers()` returns the scoring group's average (scorers, curators and admins) and never a single answer. Wording **unverified**, for the scoring group to confirm.
- [x] Scenarios, first slice (README "Scenarios", brought forward from phase two): `packages/engine` with a seeded shuffle, decks padded with blanks to the deck size, and scenario definitions validated against the scenario contract (versioned data; checked once at the horizon; success rate, by-turn breakdown, failures grouped by block). Eight built-in scenarios on the Readings tab, run together with **Run scenarios** in a Web Worker (10,000 runs each, seed shown, **New seed**), with a warning when the core has changed since the run. A separate Viserai traverse rule set draws the traverse timeline. Scenarios, thresholds and the rule set are **unverified**. Not yet: fixed cards, steps, saved scenarios, the condition builder.

**Done when:** changing a priority re-ranks instantly, and the ranking matches hand-calculated results for a test fixture.

### M7: Minimal deck builder (3–4 days)

- [x] Card pool and default loadout, sideboard flag, weapon and equipment slots. In phase one the default loadout is the main deck: every non-sideboard card, every copy.
- [x] Copy limits, plus format limits from configuration (`app_settings.format_classic_constructed`). **Unverified:** 3 copies per card and pitch, at least 60 deck cards, at most 80 in the pool, 2 hands for weapons and off-hand. Needs a player check.
- [x] Dimension totals and pitch breakdown, with "always available" (weapons and equipment) shown separately. Pitch targets per deck (e.g. 22 blue, 18 red, 5 yellow).
- [x] Add ranked cards to the deck. Cards already in the deck count as pinned.
- [x] Copy limits checked by the maintainer: one of each piece of equipment (15 Oct 2026); one of a two-handed weapon and two of a one-handed one, counted across the deck and sideboard (16 Oct 2026). A deck without a weapon isn't a legality problem; that's the builder's call.
- [x] Deck lists: public and private decks, My decks and Public decks tabs, New deck. Someone else's public deck opens read only, signed out too.
- [x] Add cards panel: a tile per pitch with + and SB on hover, a magnifying glass to enlarge, pages, search by name or keyword, and the filters pinned while the cards scroll.

**Done when:** a user can build a legal deck from the ranking or by hand and save it.

### M8: Journey pass and minimum polish (4–5 days)

Scorers are volunteers. If the app feels like a prototype they won't engage, and the ranking depends on their scores. So the app ships to them only once it meets a minimum polish bar, walked through journey by journey.

**Journeys,** in priority order:

1. **Scorer:** sign in → Needs review → score a card → Mark reviewed → next card.
2. **Builder:** priorities → ranked cards → add to a deck → fix legality problems → check the pitch mix.
3. **Browsing:** find a card → see what it does and its scores → filter and compare.
4. **First visit:** signed out → understand what the app is → sign up.

**Minimum polish bar,** for every screen in those journeys:

- [x] **No dead ends or placeholders.** A real home page explains the app and points to the next step. Every page has a way forward. _Home page (first visit, a scorer's reviews left, build a core); Needs review after a review (#59); a saved core links to its deck (#77); Create an account on the home page (#79)._
- [x] **Every state is designed:** loading, empty (with the next action), error (in plain words, with a retry) and saved (visible confirmation). _`Loading` and `LoadError` with Try again (#73); the deck page waits for the cards rather than showing an empty deck (#77); check-your-email after sign-up (#79)._
- [ ] **Consistent look:** one type scale, spacing scale and colour tokens. Pitch colours everywhere a pitch appears. Dark mode checked. _Pitch colours are global tokens with a guard test, and dark mode is checked on every journey (#80). Not yet: a shared type scale and spacing scale._
- [x] **Card images** on the card page and in the deck builder, moved forward from the backlog. Recognising cards by their art is what makes it feel like a FaB tool. Done: `variants.image_url` from the latest standard, normal-art printing; the stand-in shows when there is no image or it fails to load.
- [x] **Works on a phone** for scoring and browsing. Deck building can be desktop-first. _Account and Sign out stay in view (#74); the review dialog fills the screen and the card enlarges (#75). Checked at 320 and 375px._
- [x] **Fast scoring:** "Next card" after Mark reviewed, and sensible keyboard focus, so a scorer can work through a list without reaching for the mouse each time. _Each card opens on Overall; Ctrl/⌘+Enter, then Enter, reviews and moves on (#72)._
- [ ] **Accessible:** keyboard reachable, visible focus, labelled controls (mostly true already, because the tests query by role and name). _Focus fixes in scoring, labelled card symbols (#78). Not yet: a full keyboard and screen-reader pass._

**First pass done (16 Oct 2026):** Claude walked all four journeys at desktop and phone widths and fixed what it found (#72–#80). Also from the walk: Needs review runs newest release first, generics last (#76); each card shows the scoring group's ratings (#78). Next: the maintainer's walk, and the "done when" check below.

**How:** Claude walks each journey in the browser at desktop and phone widths and lists the friction. The maintainer walks the same journeys and adds to the list. Fixes land as small test-first PRs. A second pass follows after the scoring group has used the app for a week or two.

**Done when:** a new scorer can review 10 cards without asking how, and the maintainer would be happy to show the app to the scoring group.

### Scoring model change (15 Oct 2026)

Agreed with the maintainer before scoring started: three ratings (**floor, ceiling, overall**) replace the six draft dimensions, and one **risk** setting replaces per-dimension priorities. See README "Floor, ceiling and overall" and "Suggested core". This changes M3 (resolution: a blank floor or ceiling resolves as overall) and M6 (ranking by risk tilt). Old scores, reviews and community scores were dropped, not migrated.

Open for the scoring group:

- [ ] The slider wording for floor, ceiling and overall.
- [ ] Risk preset values (Consistent −0.5, Balanced 0, High-roll 0.5).
- [ ] Whether to show the floor–ceiling spread only above a rating-count threshold.
- [x] Check the `hasConditions` rule: which cards get floor and ceiling. Checked by the maintainer, 15 Oct 2026.

Later (not in the first change): roles and role ranges as deck targets, payoff attributes, deck mechanic totals from attribute counts (the deck page shows average ratings as a stopgap), enables traverse as a synergy edge.

## Cut line

If time runs out, ship in this order and stop where the budget ends. Never cut the scoring model; cut interface features instead.

1. M0–M3, the foundations. Can't be cut.
2. M5 scoring UI
3. M6 ranking
4. M8 minimum polish for the scorer journey. Below this bar the scoring group won't engage, so it ships before the deck builder is complete.
5. M7 deck builder, plus M8 for the builder journey
6. Polish beyond the bar: component library breadth, preferences, image view toggles

## Backlog (after phase one's loop works)

- **Card image view:** a List / Images toggle on card lists. Images on the card page and in the deck builder move forward into M8. Needs `variants.image_url` (the dataset links to Legend Story's public images; pick the standard, non-foil, normal edition, latest printing) and a re-import. Most useful in the deck builder.

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
- Merging to `main` applies migrations to the hosted project: every migration up to `20261016100000` was there on 16 Oct 2026 without a manual push. Branching (preview databases per pull request) needs the Pro plan, so it isn't available.
- Develop and test migrations against the local Supabase stack. After a migration that the importer fills (such as `first_set` and `first_released`), re-run the import against the hosted project with `DB_URL` set and `--yes-remote`.
- Before hosting the app: set the Site URL and redirect URLs (Authentication → URL Configuration) so sign-up confirmation emails open the app.
