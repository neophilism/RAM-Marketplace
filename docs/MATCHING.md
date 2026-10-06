# RAM matching contract

## Purpose

RAM matching is a decision-support system for pairing already-eligible, naturally occurring animal cases with structured research needs.

The engine does **not** make veterinary eligibility decisions and does not override animal welfare, compliance, institutional approval, or researcher judgment.

## Entry conditions

A candidate is matchable only after:

1. independent cull provenance is recorded;
2. RAM pre-screen is complete;
3. an assigned veterinarian completes clinical review;
4. the veterinarian marks the case eligible;
5. RAM reviews the anonymized scientific record and buyer price;
6. RAM publishes the case as `MATCHABLE`.

A research request participates only after RAM verifies and activates it as `ACTIVE`.

## Hard-gate behavior

The matching engine applies gates before ranking.

Current deterministic gates:

- candidate must be `MATCHABLE`;
- required species must match;
- explicit age range must match when age is known;
- explicit sex must match when sex is known;
- documented comorbidities matching an explicit exclusion criterion fail the candidate.

When constrained information is missing or terminology is ambiguous, the engine creates a `REVIEW` flag rather than inventing a fact.

Examples:

- required age but unknown age -> REVIEW;
- required sex but candidate sex unconfirmed -> REVIEW;
- required diagnostic modality but no clear evidence of it -> REVIEW;
- disease/stage terminology that does not map cleanly -> REVIEW;
- partial possible exclusion overlap -> REVIEW.

A true hard-gate failure produces a score of zero and the candidate is not presented in the eligible ranked results.

## 100-point ranking

Candidates that survive hard gates are scored:

| Component | Points |
|---|---:|
| Phenotype fit | 30 |
| Diagnostic confidence | 20 |
| Etiology fit | 15 |
| Comorbidity fit | 10 |
| Timing / availability | 10 |
| Logistics fit | 10 |
| Price fit | 5 |
| **Total** | **100** |

### Phenotype

Compares the requested phenotype to veterinarian-characterized phenotype observations and the approved scientific record.

### Diagnostic confidence

Uses the veterinarian's confidence classification. If a research need requires a specific diagnostic modality and the candidate record does not clearly contain that evidence, the component is capped and a human-review flag is generated.

### Etiology

Uses an explicit veterinarian-characterized etiology and an explicit optional researcher etiology requirement. When the researcher does not constrain etiology, this component does not penalize natural variation.

### Comorbidities

Uses explicitly recorded comorbidities rather than attempting to infer them from narrative text.

Explicit exclusion matches are gates. Acceptable-comorbidity preferences affect ranking when exclusions are not triggered.

### Timing

Parses simple stated time windows and compares candidate availability with the research timeline. Unparseable schedules become review flags.

### Logistics

Currently gives full logistics credit when the veterinarian marks the candidate transport-ready. Later corridor, receiving-facility, biosecurity and carrier constraints will add deterministic logistics gates.

### Price

Compares buyer list price with the research request's stated budget. This has **no relationship to supplier acquisition price**.

## Explainability

Each persisted `ResearchMatch` stores:

- total score;
- every component score;
- hard-gate states and reasons;
- human-review flags;
- readable scoring reasons;
- candidate and research-need identifiers;
- generation timestamp.

This allows RAM and researchers to reconstruct why a candidate was ranked.

## Privacy

Matching operates on scientific candidate data. Farm identity, exact source location, owner identity, local-veterinarian identity, supplier payment and other restricted source data are not matching features.

## Versioning direction

This implementation is the deterministic v1 engine. Future changes should version the scoring policy rather than silently changing historical interpretation. Machine learning may later assist ranking, but should not replace welfare/compliance gates or eliminate explainability.
