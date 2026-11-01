# RAM-04 persisted pilot-gate evidence

Base: `5edabb814b273d5798ccd6869f50040d49fad945`.

The readiness page combines automatic configuration and monitoring checks with
`pilotGateSummary`. That summary previously returned ready for an empty list,
any all-verified subset, or repeated copies of the same verified gate. It now
requires every existing canonical gate exactly once, with no unknown, missing
or duplicate key. Counts still describe supplied records; incomplete inventory
cannot certify launch readiness.

Read-time status now requires an accountable owner ID, verifier ID, meaningful
bounded evidence, and a valid verification timestamp no later than the evaluation
clock. A missing or malformed record stays pending. An invalid or elapsed review
deadline is expired. The existing optional no-expiry setting remains supported.
These are structural evidence checks, not proof that the reported institutional
work happened or an independent verification of anyone's identity.

The write service validates meaningful trimmed evidence and reset reasons even
when called without HTTP schema parsing. Previously whitespace satisfied the
transport's untrimmed minimum length and the service stored an empty string.
Validation uses fixed errors without echoing input. The original admin capability,
PostgreSQL requirement, active RAM owner membership, future review-date checks,
transaction, audit insertion and reset-clearing behavior remain in place. No
existing gate, live verification, credential, permission, schedule or database
migration is changed. No institutional or operational approval is issued.

## Verification

Thirty-one pure evidence/summary cases and fourteen service orchestration cases
pass locally, forty-five total with no skips. Six of the fourteen service cases
fail when the exact original server source is substituted, and eight pass. The
original source was copied from its immutable snapshot and checked against its
Git blob hash before the baseline run.

The service tests transpile the actual service and supply explicit authorization,
read-only record and transaction fixtures. They cover access denial before DB
access, blank evidence and reset rejection before a transaction, active owner
selection, audit failure propagation with no staged fixture commit, reset clearing,
prototype mode and read-time status. These are not real Prisma/PostgreSQL isolation
or HTTP tests. The pure module and tests pass focused strict TypeScript compilation.
Local execution uses Node 22.16.0 and TypeScript 5.8.3 with scrubbed environment.
The existing project test glob includes both new suites. Full current-head CI,
real persisted gate lifecycle and operational pilot acceptance remain separate
required evidence; an earlier green head does not validate this commit.
