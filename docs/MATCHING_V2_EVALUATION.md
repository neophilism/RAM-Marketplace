# Matching v2 offline comparison

`lib/matching-v2-evaluation.ts` is a shadow evaluation tool. It cannot publish a candidate, clear a corridor, alter supplier acquisition, or select a model for production. The existing v1 matcher remains the live baseline.

For one research need, provide complete frozen v1 and challenger score records for the same animal IDs, plus a reviewed binary relevance label for every candidate. A missing label, duplicate ID, changed candidate set, mixed research need, missing hard-gate evidence or invalid score fails before metrics are computed.

The baseline hard gates remain authoritative. A challenger that marks a v1 hard-failed animal eligible produces a safety regression, and that animal is removed from the displayed challenger ranking even in this offline report. A `REVIEW` gate is not automatically converted to an approval; downstream human and compliance checks still apply.

The report gives precision and recall at a declared `topK`, restricted to the v1 hard-gate eligible candidate set. `passesOfflineComparison` requires no safety regression and no precision or recall regression in this reviewed fixture. It is only a fixture-level comparison. No fairness, latency, clinical validity, legal corridor or production acceptance is inferred from a passing result.

Synthetic tests run with `npm test` and cover better ordering, suppressed relevant candidates, attempted hard-gate promotion and malformed inputs. Before any staged rollout, evaluate a versioned, consented cohort with reviewed labels; retain the fixture hash, policy/model version, scorer output, disaggregated performance, latency, exact CI SHA and rollback path. Keep new jurisdictions and real-animal transactions disabled until separately approved.
