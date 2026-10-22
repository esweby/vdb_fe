# Working agreement for coding agents

This file is for agents other than Claude Code (Codex and the like). Claude Code reads [CLAUDE.md](CLAUDE.md); the rules are the same.

The design is in [README.md](README.md). The current plan is [docs/test-loop.md](docs/test-loop.md), and the game-logic decisions made so far are in [docs/phase-two.md](docs/phase-two.md).

## The project

A deck analysis site for Flesh and Blood, focused on Viserai. A React app (`apps/web`) on Supabase (`supabase/`), with TypeScript packages for cards, scoring, the rules engine and the importer (`packages/`), and a Go pipeline for FaBlazing game data (`services/fablazing`). One maintainer, who plays the game and owns the game logic.

## Git

- Never commit or push to `main`. Work on a branch and merge through a pull request once CI passes.
- When every CI check passes on a PR you opened, ask the maintainer whether to merge it. Merge only after they confirm.
- Other sessions share the main checkout. Do branch work in its own worktree (`git worktree add ../vdb_fe-<topic> -b <branch> origin/main`), never switch branches in the shared folder, and never `git add -A` there.
- One branch and one pull request per piece of work. Keep a pull request to one change.

## Test first

- Write a failing test before writing the code that makes it pass. This applies to every change in behaviour: scoring rules, importer mapping, migrations, row level security and UI logic.
- Run the new test and confirm it fails for the expected reason (an assertion, not a syntax or import error) before writing the code.
- A rule in the README isn't implemented until a test covers it.
- Bug fixes start with a test that reproduces the bug.

## Commands

Run these from the repo root before opening a pull request. CI runs the same, plus `npm run build -w @vdb/web`.

- `npm run format:check` (Prettier; `npm run format` fixes it)
- `npm run typecheck`
- `npm test` (Vitest). One file: `npx vitest run path/to/file.test.ts`
- `supabase test db` (pgTAP, needs `supabase start`)
- `go test ./...`, `go vet ./...` and `gofmt -l .` in `services/fablazing`

Don't run `supabase db reset` without asking: it wipes the maintainer's local decks, and the cards need re-importing after it. Don't run anything with `--yes-remote` or against the hosted project: the maintainer does that.

## Database

Hosted Supabase doesn't grant table access to `anon` or `authenticated` by default, and local is set up to match. Check every new or changed migration against this list before opening a pull request:

1. **Grants.** Every new table needs `grant` statements in the same migration for each role that should reach it. A table only the server uses may grant nothing, but say so in a comment. New functions called by roles need `grant execute`.
2. **Privileges test.** Every new table needs an entry in `supabase/tests/06_privileges.test.sql` for both `anon` and `authenticated` (`table_privs_are`), matching the grants. Raise `select plan(N)` by the right amount: a `from unnest(array[...])` row counts one test per table.
3. **Row level security.** A table `anon` or `authenticated` can reach needs `enable row level security` and policies.
4. **Behaviour test.** New constraints, policies, triggers and functions need a pgTAP test in `supabase/tests`.
5. **Column grants** (`grant update (col) on ...`) must be intentional. List them in the pull request.

Merging to `main` applies the migrations to the hosted database and redeploys the Edge Functions. There is no manual deploy step.

## Game logic

- Flesh and Blood rules, card interactions and synergy rules are checked by the maintainer. Anything you draft without that check is marked **unverified**, in the code comment and in the pull request.
- Don't change a decision recorded in `docs/phase-two.md` or the other docs. Ask.
- Deck rules: one of each piece of equipment; weapons one (two-handed) or two (one-handed) across the deck and sideboard; a deck with no weapon is fine.

## Style

- **Desktop first.** Design for wide screens, then stack on narrow ones.
- **Docs and UI text:** plain British English, short sentences, no jargon a player wouldn't use. Match the existing docs.
- **Code:** match the surrounding code's naming, comment density and idiom.

## This week's work

From [docs/test-loop.md](docs/test-loop.md), in this order. Ask before starting anything not on this list.

1. **Parse Talishar's stats CSV** into a typed game record: the summary, game statistics, card play stats (card name and pitch read from `"Cull (1)"`), card activated stats and the turn-by-turn table. Pure TypeScript with Vitest tests, no database or UI. The format isn't documented and can change, so the tests use real exports, starting with the maintainer's game of 22 Oct 2026, and the parser rejects a file it doesn't recognise rather than guessing.
2. **A report for one game,** from the parsed record: life by turn, cards blocked by turn, life lost to yourself as a share of the total, damage dealt by turn. Each figure is labelled Observed, Assumed or Extrapolated (see the plan). Our card data has no hero life yet, so the report takes starting life as an input; ask the maintainer for Viserai's.
3. **Deck versions** (a migration): opening a deck in FaBrary saves its list as a version. Follow the database checklist above.

Uploading a CSV onto a version, the deck's plan and comparing versions come after these, once the maintainer has reviewed them.
