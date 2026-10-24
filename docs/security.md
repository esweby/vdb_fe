# Sign-in and community updates

These notes describe the implemented controls. Database grants and row level security enforce access; browser checks improve the experience but do not replace them.

## Sign-in

The sign-in form allows one pending submission. Its submit button and account-mode switch stay disabled until the request finishes. A synchronous guard also rejects repeated form submissions before React renders the disabled button.

Username sign-in goes through the `username-sign-in` Edge Function. Before looking up the account or checking the password, it calls `reserve_sign_in_attempt`. The database locks the account and address counters and reserves an attempt atomically:

- Five attempts per account in 15 minutes, ignoring username case.
- Thirty attempts per address in 15 minutes, shared across accounts.
- Successful sign-ins consume an attempt too.

The address comes from the gateway's forwarded header. The independent account limit still applies if that address changes. Email sign-in continues through Supabase Auth and its own limits.

An exhausted allowance returns HTTP 429. If the reservation cannot be checked, username sign-in returns HTTP 503 rather than proceeding without the limit. Old counters are removed in bounded batches during accepted reservations; there is no cleanup worker. `sign_in_limits` and its reservation function are server-only. The older `sign_in_failures` table is retained, but the function no longer writes failures there.

Source: [sign-in function](../supabase/functions/username-sign-in/signIn.ts), [database limits](../supabase/migrations/20261024010000_sign_in_limits.sql).

## Saving scores and requesting an update

Scores and reviews save immediately. Only the request to refresh the scoring group's averages is delayed. There is no queue of unsaved scores.

One `CommunityRecalculationProvider` sits above the routes and card popovers. Scorers, curators and admins can schedule an update after a successful change that affects a reviewed card: marking it reviewed, editing or clearing a reviewed score, or removing its review. Failed saves and edits to cards that remain unreviewed do not schedule one.

Each qualifying save restarts a 30-second browser timer. Finishing or leaving Quick review waits for its existing save chain, then requests an update sooner. Navigation preserves the provider's timer. Sign-out or an account change discards it and prevents old save callbacks from scheduling work for the new account.

Only one request runs at a time. A change made during a request stays pending for the next update; an older response cannot clear it. This includes Undo after a flush has started.

A server refusal returns `status: "deferred"`, a reason and `retryAfter` in seconds. The browser keeps the update pending and schedules one trailing retry after that delay plus a one-second margin. A cooldown refusal uses the remaining cooldown. A running-job refusal uses the greater of 30 seconds and the remaining cooldown, not the remaining lock lifetime.

A second refusal or a network failure leaves a manual Retry update action. There is no automatic retry loop. Closing the tab can lose a pending recalculation request, but does not discard scores whose saves have completed. Synergy edits do not schedule updates through this hook; they rely on the daily runs.

Source: [countdown](../apps/web/src/scoring/communityRecalculation.ts), [shared provider](../apps/web/src/scoring/CommunityRecalculationProvider.tsx).

## Protecting the community job

The `community-scores` Edge Function verifies the caller before acquiring the shared database gate. Ordinary authenticated callers need a scoring role. A successfully consumed single-use job nonce identifies a scheduled invocation; a request field cannot claim that status.

The gate allows at most one user-triggered start per 30 seconds across the app. Every admitted run receives a unique token and a 60-second lease. While that lease is live, another run is refused before reading the aggregate inputs. Refused requests do not extend either deadline. The browser timer reduces normal requests; the server gate also protects against someone calling the endpoint directly.

Both `replace_community_scores` and `replace_community_synergies` require that token. Each locks the gate row, checks that the token is current and unexpired, and holds the row lock through its replacement transaction. Acquisition locks the same row, preventing a new owner from slipping between the check and the write. An old owner cannot publish after replacement or release a newer owner's lease. Scores and synergies remain separate replacement transactions.

The lease was selected from a successful hosted daily invocation on 24 October 2026: **12.218 seconds**, with a **60-second** allowance. This is one observation, not a worst-case guarantee. Review the duration logs as the dataset grows. A run whose lease expires before a publication check is refused rather than bypassing the guard. A crashed worker's lease expires without a heartbeat or recovery worker.

Two fixed pg_cron jobs invoke the existing fresh-nonce wrapper at **03:00 and 03:15 UTC**. Scheduled calls bypass the cooldown but respect a live lease. The second runs regardless of whether the first succeeded. There are no temporary cron entries or polling jobs. Exceptional collisions or outages can still delay the averages; another admitted run will recompute everyone's saved data.

`community_job_gate`, acquisition and release are server-only. Logs record refusal reasons, retry delays, request IDs and durations, without tokens or score payloads. Shared contention is accepted: one scorer can occupy successive allowed runs, but each run reads everyone's data and the gate bounds expensive starts.

Source: [job entry point](../supabase/functions/community-scores/index.ts), [gate and guarded writes](../supabase/migrations/20261024020000_community_job_gate.sql).

## Verification and maintenance

The sign-in, gate and browser behaviour have Vitest and pgTAP coverage. The gate was also checked with concurrent requests and a competing publication transaction. Go CI runs tests, vet and the pinned official vulnerability scanner; dependency versions are recorded in `services/fablazing/go.mod` and `go.sum`.

For a delayed community update, first confirm the score save succeeded. Then inspect `community-scores` invocations and logs for a refusal, failure or long duration. A browser Retry update action is safe; it does not resubmit scores. Preserve the gate when diagnosing a failure. Hosted operations and database resets follow the working agreement in [AGENTS.md](../AGENTS.md).
