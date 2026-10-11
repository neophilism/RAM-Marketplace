> **Canonical planned-work registry:** [`registry/roadmap.json`](../registry/roadmap.json). This original detailed plan remains available; update new work and PR links only in the registry file.

# RAM-Marketplace: original development plan (complete recovery)

**Source:** ChatGPT Library original `RAM_Corporation_Development_Plan.docx`. Full extracted text is preserved below. **This is the original planning source**, not a current implementation-completion assertion.

**Handoff:** Inspect the current README, `docs/` and `.exechub/project.yml` if present; reconcile the plan with merged PRs, CI, dependencies and real deployments. Never infer that a plan milestone is completed from the original specification.

**Context:** Original October 5 RAM corporation marketplace planning baseline. Validate later product decisions (broker model, confidentiality, veterinary gates) against current repo before implementation.

---























RAM Corporation — Marketplace Development Plan

RAM
Marketplace Development Plan
End-to-end product, software architecture, business-process, matching, compliance, and pilot roadmap

RAM Corporation
Version 1.0  |  October 5, 2026
	Core commercial model
Researchers pay research-market pricing. RAM purchases the matched cull animal from the supplier at a standardized amount at or below ordinary market value. RAM keeps the spread after verification, veterinary, compliance, and logistics costs.





  Contents
 1    Executive summary
 2    Product principles & business rules
 3    Users, organizations & permissions
 4    End-to-end transaction workflow
 5    Supplier application
 6    Researcher application
 7    Veterinary, logistics & RAM operations
 8    Matching engine
 9    Pricing, checkout & ledger
10    Animal-welfare and anti-manipulation controls
11    Compliance rules engine
12    Data model
13    Technical architecture
14    APIs & integrations
15    Security, privacy & auditability
16    Analytics & operational intelligence
17    Testing & quality strategy
18    Delivery roadmap
19    Team & operating model
20    Pilot design & KPIs
21    Open decisions / pre-launch diligence
22    Source notes


1  Executive summary
RAM is a two-sided marketplace that finds research value in animals that would otherwise be culled.
RAM connects livestock operations that have bona-fide cull candidates with research institutions seeking animal models. The platform does not pay suppliers a disease premium. Instead, the supplier receives a standardized acquisition price that is independent of research value; the researcher pays a research-market price; RAM captures the spread after services and transaction costs.
	The atomic commercial event
The intended user experience is: researcher commits to a matched animal → RAM creates the supplier purchase commitment under a standing agreement → clearance and transfer workflows begin. The software must model “commercial commitment,” “title transfer,” and “physical custody” as separate states so legal counsel can set the exact title-transfer point without changing the product flow.



Why this model works
• Supply can have low or negative alternative economic value when the animal is already scheduled for culling.
• Demand can have high value because research animals, characterization, housing, and model creation are expensive.
• Just-in-time acquisition minimizes speculative animal inventory, working capital, and holding risk.
• Decoupled supplier pricing prevents research demand from becoming an incentive to injure animals.
• The platform creates a structured data asset mapping real-world phenotypes to study requirements.
MVP objective
Prove one liquid swine corridor: a limited set of suppliers, a limited set of scientifically useful and legally movable phenotype families, and a named cohort of researchers. The MVP succeeds when RAM can take a candidate from supplier submission to verified match, paid order, acquisition, clearance, transfer, receipt, and auditable closeout without leaving the platform.
2  Product principles & business rules
These are product invariants: engineering should encode them as rules, not rely on staff memory.
	Invariant
	Implementation rule

	Research demand never sets supplier payout
	Supplier price is determined by a standardized cull-acquisition schedule and policy ceiling. Diagnosis, severity, rarity, urgency, match score, and researcher budget cannot increase the supplier offer.

	Buyer pricing is separate
	Research price reflects model value, diagnostic depth, logistics, timing, service, and market conditions. Suppliers do not see the buyer’s price.

	Pre-existing cull status
	Eligibility requires that the animal was independently identified as a cull candidate before a RAM match or buyer-specific demand was disclosed.

	No deterioration bonus
	A worsening condition never increases supplier compensation.

	Qualified use only
	RAM is not a general livestock marketplace. Buyers must be verified research organizations and transactions must pass study, facility, movement, and welfare gates.

	No illegal movement
	The rules engine blocks prohibited state/federal movements and requires case-specific documentation before shipment.

	Explain every match
	Researchers and RAM operations can see why a candidate matched, which requirements are satisfied, and what data are missing.

	Human override is logged
	Manual overrides require a reason, named user, timestamp, old/new values, and—where applicable—second approval.



	Commercial language
Externally, RAM can describe itself as a marketplace / intermediary. Because RAM intends to purchase the animal and resell it, counsel should determine the correct legal characterization in each jurisdiction (broker, dealer, reseller, owner-of-record, or another category). The software should not hard-code a legal label.



3  Users, organizations & permissions
Multi-organization RBAC/ABAC is foundational because the same animal record is viewed differently by suppliers, researchers, vets, logistics providers, and RAM staff.
	Role
	Organization
	Key permissions

	Supplier owner/admin
	Farm / producer
	Manage organization, facilities, staff, standing seller agreement, payout account, cull listings, records.

	Supplier staff
	Farm / producer
	Create and update candidate animals; upload records; schedule vet access; cannot alter pricing policy.

	Research PI / scientist
	Research institution
	Create research requests, review candidates, compare matches, reserve/buy, approve substitutions.

	Research procurement
	Research institution
	Approve quotes, purchase orders, payment methods, invoices, vendor docs; may not change scientific inclusion criteria without PI permission.

	Research compliance
	Research institution
	Upload protocol / IACUC documentation and facility approvals; verify destination readiness.

	Veterinarian / verifier
	Independent or partner vet
	Accept assignment, examine animal, enter findings, order/attach tests, certify applicable documents.

	Transport provider
	Carrier
	Receive only the minimum data needed for pickup/delivery, route, handling, chain-of-custody, sanitation, and incident reporting.

	RAM marketplace ops
	RAM
	Review listings, resolve match exceptions, coordinate transactions, manage substitutions, communications, and closeout.

	RAM compliance
	RAM
	Maintain rules, review restricted cases, approve exceptions, suspend movements, audit documents.

	RAM finance/admin
	RAM
	Configure pricing, reconcile payments/payouts, manage disputes, users, vendors, and reporting.



Visibility rules
• Researchers see supplier identity and precise location only when operationally necessary; pre-purchase search can show approximate geography.
• Suppliers never see researcher willingness-to-pay or other suppliers’ offers.
• Transport users cannot browse research details beyond handling requirements.
• Vets can see enough study context to understand required diagnostics but should not see buyer price.
• RAM staff privileges are separated by operations, compliance, finance, and super-admin scopes.
4  End-to-end transaction workflow
The platform should be designed around state machines so every transaction is restartable, auditable, and resilient to failure.
	#
	Stage
	Required platform behavior

	1
	Supplier onboarding
	Verify organization/facility, execute standing seller terms, configure payout, set biosecurity contacts.

	2
	Cull candidate created
	Animal ID, species, age/weight, cull reason, planned cull date, treatment history, supporting media/records.

	3
	Eligibility pre-screen
	Rules engine checks prohibited categories, minimum data, timing, location, movement constraints, duplicate animal ID.

	4
	Veterinary characterization
	Assigned vet records phenotype, diagnostics, severity bands, communicability flags, fitness-to-transport factors.

	5
	Research request
	Scientist specifies inclusion/exclusion criteria, phenotype, acceptable etiologies, weight/age/sex, timing, geography, facility constraints.

	6
	Matching
	Hard filters remove ineligible animals; scoring ranks remaining candidates; missing data become explicit tasks.

	7
	Reservation / due diligence
	Buyer reserves candidate while documents, price, protocol, destination, and movement corridor are validated.

	8
	Buyer checkout
	Buyer accepts quote and terms; funds / PO are authorized; RAM creates commercial commitment and locks animal.

	9
	Supplier acquisition
	Standing supplier agreement produces a bill-of-sale workflow at the standardized acquisition price. Exact title event is counsel-configurable.

	10
	Final clearance
	CVI/permits/health checks/transport requirements satisfied; prohibited case automatically blocks shipment.

	11
	Pickup + chain of custody
	Carrier verifies identity, condition, timestamp, custody transfer, sanitation, route; incidents captured in app.

	12
	Delivery / receipt
	Research facility confirms receipt, identity, condition, and exceptions; buyer payment capture / settlement follows configured terms.

	13
	Closeout
	Supplier payout, vendor payments, invoice, margin, documents, and audit record reconciled.

	14
	Outcome feedback
	Optional study-fit feedback improves matching without exposing confidential results beyond agreed fields.



Canonical order states
DRAFT → CANDIDATE_HELD → CHECKOUT_PENDING → BUYER_COMMITTED → ACQUISITION_COMMITTED → CLEARANCE_PENDING → READY_FOR_PICKUP → IN_TRANSIT → DELIVERED → ACCEPTED → SETTLED → CLOSED. Failure states include EXPIRED, CLEARANCE_FAILED, SUPPLIER_WITHDRAWN, BUYER_CANCELLED, TRANSPORT_EXCEPTION, REJECTED_AT_RECEIPT, and DISPUTED.
5  Supplier application
The supplier portal should feel like a simple cull-recovery workflow, not a scientific marketplace.
	Module
	MVP requirement

	Dashboard
	Candidates by status; upcoming planned culls; vet visits; completed sales; payouts; compliance tasks.

	Quick-add candidate
	Animal ID, facility/pen, species/breed, DOB/age, sex, weight, reason for cull, planned cull date, prior treatments, photos/video.

	Batch import
	CSV/API upload for high-volume producers; reject duplicates and incomplete mandatory fields.

	Records
	Production records, vet notes, diagnostics, vaccination/treatment history, origin, official ID.

	Standard offer
	Display RAM acquisition price and expiration only. Show no buyer price, research budget, demand heat, or match rarity.

	Vet scheduling
	Available appointment windows, instructions, consent to records access, on-farm biosecurity requirements.

	Sale / payout
	Electronic sale agreement, tax/vendor forms, ACH details, payment status, downloadable remittance.

	Supplier integrity
	Show policy that intentional injury, induced disease, treatment withholding, record falsification, or listing manipulation causes suspension/termination.



Candidate lifecycle
DRAFT → SUBMITTED → PRE_SCREENED → VET_PENDING → VERIFIED → MATCHABLE → RESERVED → SOLD_TO_RAM → TRANSFERRED. A candidate can be WITHDRAWN, CULLED, EXPIRED, INELIGIBLE, QUARANTINED, or SUSPENDED at any point where appropriate.
6  Researcher application
Researchers should begin with a scientific request and receive explainable matches, not scroll through a livestock catalog.
	Module
	MVP requirement

	Organization onboarding
	Institution validation, billing/procurement profile, approved receiving facilities, compliance contacts, SSO option.

	Research request builder
	Species, condition/phenotype ontology, objective thresholds, acceptable etiologies, severity, chronicity, age, weight, sex, comorbidities, treatments, exclusions, deadline, quantity.

	Study approvals
	Protocol number, validity dates, IACUC/ethics documents as applicable, facility/species authorization, PI and compliance approvers.

	Match results
	Ranked cards with match %, evidence, missing data, location band, availability, price, estimated clearance time, and constraints.

	Animal detail
	Timeline, diagnostics, treatment history, phenotype evidence, vet verification, chain-of-origin, logistics estimate, inclusion/exclusion matrix.

	Compare
	Side-by-side comparison for 2–5 candidates; highlight criteria differences and uncertainty.

	Checkout
	Quote acceptance, PO/card/wire/ACH support, terms, destination, requested pickup window, substitution policy.

	Orders
	Clearance checklist, shipment tracking, documents, receiving acknowledgement, invoice, dispute/support.

	Saved searches
	Notify only when a new eligible candidate crosses a user-defined match threshold; no supplier-side demand signal.



	Critical UX rule
A “93% match” must never be a mysterious score. The detail view should show every hard requirement, every weighted factor, source evidence, last-updated time, and missing/uncertain data.



7  Veterinary, logistics & RAM operations
RAM’s operational interfaces are the control plane that turns a marketplace order into a lawful, welfare-conscious physical transfer.
Veterinarian workspace
• Assignment queue with facility instructions, required PPE/biosecurity, due date, and research characterization checklist.
• Structured exam template with vital observations, phenotype scoring, communicability flags, transport fitness, diagnostics ordered/completed, and attachments.
• E-signature on attestations and certificates within scope of the veterinarian’s authority; immutable finalized results with amendment history.
• Escalation path for suspected intentional harm, untreated suffering, reportable disease, biosecurity risk, or inaccurate supplier records.
Transport workspace
• Pickup/delivery task, animal identity, handling instructions, route, contact chain, required documents, permitted stops, and contingency contacts.
• Chain-of-custody scan at pickup, handoffs, and receipt; timestamp + geolocation when consented/allowed.
• Vehicle sanitation checklist, containment confirmation, temperature/condition observations, incident reporting, proof of delivery.
RAM operations console
	Console
	Functions

	Marketplace queue
	Listings needing review, matches awaiting action, expiring culls, clearance blockers, orders at risk.

	Manual match
	Search entire candidate pool, create a match with reason, never bypass hard legal blocks.

	Exception desk
	Substitutions, failed diagnostics, seller withdrawal, weather/transport delay, receiving rejection, disputes.

	Supplier health
	On-time rate, record completeness, abnormal condition incidence, audit status, suspensions.

	Researcher health
	Conversion, cancellations, protocol validity, payment status, receiving performance.

	Margin view
	Buyer price, supplier acquisition, vet/diagnostic/logistics costs, fees, refunds, contribution margin — restricted to finance/authorized ops.



8  Matching engine
Start rules-based and explainable. Add machine learning only after RAM has enough completed-match data to evaluate it safely.
Hard eligibility filters (must all pass)
• Animal status = MATCHABLE and within time window
• Species and study-required biological constraints
• Minimum/maximum age, weight, sex/reproductive status
• Required diagnosis / phenotype evidence present
• Explicit exclusion criteria absent
• Communicability / reportable disease policy passes
• Origin and destination movement corridor allowed
• Receiving facility authorized / capable for species and condition
• Transport duration and fitness constraints pass
• Buyer research approval valid for planned use
• No supplier suspension, animal risk hold, duplicate ID, or provenance conflict
Soft scoring model (v1)
	Factor
	Default
	Scoring logic

	Phenotype fit
	30%
	Distance between requested objective measures and verified animal values; exact categorical matches score highest.

	Diagnostic confidence
	20%
	Evidence tier, test recency, veterinarian verification, sample quality, conflicting records.

	Etiology fit
	15%
	Requested/acceptable etiology versus observed/likely etiology.

	Comorbidity fit
	10%
	Penalize exclusions; reward explicitly desired comorbidities.

	Timing / availability
	10%
	Cull window, diagnostic lead time, buyer study start date.

	Logistics fit
	10%
	Distance, route, transport constraints, corridor readiness.

	Price fit
	5%
	Buyer budget / quote constraints after all scientific and welfare gates pass.



Weights are request-configurable within RAM-defined bounds. Matching should output a component score, reason string, source evidence, and confidence flag for each factor. Missing critical data should create a task rather than silently assume a value.
Matching v2
After sufficient pilot data, use learning-to-rank or calibrated prediction only to improve ordering among already-eligible candidates. Never allow an ML model to override legal, biosecurity, welfare, protocol, or supplier-integrity hard blocks. Offline evaluation must compare acceptance rate, time-to-match, cancellation rate, transport exceptions, and post-receipt scientific fit against the rules baseline.
9  Pricing, checkout & ledger
The pricing engine must make supply-side and demand-side economics independent by design.
Supplier acquisition price
price_supplier = min(standardized_cull_schedule, configured_market_ceiling). The schedule can vary by species, broad weight class, geography, and ordinary salvage economics, but not by diagnosis, severity, rarity, research demand, buyer identity, buyer budget, or match score. A policy option should require the default cull price to be materially below the healthy-equivalent market value where economically appropriate.
Researcher sale price
price_buyer = base_model_price + characterization + diagnostics + urgency + logistics + service + corridor/risk adjustments. RAM can price fixed, quoted, or contracted schedules by enterprise buyer. The buyer price is not exposed to the supplier.
Transaction ledger
	Ledger object
	Fields

	Buyer order
	Gross amount, tax if applicable, discounts, PO/payment method, authorized/captured/refunded amounts.

	Supplier acquisition
	Offer, supplier acceptance, title/commitment event, payout amount, payout status.

	Pass-through costs
	Vet exam, diagnostic lab, permits, carrier, quarantine/holding, insurance, other direct costs.

	RAM revenue
	Gross spread, service fees, net revenue classification, contribution margin.

	Reserves / disputes
	Refund reserve, chargeback/dispute state, rejected-delivery reserve, incident costs.



	Illustrative economics, not a forecast
USDA’s Oct. 5, 2026 report shows a negotiated live-hog weighted price of $54.87/cwt for 240–320 lb animals; the associated prior-day report shows 282.47 lb average live weight for negotiated animals, or roughly $155 at that live-price benchmark. NSRRC’s 2026 academic distribution fees range from $575 for wild-type swine to $3,000 for housed genetically modified swine. RAM’s actual acquisition and sale prices require pilot validation.



10  Animal-welfare and anti-manipulation controls
The marketplace should be structurally unprofitable as a way to manufacture research animals.
	Control
	Product implementation

	No pathology premium
	Supplier price independent of diagnosis, severity, rarity, or buyer demand.

	Cull-first timestamp
	Supplier declares cull intent before buyer-specific demand is shown. Keep signed/time-stamped event.

	Treatment non-interference
	Standing terms prohibit withholding ordinary reasonable care to preserve or worsen a RAM-eligible phenotype.

	No induced eligibility
	Intentional infection, injury, exposure, drug administration, deprivation, or other manipulation to create eligibility is prohibited.

	Historical baseline
	Track condition incidence by facility, barn/pen, season, cohort, and producer; flag unusual jumps.

	Cross-record consistency
	Compare production records, vet records, treatment logs, mortality/cull patterns, dates, media metadata, and diagnostics.

	Independent verification
	Selected categories require third-party vet exam or laboratory test before matchability.

	Suspension / clawback
	Risk holds, supplier suspension, payment hold, investigation, and contractual remedies for manipulation or falsification.

	Welfare escalation
	Any user can flag suspected suffering; ops can pause transaction and route to veterinary / authority process as appropriate.



Anomaly score
risk_score = condition-incidence deviation + repeated rare phenotypes + timing anomalies + record inconsistencies + unusual withdrawal/cancellation patterns + vet concerns. Use the score for review prioritization, not as proof of misconduct. High-risk flags should automatically hide affected listings from buyers pending review.
11  Compliance rules engine
Regulatory eligibility changes by species, disease, origin, destination, purpose, carrier, and institution. Treat rules as versioned data.
Rule dimensions
• Origin state / destination state / intrastate vs interstate
• Species and official identification rules
• Condition / communicability / reportable status
• Purpose of movement and destination facility type
• Certificates, permits, tests, quarantine, sanitation, and carrier requirements
• Animal Welfare Act applicability / carrier registration where applicable
• Research institution protocol/facility approval and validity window
• Veterinarian authority and credential / accreditation requirements
Rules-engine behavior
Each rule version has jurisdiction, effective dates, source URL/document, condition predicates, required evidence, blocking vs warning effect, owner, review cadence, and superseded-by link. Every order records the exact rule versions evaluated so RAM can later explain why a transfer was allowed or blocked.
	Important launch constraint
USDA/APHIS states that interstate movement of diseased animals is generally prohibited under 9 CFR 71.3, with disease- and purpose-specific exceptions and additional state requirements. RAM should not assume that a scientifically desirable disease can be transported interstate. The first pilot should favor intrastate movements and/or eligible non-communicable phenotypes until each corridor is reviewed.



Required pre-launch legal/veterinary work
• Map federal AWA/dealer/carrier applicability to RAM’s exact custody model.
• Identify livestock dealer/broker licensing and sale requirements in pilot states.
• Review state veterinary practice and health-certificate rules.
• Define title-transfer point, risk of loss, refund/rejection, and emergency euthanasia authority.
• Review biosecurity, reportable disease, and diagnostic-lab obligations for each pilot phenotype.
12  Data model
Design the schema around provenance and state changes; do not compress the transaction into a single “animal listing” table.
	Domain
	Primary entities

	Identity / tenancy
	Organization, User, Membership, Role, Facility, Address, Credential, Agreement

	Supply
	Animal, AnimalIdentifier, CullEvent, SupplierListing, WeightObservation, MediaAsset, OriginRecord

	Clinical / phenotype
	PhenotypeObservation, Diagnosis, DiagnosticTest, TestResult, Treatment, Procedure, VetExam, CommunicabilityAssessment

	Demand
	ResearchProgram, ResearchRequest, InclusionCriterion, ExclusionCriterion, StudyApproval, ReceivingFacilityCapability

	Matching
	CandidateSnapshot, Match, MatchComponent, MatchEvidence, Reservation, MissingDataTask

	Commerce
	Quote, Order, SupplierOffer, Acquisition, ResearchSale, Invoice, Payment, Refund, Payout, CostItem, MarginRecord

	Compliance
	Rule, RuleVersion, RuleEvaluation, Permit, Certificate, Clearance, RiskFlag, ReviewDecision

	Logistics
	TransportJob, Carrier, Vehicle, Route, CustodyEvent, SanitationRecord, Incident, ProofOfDelivery

	Platform
	Document, Notification, Comment, SupportCase, AuditEvent, FeatureFlag, IntegrationEvent



Animal record principles
• Immutable primary identity with aliases / official IDs; never reuse an animal ID.
• Observations are append-only with source, time, author, units, method, and confidence.
• Corrections create superseding records instead of silently editing finalized clinical values.
• Every match stores a candidate snapshot so later record updates do not rewrite history.
• Documents are content-addressed / checksummed and retain original uploads plus normalized metadata.
13  Technical architecture
Use a modular monolith for the MVP: one deployable application with strict domain modules, then extract services only when scale or isolation justifies it.
	Layer
	Recommended MVP approach

	Web apps
	TypeScript + React / Next.js; responsive supplier, researcher, vet, carrier, and RAM admin experiences sharing a design system.

	Application API
	TypeScript backend (NestJS/Fastify or equivalent) with domain modules: identity, supply, demand, matching, commerce, compliance, logistics, audit.

	Primary database
	PostgreSQL; PostGIS for distance/corridor calculations; row-level tenant scoping enforced in application and database policies where practical.

	Search
	PostgreSQL indexes/trigram/full-text for MVP; add OpenSearch/Elasticsearch only when phenotype/search scale requires it.

	Jobs / events
	Durable queue (SQS + workers or Redis/BullMQ equivalent) for matching, document processing, notifications, rule re-evaluation, webhooks.

	Object storage
	S3-compatible encrypted storage for records, diagnostics, permits, certificates, media, invoices; malware scanning on upload.

	Identity
	OIDC/OAuth2; MFA; enterprise SAML/OIDC for research institutions; invite and approval workflows for supplier users.

	Payments
	Marketplace-capable payment/payout processor plus purchase-order / invoice path for enterprise research buyers. Keep provider behind an abstraction layer.

	Observability
	Centralized logs, metrics, traces, error monitoring, audit-event pipeline; correlation ID from UI action through background jobs.

	Deployment
	Containerized cloud deployment; infrastructure as code; separate dev/staging/prod; automated migrations and rollback plan.



Domain boundaries
Identity owns organizations/users; Supply owns animal/listing state; Clinical owns phenotype evidence; Demand owns research requirements; Matching consumes snapshots and produces ranked candidate records; Compliance can block transitions; Commerce owns quote/order/ledger; Logistics owns custody after ready-for-pickup; Audit records every sensitive state change.
14  APIs & integrations
Everything that can arrive as structured data should be ingestible without forcing a producer or research program into manual re-entry.
	Integration
	Purpose

	Supplier API / batch
	Candidate upload, cull-date updates, animal records, treatment history, withdrawal, facility metadata.

	Diagnostic labs
	Order creation, accession ID, result webhook, PDF + structured analytes, specimen chain.

	Veterinary partners
	Assignment dispatch, exam submission, credentials, CVI/permit document exchange where available.

	Payments / payouts
	Authorization, capture, ACH/card, marketplace payouts, refunds, disputes, reconciliation webhooks.

	Carrier / routing
	Rate/availability, dispatch, tracking events, proof of delivery, route exceptions.

	Email/SMS
	Transactional notifications and opt-in alerts; all business-critical actions remain visible in-app.

	Enterprise procurement
	PO number, vendor onboarding package, invoice delivery, optional ERP integration after pilot.

	Research APIs
	Institutional programs can create requests and receive eligible candidate notifications programmatically after access review.



External API rules
• Version APIs from day one; use idempotency keys for creates/payments.
• Signed webhooks with replay protection and delivery logs.
• Never expose supplier research-demand data through APIs.
• Rate limits and organization-scoped keys; service accounts separately permissioned.
• Event payloads use stable IDs and explicit schema versions.
15  Security, privacy & auditability
RAM handles proprietary research plans, farm health records, financial data, and sensitive biosecurity information even though it generally does not handle human PHI.
	Control
	Requirement

	Authentication
	MFA for privileged roles; SSO for enterprise buyers; short-lived sessions/tokens; secure account recovery.

	Authorization
	Least privilege RBAC + attribute checks (organization, facility, order relationship, role, case assignment).

	Tenant isolation
	Organization-scoped queries; automated tests for cross-tenant data leakage; sensitive admin tools separately permissioned.

	Encryption
	TLS in transit; managed encryption at rest; KMS-backed keys; secrets in managed secret store.

	Documents
	Virus/malware scan, type validation, size limits, signed URLs, retention policy, watermarking for selected buyer-visible documents.

	Audit
	Append-only business audit stream for logins, record access, clinical edits, rule overrides, pricing changes, purchases, payouts, clearances, and exports.

	Admin safety
	No shared super-admin account; step-up auth for payouts, pricing rules, supplier suspension, and compliance overrides.

	Backups / DR
	Automated encrypted backups, point-in-time recovery, restore tests, documented RPO/RTO targets before production pilot.

	Secure SDLC
	Dependency scanning, secret scanning, SAST, infrastructure scanning, protected branches, mandatory review, staging tests, incident response plan.



16  Analytics & operational intelligence
Measure marketplace liquidity, welfare outcomes, scientific fit, and unit economics at the same time.
	Metric family
	Key measures

	Supply liquidity
	Eligible candidates/week; % verified; time from submission to matchable; expiration/cull-before-match rate.

	Demand liquidity
	Active research requests; candidates/request; search-to-reservation; reservation-to-purchase; repeat buyer rate.

	Matching
	Median time-to-first-qualified-match; acceptance rate by score band; missing-data burden; substitution rate.

	Operations
	Vet turnaround; clearance time; transport on-time; incident rate; receipt exception rate.

	Economics
	Average buyer price; supplier acquisition; direct costs; gross spread; contribution margin; refunds; CAC by side.

	Welfare
	Animals redirected from cull; healthy-model substitutions reported/estimated by buyer; transport/welfare incidents; emergency interventions.

	Integrity
	Supplier anomaly flags; record conflicts; suspensions; false-positive review rate; attempted prohibited listings.

	Compliance
	Blocked movements, reason codes, permit/CVI lead time, rule overrides, expired approvals caught before checkout.



North-star pilot metric
	Qualified matches successfully delivered
Count only transactions that pass verification and compliance, arrive in acceptable condition, are accepted by the research institution as fitting the requested model, and settle without unresolved welfare/compliance incident.



17  Testing & quality strategy
RAM has ordinary software risks plus rules-engine, financial, welfare, and physical-chain consequences. Test state transitions as aggressively as UI screens.
	Test layer
	Coverage

	Unit tests
	Pricing invariants, eligibility functions, matching components, role permissions, state transition guards.

	Property / invariant tests
	Supplier price never changes when diagnosis severity or buyer price changes; hard-blocked movement can never reach READY_FOR_PICKUP.

	Integration tests
	Payments/webhooks, object storage, notifications, diagnostic results, carrier events, identity provider.

	Workflow tests
	Full happy path and every major failure path: supplier withdrawal, failed vet exam, expired protocol, payment failure, permit denial, weather delay, rejected receipt.

	Security tests
	Authorization matrix, cross-tenant access, upload abuse, webhook replay, session fixation, privilege escalation, audit integrity.

	Rules regression
	Fixture set for each jurisdiction/corridor. When a rule changes, rerun historical cases and show changed outcomes.

	Load tests
	Candidate batch imports, large match requests, high notification volumes, document uploads; focus on predictable operations rather than vanity throughput.

	UAT
	Supplier, scientist, procurement, vet, carrier, RAM ops/compliance/finance scripts before pilot release.



Release gates
• No P0/P1 security findings
• No known path around hard compliance blocks
• Ledger reconciles to payment processor in staging fixtures
• Backup restore demonstrated
• On-call and incident runbooks tested
• Pilot corridor rule set signed off by counsel/veterinary lead
• All roles pass UAT for their core workflow
18  Delivery roadmap
The build sequence follows the physical transaction: identity → listings → requests → matching → checkout → clearance → transfer → settlement.
	Timing
	Milestone
	Deliverables

	Phase 0: 0–2 weeks
	Product/compliance definition
	Finalize pilot species/conditions/states; transaction legal model; standing supplier agreement; researcher purchase terms; canonical state machines; wireframes; data dictionary.

	Phase 1: weeks 3–8
	Foundation
	Auth/orgs/RBAC; supplier onboarding; animal listings; document store; research request builder; RAM manual-match console; audit log; design system.

	Phase 2: weeks 9–16
	Transactional MVP
	Matching v1; quote/order; buyer checkout/PO; supplier acquisition workflow; vet workspace; compliance checklist/rules v1; notifications; ledger; basic analytics.

	Phase 3: months 5–8
	Pilot
	Real producer feeds; diagnostic integration; first corridor transport; incident handling; supplier integrity analytics; researcher UAT; payment reconciliation; operational SOP iteration.

	Phase 4: months 9–12
	Scale-ready
	Rules versioning UI; multi-state expansion; enterprise SSO/API; supplier batch/API; procurement workflows; matching v2 evaluation; second phenotype/species planning.



Suggested sprint cadence
Two-week engineering sprints with weekly product/ops review. Compliance rules and operational SOPs are reviewed continuously rather than postponed to “launch.” Every sprint should ship a vertically testable slice to staging, with feature flags for incomplete workflows.
19  Team & operating model
A lean multidisciplinary launch team can build the platform while external specialists cover regulated edge cases.
	Role
	Primary responsibility

	Product lead / founder
	Business rules, supplier/researcher interviews, prioritization, partnerships, pilot success criteria.

	Engineering lead
	Architecture, domain model, security, integration strategy, review standards, production readiness.

	2–3 full-stack engineers
	Web apps, APIs, matching, commerce, ops tools, test automation.

	Product designer
	Supplier/researcher/vet workflows, design system, usability, complex state UX.

	Marketplace ops lead
	Manual matching, vet/carrier coordination, support, exception playbooks, SOPs.

	Veterinary lead / advisor
	Phenotype schemas, exam templates, transport fitness, welfare escalation, biosecurity.

	Regulatory / animal-law counsel
	Dealer/broker/reseller classification, movement rules, contracts, state licensing, AWA analysis.

	Finance / payments advisor (part-time)
	Ledger design, payout controls, tax/vendor onboarding, reconciliation.



	Do not automate uncertainty away
During the pilot, keep RAM operations staff in the loop. Every manual exception should produce structured data that later tells engineering what is safe and valuable to automate.



20  Pilot design & KPIs
The first pilot should test the transaction model, not prove every future species, state, and disease category.
Pilot shape
• One species: swine.
• 1–3 producer organizations with enough volume to create regular cull candidates.
• A small set of phenotype families selected jointly with veterinary and research partners.
• Prefer intrastate or pre-cleared movement corridors; exclude reportable/high-risk communicable conditions.
• 3–10 research programs that already use swine/large-animal models and can articulate inclusion criteria.
• Manual operational support behind the software to protect welfare and learn the real edge cases.
Pilot decision thresholds
	Dimension
	Go / iterate signal

	Liquidity
	At least one qualified candidate appears often enough for target requests to justify the marketplace rather than custom sourcing.

	Buyer value
	Researchers accept the naturally occurring phenotype and repeat or expand requests.

	Supplier value
	Producers participate at standardized cull pricing without needing research-demand premiums.

	Economics
	Buyer price minus acquisition and direct transaction costs supports a credible positive contribution margin.

	Operations
	Verification and clearance complete within the useful cull/research window.

	Welfare / compliance
	No systemic increase in untreated suffering or suspicious condition incidence; movements remain within approved rules.

	Product
	Most standard transactions complete end-to-end in the platform without spreadsheets/email as the system of record.



21  Open decisions / pre-launch diligence
These decisions should be resolved before RAM accepts a live-animal transaction; the software is designed so answers can be configured rather than rebuilt.
	Decision
	Question to resolve

	Legal title
	At what exact event does RAM become owner: buyer checkout, supplier acceptance, final clearance, pickup, or another point? Who bears loss before/after custody?

	Marketplace classification
	Which federal/state dealer, broker, livestock market, or animal-dealer licenses apply to RAM’s exact model?

	Eligible pilot phenotypes
	Which conditions are scientifically valuable, welfare-compatible, non-reportable/non-prohibited, and practical to verify within the cull window?

	Supplier schedule
	What acquisition schedule is attractive enough to recover cull value while remaining clearly below any research-market signal?

	Buyer pricing
	Fixed catalog, algorithmic quote, enterprise schedule, or negotiated quote by phenotype/service?

	Clearance ownership
	Which checks are RAM responsibility versus supplier, vet, carrier, and buyer institution?

	Rejected delivery
	What happens if the research facility rejects an animal on arrival? Care, quarantine, return, alternate placement, or euthanasia authority must be explicit.

	Insurance
	Transit, animal mortality, professional liability, product/service liability, cyber, and errors/omissions requirements.

	Research data feedback
	What minimum post-receipt outcome data can RAM collect to improve matching without requiring confidential study results?



22  Source notes
External benchmarks and regulatory sources used in this plan. Regulatory requirements must be rechecked for each live transaction and pilot jurisdiction.
	#
	Source
	URL / use

	1
	USDA Agricultural Marketing Service — National Daily Hog and Pork Summary / National Daily Direct Hog Prior Day Report (Oct. 5, 2026)
	https://www.ams.usda.gov/mnreports/lsddhps.pdf
Current live/carcass hog benchmarks and weights.

	2
	National Swine Resource and Research Center — Distribution Fees (effective Feb. 25, 2026)
	https://nsrrc.missouri.edu/fees/
Examples of academic research-swine distribution/model costs.

	3
	National Swine Resource and Research Center — About / biomedical swine resource
	https://nsrrc.missouri.edu/
Established biomedical use of swine and model-resource context.

	4
	USDA APHIS — Transporting Animals in Commerce
	https://www.aphis.usda.gov/animal-care/awa-services/transporting-animals-commerce
AWA transport context and carrier/handler requirements where applicable.

	5
	USDA APHIS NVAP — Interstate Regulations
	https://www.aphis.usda.gov/nvap/reference-guide/animal-movement/interstate-regulations
Federal/state animal-movement framework, CVIs, state entry requirements, diseased-animal warning.

	6
	Electronic Code of Federal Regulations — 9 CFR § 71.3
	https://www.ecfr.gov/current/title-9/chapter-I/subchapter-C/part-71/section-71.3
Interstate movement of diseased animals generally prohibited, with specified exceptions.

	7
	NIH Office of Laboratory Animal Welfare
	https://olaw.nih.gov/
PHS-supported research animal welfare and institutional compliance context.



Implementation note
This development plan intentionally separates the software architecture from unresolved legal classification. The platform can support different title-transfer, licensing, payment, and clearance configurations once counsel and veterinary experts finalize the pilot model.
RAM Corporation — save two pigs with one coin.
RAM Corporation  |  Development Plan     
