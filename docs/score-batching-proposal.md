# Batched score saves

Proposal, 24 October 2026. This is not implemented.

Keep score changes in memory and send them to Supabase after **30 seconds with no new score changes**. Every new change restarts the timer. The maintainer accepts that closing or reloading the tab can lose unsent scores. No polling, extra service or new paid infrastructure is needed.

## What happens today

The card scoring page saves each edit separately. Quick review also saves scores separately, but requests community recalculation only every ten cards and when the session finishes or the player leaves. Marking a card reviewed on its scoring page requests a recalculation once. Ordinary score edits do not each run that job.

This proposal batches the score writes and requests one community recalculation after a successful batch. It does not add a global server countdown.

## The hook

Add `useScoreBatch`, backed by one provider mounted inside the signed-in app and above its routes. Pages and card popovers share that provider. Calling an independent hook with its own queue in every editor would create several timers and could discard changes during navigation.

The hook exposes:

- `setScore(cardId, key, score)` to queue a score.
- `clearScore(cardId, key)` to queue removal of an override.
- `markReviewed(cardId)` and `unmarkReviewed(cardId)` to queue review changes.
- The pending edits, so a card opened again can show its latest local scores.
- A save status: nothing pending, waiting, saving or failed, with a retry action after failure.

The queue belongs to one signed-in user. It is cleared on sign-out or an account change, so edits cannot be sent using another person's session. It is not written to local storage.

## The countdown

For every score change:

1. Update the score on screen immediately and replace the matching queued edit.
2. Cancel the existing timeout.
3. Start one new 30-second timeout.
4. When it expires, submit the queued batch.

A score is identified by card, variant, side and dimension. If the same score changes three times, only its final value is submitted. A clear replaces a pending set, and a set replaces a pending clear. Review changes use the same timer; otherwise a final review action could remain unsent without a score edit to start it.

There is no maximum waiting time: continuous editing keeps postponing the save. Moving between pages preserves the queue and countdown. Closing or reloading the tab, or signing out before submission, may lose the queue. Do not add unload requests or background workers to try to save it.

## Saving a batch

Use a repository method such as `saveScoreBatch(changes)` and one small database function to apply the score edits and review changes in a transaction. Supabase supports array upserts for sets, but mixed sets, clears and reviews need a transaction to avoid recording a review before its scores. The function runs with the caller's privileges and existing row level security, uses `auth.uid()` for ownership, and validates the payload. It cannot accept another user's ID as authority.

Save the scores first and then their review state in that transaction. This preserves the existing meaning of Mark reviewed, including Quick review and Undo. A queued review must not appear as saved until the batch succeeds. The batch does not change which scores count in community averages.

Allow one batch request at a time. Take a snapshot of pending changes when a request starts. Edits made while it is saving remain queued; the old response must never clear or replace those newer edits. Their timer is measured from the latest edit. If it has already expired when the current request finishes, send the next batch then.

After a failed save, keep the pending changes and show a Retry action. Retry sends the latest values, including edits made since the failed request. Do not retry continuously in the background. A subsequent edit can also start a fresh 30-second countdown. Sets, clears and review updates must be safe to retry after an uncertain network result.

Once a batch is saved, request community recalculation once. Remove the per-card and every-ten-cards recalculation calls from the UI so they cannot run before queued scores are saved. If recalculation fails, the scores remain saved and the existing daily job catches up. Do not describe a saved batch as lost because recalculation failed.

Batching alone does not prevent someone calling the recalculation endpoint directly. A separate, small server cooldown is still needed for that security issue. It requires no polling worker.

## Player feedback

Use a small shared status near scoring: “Changes waiting to save”, “Saving…”, or “Couldn't save. Retry”. Explain once that changes save after 30 seconds without edits and unsaved changes can be lost when the tab closes. Keep optimistic scores visible after a failure, with their pending status.

## Tests before implementation

- No request at 29 seconds; one batch at 30 seconds.
- A new edit at 20 seconds moves submission to 50 seconds.
- Several edits to one score submit only its final value; other scores are retained.
- Clears and review changes are applied with the scores; a failed transaction saves none of them.
- Navigation and popovers share one queue and timer.
- Edits made while a request is pending survive its response and save in a later batch. Requests never overlap.
- Failure retains pending changes; retry uses the latest values and cannot apply an older failed edit over a newer one.
- Sign-out or account change discards the old user's queue and cancels its timer. An old in-flight result cannot alter the new user's queue.
- Community recalculation is requested once per successful batch, after persistence. Its failure does not undo the saved scores.
- The database function cannot change anyone else's scores or reviews. New database objects follow the repository's grants, privilege tests and row level security checklist.

Use fake timers for hook tests. Keep database transaction and ownership checks in pgTAP. This proposal leaves the existing daily community job in place and does not change any game rules.
