# Working agreement

The design is in [README.md](README.md), and the current plan is in [docs/phase-one.md](docs/phase-one.md).

## Git

- Never commit or push to `main`. Work on a branch and merge through a pull request once CI passes.
- When every CI check passes on a PR Claude opened, Claude asks the maintainer whether to merge it. It merges only after they confirm.

## Test first

- Write a failing test before writing the code that makes it pass. This applies to every change in behaviour: scoring rules, importer mapping, migrations, row level security and UI logic.
- Unit tests use Vitest (`npm test`). Database tests (schema, constraints, row level security) use pgTAP in `supabase/tests` (`supabase test db`).
- A rule in the README ("Reviews and blank scores", fringe default, scenario contract and so on) isn't implemented until a test covers it.
- Bug fixes start with a test that reproduces the bug.

## Database

- Hosted Supabase doesn't grant table access to `anon` or `authenticated` by default, and local is set up to match. Every new table needs explicit `grant` statements in its migration, and an entry in `supabase/tests/06_privileges.test.sql`.

## Game logic

- Flesh and Blood rules, card interactions and synergy rules are checked by the maintainer or an experienced player. Anything drafted without that check is marked unverified.

## Commands

- `npm test`: unit tests
- `npm run typecheck`: TypeScript
- `supabase start` / `supabase test db`: local stack and database tests

## Agents

Use these without being asked. They run on a cheaper model and keep long output out of the main conversation.

- `test-runner` (`.claude/agents/test-runner.md`): run the checks through it instead of running them directly. Use it to confirm a new test fails before writing the code for it, and again after the change.
- `migration-checker` (`.claude/agents/migration-checker.md`): run it on any change to `supabase/migrations` before opening a PR.
