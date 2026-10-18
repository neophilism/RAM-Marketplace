# RAM-05 scale-readiness contract

Status: PLANNED, not production certified. The roadmap's Phase 4 requires versioned rule authoring, multiple jurisdiction controls, enterprise SSO/API, supplier batch feeds, and evaluated matching v2. No new jurisdiction or participant gains access by creating this document.

## Expansion invariants
- New species, phenotype, disease condition and transport corridor are denied by default until signed jurisdictional/veterinary rules and institutional acceptance are versioned and published.
- Every rule records effective dates, author, authority, exact source citation, superseded revision, explicit prohibitions and staged activation; active transactions stay bound to the version assessed on their immutable clearance event.
- Batch/API writes authenticate organization, actor and specific scope. Each submitted record uses per-organization idempotency, schema validation, quotas and quarantine; partial import failure never publishes or acquires an unverified animal.
- Enterprise identity remains organizationally tenant-scoped; SSO assertions may not silently grant RAM compliance, finance or superadmin powers. Revocation propagates to pending jobs and future reads.
- Matching v2 must retain v1 as the controlled baseline. Use frozen synthetic evaluation fixtures with blinded source fields, eligibility and welfare hard constraints, reproducible rankings, fairness/latency reports, and rollback-on-regression.
- Payment, supplier cull pricing, animal welfare, custody and buyer/source confidentiality never change in a scale upgrade.

## Testable staged rollout
1. Shadow new rule versions and v2 matching on synthetic/consented data; compare hard-block decisions against v1. A permissive discrepancy fails rollout.
2. Exercise tenant cross-access, stale rules, batch retries, schema evolution, revoked SSO sessions and race conditions in transaction/concurrency tests.
3. Record per-corridor legal and veterinary signoffs, operational drill results and incident alert ownership. Keep unauthorised corridors inaccessible.
4. Re-run isolated migration/restore, exact-head CI, full multi-role staging journeys and rollback rehearsals. Confirm actual deployed image and database version match the approved release.
5. Activate one corridor and one organization at a time only after verified owner authority, provider access and documented readiness. No self-activation of live animals or payments.

## Evidence ledger
For each gate retain gateId, sourceSha, environment, actor/approver, effective jurisdiction, signed authority reference, test command, exact CI/report URL, result, expiry and rollback action. Unknown is NOT_VERIFIED, not PASS. Synthetic model tests do not establish governmental approval, veterinary suitability or a live financial provider.
