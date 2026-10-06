# RAM payment execution contract

## Purpose

RAM's financial ledger remains the accounting source of truth.

The payment-execution layer does not rewrite ledger history or change the independently committed supplier acquisition amount. It provides a secure, provider-neutral way to execute:

- buyer collections;
- supplier payouts;
- buyer cash refunds.

A buyer credit remains an internal accounting adjustment rather than an external money movement.

## Trust boundary

RAM integrates with a trusted payment gateway rather than embedding bank credentials or provider-specific secrets throughout the application.

Production configuration:

- `RAM_PAYMENT_GATEWAY_NAME`
- `RAM_PAYMENT_GATEWAY_URL`
- `RAM_PAYMENT_GATEWAY_SECRET`

The payment secret must:

- be at least 32 characters;
- be distinct from `AUTH_SECRET`;
- be distinct from `RAM_IDENTITY_ASSERTION_SECRET`.

Production gateway URLs must use HTTPS.

The only exception is the explicit loopback-only CI setting:

`RAM_PAYMENT_GATEWAY_ALLOW_INSECURE_LOCAL=true`

Pilot readiness fails while that override is enabled.

## Outbound execution

RAM finance creates a durable `PaymentExecution` before any provider request is sent.

Each execution snapshots:

- settlement;
- execution type;
- amount;
- currency;
- requesting RAM user;
- unique RAM idempotency key.

RAM then POSTs a signed instruction to:

`{RAM_PAYMENT_GATEWAY_URL}/v1/executions`

Headers include:

- `Idempotency-Key`;
- `X-RAM-Gateway-Timestamp`;
- `X-RAM-Gateway-Signature`.

The signature is HMAC-SHA256 over:

`timestamp + "." + rawBody`

The gateway acknowledgment must also be HMAC-signed and must return:

- configured gateway name;
- underlying provider identifier;
- provider transaction/reference ID;
- status `SUBMITTED` or `PROCESSING`.

## Idempotency

A provider execution is never retried with a new idempotency key merely because RAM did not receive a definitive response.

If RAM encounters:

- a network timeout;
- connection failure;
- gateway HTTP 5xx;

the execution becomes:

`SUBMISSION_UNKNOWN`

Finance may retry that same execution. The original execution ID and idempotency key are reused.

This prevents an ambiguous first request from becoming a duplicate collection or payout.

## Provider status webhooks

The trusted gateway POSTs status events to:

`/api/payments/webhook`

The endpoint is exempt from browser same-origin checks because it is a machine-to-machine callback, but it requires the payment HMAC signature and a timestamp within the configured skew window.

Webhook fields include:

- unique gateway event ID;
- gateway name;
- provider;
- provider reference;
- RAM execution ID;
- status;
- provider event timestamp;
- optional failure code/message.

Durable `PaymentWebhookReceipt` records provide webhook idempotency.

The unique key is:

`gateway + eventId`

A duplicate delivery returns the previously processed result and cannot append another ledger movement.

## When the ledger changes

Creating or submitting an execution does **not** count as payment.

Only an authenticated provider webhook with:

`status = SUCCEEDED`

may append the associated ledger movement:

- `BUYER_COLLECTION -> BUYER_PAYMENT`
- `SUPPLIER_PAYOUT -> SUPPLIER_PAYOUT`
- `BUYER_REFUND -> BUYER_REFUND`

The ledger entry stores the provider/reference pair as its external reference.

The existing balance rules are checked again when the success webhook is processed.

## Failure and cancellation

`FAILED` and `CANCELED` are terminal provider states.

They do not create money-movement ledger entries.

Failure code/message are kept on the execution for finance review.

If the provider subsequently discovers that a supposedly failed transaction actually moved funds, that must arrive as a separately reconciled provider/accounting correction rather than rewriting the terminal execution or ledger history.

## Repeated nonterminal events

Providers may emit repeated `PROCESSING` notifications.

A new webhook event whose status equals the current nonterminal status is recorded as a processed event with no state change.

It does not create a ledger entry.

## Manual reconciliation fallback

Manual financial movement entry remains available for transactions executed outside the configured gateway or requiring accounting reconciliation.

However, RAM blocks a manual:

- buyer payment;
- supplier payout;
- buyer refund

when an execution of the corresponding type is still:

- `CREATED`;
- `SUBMITTED`;
- `SUBMISSION_UNKNOWN`;
- `PROCESSING`.

This prevents finance from manually posting a movement while a provider may still complete the same instruction.

Buyer credits remain manually recorded because they are accounting adjustments, not provider cash movements.

## Supplier-price separation

The payment gateway never computes supplier compensation.

The supplier amount was fixed earlier at acquisition commitment:

`min(standardized cull schedule, market ceiling)`

The provider instruction receives only the amount already due.

It does not receive:

- buyer quote;
- match score;
- research rarity/value;
- RAM margin as a pricing input;
- permission to recalculate supplier compensation.

## Database records

### PaymentExecution

Durable execution state including:

- settlement;
- type;
- amount/currency;
- status;
- gateway/provider;
- provider reference;
- idempotency key;
- failure details;
- timestamps.

### PaymentWebhookReceipt

Durable replay/idempotency record including:

- gateway;
- event ID;
- execution ID;
- SHA-256 payload hash;
- received/processed timestamps;
- processing result.

The webhook table intentionally does not need to store full raw provider payloads.

## CI

PostgreSQL CI starts a local signed gateway harness and verifies:

1. RAM signs the outbound instruction;
2. gateway acknowledgment signature is verified;
3. execution becomes `SUBMITTED`;
4. manual entry of the same movement is blocked while unresolved;
5. authenticated `SUCCEEDED` webhook appends exactly one ledger entry;
6. provider reference is preserved;
7. replaying the same event does not append another entry;
8. payment execution/webhook tables survive dump/restore.

The loopback HTTP exception used by CI is prohibited by pilot readiness.

## Production provider validation

Before live money movement, operations must separately validate:

- live gateway/provider credentials;
- payout-account ownership/verification;
- provider webhook registration;
- provider idempotency semantics;
- settlement timing;
- provider-side failure/reversal behavior;
- accounting reconciliation;
- incident escalation contacts;
- secret rotation.

The application contract does not substitute for those provider-specific operational checks.
