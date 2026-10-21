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

`go test ./...` runs the tests.

## The daily ingest

At 10:00 UTC each day, EventBridge Scheduler runs the Lambda `vdb-fablazing-ingest` in eu-west-1. For formats 0 and 1 it:

1. skips the format if that day is already in S3, so a day is never fetched from FaBlazing twice
2. asks the FaBlazing API for yesterday's file (UTC), with the key from SSM, and downloads it
3. parses it with `game.ReadAll`, which keeps the latest copy of each guid
4. keeps every game with Viserai on either side, with both sides
5. writes those games' raw CSV rows, every column as text, as gzipped NDJSON to `s3://vdb-fablazing-raw-<account>/raw/date=YYYY-MM-DD/format=N.ndjson.gz`
6. logs counts only: rows, games, kept games and Viserai sides

The rows are stored raw so that a parser change can rebuild everything without downloading again. They include the hashed player names, which are only for capping one player's weight and are never shown. The bucket is private.

**Writing aggregates to Supabase** plugs in at `ingest.Aggregator`, which receives each day and format's kept games after they're stored. It isn't wired up yet.

**There are no automatic retries.** An error emails the alarm address. To rerun a day, invoke the function with a date; formats already stored are skipped:

```bash
aws lambda invoke --profile vdb --region eu-west-1 --function-name vdb-fablazing-ingest --invocation-type Event --cli-binary-format raw-in-base64-out --payload '{"date":"2026-10-20"}' /dev/null
```

A date that hasn't ended in UTC is refused, because it isn't final.

## AWS

There are two CloudFormation stacks, both in eu-west-1:

- **`vdb-fablazing-bootstrap`** ([infra/bootstrap.yaml](infra/bootstrap.yaml)) is deployed by hand by the maintainer. It holds GitHub's OIDC provider, the deploy role for GitHub Actions, the role CloudFormation deploys as, a permissions boundary for every role the app stack creates, the build artifacts bucket and the alarm email topic.
- **`vdb-fablazing`** ([template.yaml](template.yaml), AWS SAM) is the app: the raw bucket, the function, the schedule and the alarm. GitHub Actions deploys it on every merge to main that touches `services/fablazing` ([deploy-fablazing.yml](../../.github/workflows/deploy-fablazing.yml)).

GitHub can only change `vdb-fablazing`. It does that through CloudFormation's role, which can manage only resources named `vdb-fablazing-*`, and every role it creates carries the boundary. Changing the bootstrap stack needs the maintainer.

**Secrets** are SSM SecureStrings, created by the maintainer and never in the repo:

- `/vdb/fablazing/api-key`: the FaBlazing API key
- `/vdb/fablazing/db-password`: reserved for the Supabase `fablazing_ingest` role

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

3. Set the repository variable `AWS_DEPLOY_ROLE_ARN` to the bootstrap stack's `DeployRoleArn` output. Until it's set, the deploy workflow is skipped.

4. Deploy the app stack once by hand, from `services/fablazing`, the same way GitHub Actions does:

   ```bash
   sam build && sam deploy --profile vdb --s3-bucket vdb-fablazing-artifacts-<account> --s3-prefix vdb-fablazing --role-arn arn:aws:iam::<account>:role/vdb-fablazing-cfn-exec
   ```
