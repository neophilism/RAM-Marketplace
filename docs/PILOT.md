# RAM pilot readiness and end-to-end test contract

## Purpose

A green unit-test suite proves individual rules. It does not prove that the complete multi-role transaction works through the deployed application boundary.

PR #14 therefore adds a live HTTP end-to-end suite plus a separate pilot-readiness checklist.

## Live E2E environment

CI first runs:

- Prisma validation;
- unit/domain/security tests;
- TypeScript type checking;
- production Next.js build.

It then launches that built application with:

- production Next.js runtime;
- isolated in-process prototype data;
- controlled demo identities;
- explicit same-origin HTTP requests.

The test therefore exercises the built routing/session/middleware/service stack while avoiding production credentials or a disposable external database.

The E2E suite does **not** claim to test PostgreSQL transaction semantics. Database migration and PostgreSQL deployment verification remain separate pilot gates.

## Happy-path scenario

The live test exercises:

1. supplier submits an independently selected cull candidate;
2. researcher submits a research need;
3. RAM passes pre-screen;
4. veterinarian claims and verifies the animal;
5. RAM publishes the anonymous candidate;
6. RAM activates the research need and matching runs;
7. researcher reserves the matched animal;
8. procurement commits the buyer institution;
9. RAM finance commits the independent supplier acquisition;
10. financial settlement opens;
11. supplier payout is recorded before buyer acceptance;
12. RAM compliance clears the order;
13. RAM assigns an authorized logistics organization;
14. transport provider confirms pickup and custody;
15. transport provider confirms delivery;
16. institutional receiving accepts the animal;
17. buyer payment is recorded;
18. finance finalizes settlement;
19. finance reconciles and closes the order.

The test also checks that the carrier packet does not expose the demo farm legal identity.

## Replacement exception scenario

The suite creates a second complete delivered order and then:

1. institutional receiving rejects the animal with a documented discrepancy;
2. the application opens a formal dispute;
3. buyer payment is recorded;
4. a full buyer credit is recorded;
5. the resulting buyer refund is recorded;
6. the supplier payable is already satisfied;
7. RAM resolves the dispute as `REPLACEMENT`;
8. the original order/ledger settle and reconcile;
9. the original order closes;
10. the research need reopens to `ACTIVE` for rematching.

## Refund exception scenario

A third delivered order follows the same rejection/unwind path, then RAM resolves the dispute as `REFUND`.

The suite verifies:

- commercial order closes after reconciliation;
- research need closes rather than reopening for rematch.

## Running locally

Build first:

```bash
npm run build
```

Start the built application in isolated prototype mode on port 3117 with demo auth enabled, then run:

```bash
RAM_E2E_BASE_URL=http://127.0.0.1:3117 npm run e2e:prototype
```

CI performs both operations automatically.

## Pilot readiness command

Run:

```bash
npm run pilot:check
```

The command automatically checks:

- production runtime;
- PostgreSQL backend and URL;
- session-secret strength;
- demo authentication disabled;
- unverified public onboarding disabled;
- reviewed mutation-size configuration.

A non-zero exit code means automatically verifiable configuration is blocked.

## Manual pilot gates

The readiness tool deliberately does not pretend these can be proven by environment inspection:

- production identity proofing / MFA or SSO;
- reviewed database migrations;
- TLS / WAF / trusted forwarding / hard body limits;
- encrypted backups and a tested restore;
- monitoring, alerting, incident ownership and runbooks;
- approved payment execution / payout process.

The super-admin `/ops/pilot` dashboard shows both automatic checks and these manual gates.

## Launch rule

A passing E2E suite means the application workflows integrate correctly in the controlled pilot harness.

It does **not** by itself authorize real animal transactions.

Real transactions should begin only after:

- automatic readiness blockers are zero;
- all manual deployment gates are verified;
- PostgreSQL migrations and backup/restore have been tested;
- identity and payment execution procedures are operational;
- the pilot organizations, veterinary providers and logistics providers have completed their operational onboarding.
