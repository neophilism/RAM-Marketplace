# RAM-01 Phase 0 low-fidelity screen map

Status: product wireframe specification derived from the current routes and Phase 0 plan. It describes information hierarchy and review actions; it is not a live-pilot signoff. Existing pages are implementation candidates and must be tested against these requirements.

| Screen and current route | Primary region | Main action | Information withheld or hard stop |
| --- | --- | --- | --- |
| Supplier candidate intake, `/farm/new` | Independent cull reason/date, animal basics, facility and source evidence | Save draft, submit for RAM pre-screen | No buyer budget, research-demand premium or inferred veterinary approval |
| Supplier dashboard, `/farm` | Own cases, review status, task/appointment and standard acquisition schedule | Correct own case, review status | No other farm, buyer quote or match-rarity economics |
| Veterinary case, `/vet/[id]` | Assigned case, phenotype/diagnostic evidence, welfare and transport fitness | Record review or escalate | No buyer price; unverified finding cannot silently pass |
| Research request, `/research/new` | Phenotype, inclusion/exclusion, protocol, facility and timing | Save request for review | Protocol claim remains unverified until institution evidence is checked |
| Research match, `/marketplace/[id]` | Anonymized animal, explainable evidence, missing data, quote and corridor feasibility | Reserve eligible candidate | No farm identity, exact address, supplier price or restricted files |
| RAM candidate review, `/ops/candidates/[id]` | Source provenance, veterinary evidence, hard blockers, transition history | Pre-screen or publish only after gates | No override of prohibited welfare/biosecurity/movement condition |
| RAM compliance order, `/compliance/orders/[id]` | Seven independent clearance checks, documents, findings and reviewer | Approve or reject clearance | Any missing check or active finding blocks pickup |
| Carrier task, `/transport/[id]` | Minimum necessary pickup, handling, custody and delivery fields | Record event and exception | No research budget, private study detail or broad source browsing |
| Institutional receiving, `/receiving/[id]` | Delivered case identity, documents, condition and discrepancy fields | Accept or reject with evidence | Delivery alone never records acceptance |
| RAM finance, `/finance/settlements/[id]` | Buyer receivable, independent supplier payable, ledger and reconciliation | Post scoped movement, settle or close | No settlement from an unbalanced ledger; no buyer-driven supplier payout |

## Interaction states required on each screen

- Loading and unavailable data show an explicit pending state, never an assumed approval.
- Forbidden role or wrong organization gets a server-enforced denial.
- Stale submission, duplicate event and expired authorization show a reviewable conflict instead of overwriting history.
- A blocked action names the missing evidence and does not mutate the transaction.
- A successful action shows the new state, actor and audit/correlation reference.

## Pilot walkthrough for design review

1. Supplier submits a pre-existing cull case without seeing a buyer signal.
2. RAM and veterinarian assess source, phenotype and welfare evidence.
3. Researcher creates a need and inspects an anonymized, explainable match.
4. Procurement commits a buyer quote; finance commits an independently priced supplier acquisition.
5. Compliance clears all seven gates; carrier records custody and delivery.
6. Receiving separately accepts or rejects; finance reconciles or handles a dispute.

Run the same walkthrough with a suspended user, missing protocol, prohibited corridor, failed vet review, transport exception, receiving rejection and duplicate payment callback. Link the resulting UI/E2E evidence to the exact tested SHA. Owner/counsel/veterinary decisions in `PHASE0_DECISION_REGISTER.md` remain open until explicitly evidenced.
