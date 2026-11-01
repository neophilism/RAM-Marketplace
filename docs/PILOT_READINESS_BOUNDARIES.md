# RAM-04 configuration-readiness validation

Base: `6d919fdc5be07f71e36a59bde7d13b4cf1c6fa1c`.

Prefix matching alone treated incomplete or ambiguous HTTPS/PostgreSQL values as
configured. Readiness now parses the full URL without making any network call or
printing the value. Empty hosts, invalid ports, internal control characters and
backslashes are rejected. PostgreSQL credentials and SSL/schema query parameters
remain supported. HTTPS API endpoints reject embedded userinfo and fragments;
browser identity-login fragments remain supported because they can be legitimate
client-side routes. HTTPS identity and gateway query strings remain supported.

The existing secret-length check no longer counts whitespace padding. Monitoring
run and alert secrets are compared after the same trimming already performed by
runtime monitoringConfig, preventing a padded duplicate from appearing independent
in preflight while being rejected by the actual runner or alert sender.

No credentials, environment values or live endpoints are changed. The six manual
gates, MFA policy, demo/public-onboarding prohibitions, insecure-local launch
prohibitions, threshold bounds, role controls and mutation-size range are retained.
A syntactically valid URL does not prove connectivity, provider identity, successful
authentication, TLS deployment, safe DNS resolution or operational pilot acceptance.

## Test evidence

All six unchanged readiness tests and 47 new boundary cases pass locally: 53 total.
Forty-two cases fail against the unchanged readiness source at the base commit.
Combined with monitoring, all 90 focused tests pass; no cases are skipped. Strict
compilation uses TypeScript 5.8.3 and execution uses Node 22.16.0 in a scrubbed
environment, with synthetic configuration only. The tests include unchanged manual
gate definitions, input nonmutation and absence of credential/connection values
from readiness output. Full project CI and deployed evidence remain separate.

The existing project test glob includes the new suite. This is a repair to a
configuration preflight, not a new institutional approval or a claim that RAM-04's
real producer, diagnostic, corridor-transport, welfare, researcher or accounting
acceptance is complete.
