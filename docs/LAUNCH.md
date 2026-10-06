# RAM pilot launch and release rehearsal

## Purpose

This is the final operational path from a green repository to an authorized RAM pilot.

A passing CI build is necessary but not sufficient. The deployed environment must also pass the application's automatic readiness checks, the deployed smoke rehearsal, and every persisted manual pilot gate.

## Release sequence

Use one immutable application revision for staging rehearsal and pilot production.

1. Deploy the reviewed revision to the staging environment with production-equivalent PostgreSQL, identity, payment and monitoring configuration.
2. Apply committed migrations with `npm run db:migrate:deploy`.
3. Require clean migration status and drift checks:
   - `npm run db:migrate:status`
   - `npm run db:migrate:drift`
4. Run `npm run pilot:check` inside the deployed environment.
5. Run the deployed smoke rehearsal from a trusted operator machine or release runner:
   - `RAM_PILOT_BASE_URL=https://<deployment> RAM_MONITORING_RUN_TOKEN=<token> npx tsx scripts/pilot-smoke.ts`
6. Confirm a successful monitoring heartbeat and signed alert delivery in `/ops/monitoring`.
7. Complete every persisted manual gate in `/ops/pilot` with an accountable owner, evidence, verifier and review date where appropriate.
8. Exercise the provider-specific identity and payment procedures described below.
9. Perform a backup and restore exercise against a separate recovery database.
10. Promote the exact reviewed revision to the pilot production environment.
11. Repeat steps 2-8 against pilot production before admitting a real transaction.

Do not substitute a newly rebuilt or modified revision between staging rehearsal and pilot production without restarting the release sequence.

## Deployed smoke rehearsal

`scripts/pilot-smoke.ts` performs actual network calls against the intended deployment.

It verifies:

- `GET /api/health/live` returns the expected liveness result;
- `GET /api/health/ready` confirms the application can reach PostgreSQL;
- `POST /api/monitoring/run` accepts the configured scheduler bearer token and completes a real monitoring cycle.

Production rehearsal requires HTTPS.

HTTP is allowed only for an explicit loopback rehearsal with:

`RAM_PILOT_ALLOW_INSECURE_LOCAL=true`

The loopback exception is for local testing only and is not a pilot-production configuration.

## Identity provider validation

The identity manual gate is not complete until an operator has validated the actual configured provider/gateway.

Evidence should include:

- successful sign-in using the production provider identifier;
- verified email propagation;
- MFA/assurance claim propagation;
- replay rejection for an already-used assertion;
- correct organization selection when a user has multiple memberships;
- immediate denial after RAM membership suspension;
- immediate denial after organization suspension;
- successful secret-rotation procedure or documented rotation exercise.

Do not place raw identity signing secrets in pilot-gate evidence.

## Payment provider validation

The payment manual gate is not complete until the configured live or provider-approved pilot environment has been validated.

Evidence should include:

- verified buyer collection routing;
- verified supplier payout routing;
- payout-account ownership/verification procedure;
- authenticated webhook registration and receipt;
- duplicate webhook idempotency;
- provider idempotency behavior for ambiguous submissions;
- provider failure, cancellation and reversal semantics;
- reconciliation procedure between provider reports and RAM's append-only ledger;
- incident escalation contacts and secret-rotation procedure.

No real money movement should be initiated merely to satisfy a software checklist unless the provider and participating organizations have explicitly authorized that pilot transaction.

## Monitoring and incident-response validation

The monitoring gate should include evidence that:

- an external scheduler invokes `/api/monitoring/run` at the reviewed cadence;
- the most recent monitoring heartbeat is current;
- the external alert receiver verifies RAM's HMAC signature;
- at least one controlled alert-delivery exercise reached the intended on-call destination;
- acknowledgement and resolution ownership are assigned;
- the incident runbook identifies escalation paths for ambiguous payments, transport exceptions, stale disputes and failed alerts.

## Database recovery validation

Before launch:

1. create an encrypted production-format backup;
2. restore it into a separate recovery database;
3. run migration status against the restored database;
4. verify critical business, financial, audit, identity, payment and monitoring records;
5. record the exercise evidence in the backup/restore pilot gate.

Never use the active production database as the restore target for the exercise.

## Cutover rule

The pilot may admit real transactions only when all of the following are true at the same time:

- repository CI is green for the deployed revision;
- production migrations are applied and drift is clean;
- `npm run pilot:check` is READY;
- deployed smoke rehearsal passes;
- monitoring heartbeat is current;
- every persisted manual pilot gate is VERIFIED and unexpired;
- pilot organizations and responsible RAM operators have completed operational onboarding.

## Rollback and stop conditions

Stop admitting new transactions immediately if any launch gate becomes invalid or if a critical incident undermines confidence in identity, payment execution, financial reconciliation, restricted-source privacy, database durability or custody tracking.

Application rollback is appropriate only when the prior revision remains schema-compatible.

If the problem involves an applied schema change, follow `docs/DATABASE.md`: use a corrective migration or restore into a fresh validated database rather than editing applied migrations or using destructive reset commands.

After rollback or remediation, rerun the production readiness check, deployed smoke rehearsal and any manual gate affected by the incident before reopening the pilot.
