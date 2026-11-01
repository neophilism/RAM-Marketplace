# RAM-04 deployed smoke evidence boundary

The smoke script checks the existing application endpoints. It does not establish
pilot authorization, verified producer feeds, welfare or clinical approval,
researcher acceptance, or actual signed-alert delivery. A successful monitoring
cycle can record failed alert attempts; the script must not imply otherwise.

## Changes

- Reject ambiguous base URLs rather than silently stripping query/fragment
  components or normalizing control characters and backslashes. Preserve HTTPS
  subpaths and the existing explicitly enabled HTTP loopback rehearsal.
- Request JSON with no caching or ambient cookies and reject redirects. Only
  the monitoring POST carries the supplied bearer token. Retain the existing
  15-second request timeout. A failed POST is never retried automatically: its
  remote effect may be unknown and needs reconciliation first.
- Bound JSON responses to 65,536 bytes, including streamed bodies without a
  Content-Length. Cancel oversized streams, require a JSON object/media type,
  and reject malformed UTF-8 or JSON. No provider response body or transport
  exception is echoed in diagnostics; the failing step and HTTP code remain.
- Require both `ok: true` and `status: SUCCESS` plus a bounded, safe run ID.
  This matches `runMonitoringCycle` and the existing scheduled HTTP route.
  The positive legacy test fixture now includes the real route's SUCCESS status;
  no prior assertion is removed or weakened.
- Replace the overly broad CLI READY conclusion with an explicit statement
  that operational pilot authorization and alert-delivery verification remain
  separate gates.

## Verification

The four existing smoke tests, forty new response/URL cases and five new real
loopback HTTP cases pass locally: 49 total, zero skipped. Thirty-eight of the
44 non-HTTP cases fail against the unchanged original script. The bounded-stream
fixtures use finite synthetic streams; an earlier exploratory baseline run with
open streams was canceled and is not passing evidence.

The loopback server uses a constructed synthetic token, ephemeral localhost port,
and deterministic responses. It verifies actual fetch behavior, including refusing
public-probe and authenticated-POST redirects, withholding the token from health
requests, redacting server diagnostics and rejecting chunked oversized JSON. It
never contacts an external deployment, database, provider or production credential.

Focused strict compilation passed with TypeScript 5.8.3. Tests ran as compiled
ES modules on Node 22.16.0 with a local relative-extension resolver and scrubbed
environment. This is not the project's full toolchain or a Next/PostgreSQL run.
The existing npm test glob includes all new suites; exact-head CI must confirm
full integration. Earlier successful CI on d55a50bb57c56cf4bcd2d8780e239093bc849817
belongs to that earlier head, not to this follow-up.

No live configuration, account, credential, spending, schedule, workflow or
approval was changed. RAM-04 remains incomplete until its full approved pilot
scope and actual operational evidence are satisfied.
