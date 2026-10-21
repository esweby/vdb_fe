# services/fablazing

The FaBlazing data pipeline in Go. The plan is [docs/fablazing-plan.md](../../docs/fablazing-plan.md), and the data is described in [docs/fablazing-data-dictionary.md](../../docs/fablazing-data-dictionary.md).

| Package             | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `pyliteral`         | parses FaBlazing's Python literal text, and JSON too                   |
| `game`              | reads a day's CSV into games and player-sides                          |
| `chain`, `measure`  | chain specs, matching and measurement                                  |
| `ingest`            | fetches a final day, keeps the Viserai games, stores their raw records |
| `cmd/fablazing`     | the local CLI                                                          |
| `cmd/ingest-lambda` | the daily AWS Lambda around `ingest`                                   |

`go test ./...` runs the tests. Supabase is a fake in them. To also call the real `fablazing_replace_day` against the local stack (`supabase start`), inside a transaction that's rolled back, set `FABLAZING_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres`. If the local database doesn't have the fablazing migration yet, add `FABLAZING_TEST_MIGRATION=<path to it>` too. The test refuses any host that isn't local.

## The daily ingest

At 10:00 UTC each day, EventBridge Scheduler runs the Lambda `vdb-fablazing-ingest` in eu-west-1. For formats 0 and 1 it:

1. skips the format if that day is already in S3, so a stored day is never fetched from FaBlazing again
2. asks the FaBlazing API for yesterday's file (UTC), with the key from SSM, and downloads it
3. parses it with `game.ReadAll`, which keeps the latest copy of each guid
4. aggregates every game (`aggregate.Run`, with the player cap of 20 and the provisional concession rule) and writes the day to Supabase with `fablazing_replace_day`, as the `fablazing_ingest` role. Matchups and the run summary cover every game, so the aggregator gets them all, not only Viserai's
5. keeps every game with Viserai on either side, with both sides, and writes their raw CSV rows, every column as text, as gzipped NDJSON to `s3://vdb-fablazing-raw-<account>/raw/date=YYYY-MM-DD/format=N.ndjson.gz`
6. logs counts only: rows, games, kept games, Viserai sides and rows written. Never a player hash or the payload

The rows are stored raw so that a parser change can rebuild everything without downloading again. They include the hashed player names, which are only for capping one player's weight and are never shown. The bucket is private.

**Supabase comes before S3.** A day is stored in S3 only once its aggregates are written, so a failed write leaves nothing for a rerun to skip. Replacing a day is idempotent, so writing it twice is harmless. The raw records hold only Viserai's games, so they can't rebuild the matchups: a day whose write failed has to be fetched again.

**There are no automatic retries.** An error emails the alarm address. To rerun a day, invoke the function with a date; formats already stored are skipped:

```bash
aws lambda invoke --profile vdb --region eu-west-1 --function-name vdb-fablazing-ingest --invocation-type Event --cli-binary-format raw-in-base64-out --payload '{"date":"2026-10-20"}' /dev/null
```

A date that hasn't ended in UTC is refused, because it isn't final.

## AWS

There are three CloudFormation stacks, all in eu-west-1. Two are the pipeline:

- **`vdb-fablazing-bootstrap`** ([infra/bootstrap.yaml](infra/bootstrap.yaml)) is deployed by hand by the maintainer. It holds GitHub's OIDC provider, the deploy role for GitHub Actions, the role CloudFormation deploys as, a permissions boundary for every role the app stack creates, the build artifacts bucket and the alarm email topic.
- **`vdb-fablazing`** ([template.yaml](template.yaml), AWS SAM) is the app: the raw bucket, the function, the schedule and the alarm. GitHub Actions deploys it on every merge to main that touches `services/fablazing` ([deploy-fablazing.yml](../../.github/workflows/deploy-fablazing.yml)).

GitHub can only change `vdb-fablazing`. It does that through CloudFormation's role, which can manage only resources named `vdb-fablazing-*`, and every role it creates carries the boundary. Changing the bootstrap stack needs the maintainer.

The third, **`vdb-maintainer`** ([infra/maintainer.yaml](infra/maintainer.yaml)), is the maintainer's own access. See [The maintainer's access](#the-maintainers-access).

**Secrets** are SSM SecureStrings, created by the maintainer and never in the repo:

- `/vdb/fablazing/api-key`: the FaBlazing API key
- `/vdb/fablazing/db-url`: the Postgres URL for the Supabase `fablazing_ingest` role, password included. It goes through Supavisor's session pooler, because the direct database host is IPv6 only and a Lambda outside a VPC has no IPv6

Everything stays within the free tier: one short run a day, a few MB a month in S3, standard SSM parameters, one alarm and SSE-S3 encryption (no KMS key).

### First-time setup

The maintainer runs these with the `vdb` profile (`aws login --profile vdb` first).

1. Deploy the bootstrap stack, then confirm the subscription email:

   ```bash
   aws cloudformation deploy --profile vdb --region eu-west-1 --stack-name vdb-fablazing-bootstrap --template-file services/fablazing/infra/bootstrap.yaml --capabilities CAPABILITY_NAMED_IAM --parameter-overrides AlarmEmail=you@example.com
   ```

2. Store the API key without it reaching the shell history or the repo:

   ```bash
   (source ~/.config/vdb/fablazing.env && aws ssm put-parameter --profile vdb --region eu-west-1 --name /vdb/fablazing/api-key --type SecureString --value "$FUNCTION_API_KEY")
   ```

3. Once the fablazing migration is in the hosted project, give `fablazing_ingest` a password (SQL editor: `alter role fablazing_ingest with password '…'`), then store its pooler URL. The host is under Connect → Session pooler in the dashboard, and the user is `fablazing_ingest.<project ref>`. Put `DB_URL='postgres://fablazing_ingest.gmqdtqgkqygepsbrgomk:<password>@<pooler host>:5432/postgres?sslmode=require'` in `~/.config/vdb/fablazing.env`, then:

   ```bash
   (source ~/.config/vdb/fablazing.env && aws ssm put-parameter --profile vdb --region eu-west-1 --name /vdb/fablazing/db-url --type SecureString --value "$DB_URL")
   ```

   The Lambda fails without it, so store it before a deploy that includes the Supabase writer.

4. Set the repository variable `AWS_DEPLOY_ROLE_ARN` to the bootstrap stack's `DeployRoleArn` output. Until it's set, the deploy workflow is skipped.

5. Deploy the app stack once by hand, from `services/fablazing`, the same way GitHub Actions does:

   ```bash
   sam build && sam deploy --profile vdb --s3-bucket vdb-fablazing-artifacts-<account> --s3-prefix vdb-fablazing --role-arn arn:aws:iam::<account>:role/vdb-fablazing-cfn-exec
   ```

### The maintainer's access

The maintainer's IAM user, `viserai.decks`, is in the group `vdb-maintainers` and not in `admins`. Day to day it can:

- invoke and read `vdb-fablazing-*` functions, read and tail their logs, and see the alarm, metrics and schedule
- read the raw records in `vdb-fablazing-raw-*` (but not change them)
- get and put the secrets under `/vdb/fablazing/`
- read every stack, and deploy the app stack with `sam deploy` through `vdb-fablazing-cfn-exec`, as GitHub does
- see billing, budgets and free tier usage
- list and describe everything in the console (AWS's `ViewOnlyAccess`), without reading contents
- sign in with `aws login`, and change its own password and MFA

It can't change IAM, the bootstrap stack, or anything outside the pipeline. For that, switch to **`vdb-admin`**, a role with `AdministratorAccess` that only `viserai.decks` can assume, only when signed in with MFA, for at most an hour:

- **Console:** the `SwitchRoleUrl` output of `vdb-maintainer`, or account `495599764170`, role `vdb-admin`. CloudShell in that session runs as the admin role.
- **CLI:** add a profile, then pass `--profile vdb-admin`. The MFA is a passkey, which the CLI can't prompt for, so this works only if the `aws login` session counts as signed in with MFA. If it's refused, use CloudShell.

  ```ini
  [profile vdb-admin]
  role_arn = arn:aws:iam::495599764170:role/vdb-admin
  source_profile = vdb
  region = eu-west-1
  ```

The root user (with MFA) stays the last resort.

`vdb-maintainer` is deployed by hand, as the admin role, after any change to it:

```bash
aws cloudformation deploy --profile vdb-admin --region eu-west-1 --stack-name vdb-maintainer --template-file services/fablazing/infra/maintainer.yaml --capabilities CAPABILITY_NAMED_IAM
```

Before deploying a change, check the policy against what day-to-day work needs. It runs IAM's policy simulator on the template and changes nothing. It needs PyYAML:

```bash
python3 services/fablazing/infra/check_maintainer_policy.py
```

If something day to day is refused, switch to `vdb-admin`, do it, and add what's missing to `MaintainerPolicy` and a case to the check.
