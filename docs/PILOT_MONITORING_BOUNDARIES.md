# RAM-04 monitoring boundary regression evidence

Base source: `1d9d6d6492acef6790f16d5ea8ea8dbb7330f49f`.

The monitoring verifier now checks the entire 64-character hexadecimal signature
before decoding. Previously Node's permissive hex decoder could discard a suffix
or odd nibble after an otherwise valid digest. This fix does not create a new
signing protocol: the HMAC still binds the unchanged timestamp and raw body, and
valid uppercase/lowercase digest representations remain supported.

Timestamps must be canonical nonnegative decimal seconds with safely representable
milliseconds. Verifier clocks and skew settings must be safe nonnegative integers;
NaN or infinity can no longer disable freshness comparisons. The 300-second default
and inclusive boundary remain unchanged; a zero-second policy is supported.

Whitespace padding cannot satisfy the existing 32-character secret minimum. The
bearer verifier rejects an absent/weak expected token before comparison. Alert
configuration rejects userinfo, fragments, control characters and backslashes
without echoing configured URLs. Existing HTTPS requirements and the explicitly
enabled HTTP loopback-only CI exception remain unchanged. No live configuration,
permissions, endpoint, scheduler, resource allowance or secret was modified.

## Checks

All five unchanged monitoring tests and 32 added boundary tests pass locally:
37 total, zero skipped. Twenty-eight cases fail against the unchanged base source.
The focused strict TypeScript check also passes. Local tools are Node 22.16.0 and
TypeScript 5.8.3 in an environment without inherited credentials. Tests use only
synthetic messages and keys and do not contact any receiver or database.

The existing project test glob discovers the new suite. Full project type checking,
Next builds, real PostgreSQL integration, operational alert delivery and exact-head
CI are separate evidence; focused tests are not a production-pilot approval. Real
producer feeds, veterinary/welfare decisions, authorized corridors and researcher
acceptance remain outside these synthetic checks. Keep RAM-04 incomplete until its
full plan and actual operational acceptance are satisfied.
