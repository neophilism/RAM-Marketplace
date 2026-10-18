# RAM-01 Phase 0 data dictionary and ownership

Status: engineering crosswalk at the RAM-01 PR head. This is not a signed legal, veterinary, privacy, or financial decision. The Prisma schema and server authorization code remain the executable sources; this document identifies fields that product reviewers must resolve before a real pilot.

| Concept / record | Canonical fields and meaning | Classification / permitted audience | Source of truth and open decision |
| --- | --- | --- | --- |
| Organization | `id`, `type`, `status`; distinct farm, researcher, carrier, vet, and RAM organizations | Organization identity; scoped members and RAM access | `Organization`, `OrganizationVerification`; real institution verification remains open (P0-03) |
| User membership | User identity plus organization, role and active status; never a single global role | Account and access data; subject and authorized administrators | `User`, `Membership`, `ExternalIdentity`; identity proof and suspension are runtime gates |
| Farm site | Facility linked to a supplier organization | Restricted source | `FarmSite`; jurisdiction, contacts, and movement corridor require P0-01/P0-05 decisions |
| Animal case | `publicId`, species, condition, phenotype/evidence, generalized region, status and public summary | Anonymized marketplace projection only after eligibility and disclosure review | `AnimalCase`; reviewer must decide permitted condition families (P0-01) |
| Animal source | `animalCaseId`, farm site, exact address, legal owner/contact, local vet and private history | Restricted supplier/RAM compliance and minimum-necessary operational use; never a researcher search result | `AnimalSourceRecord`; retention and de-identification need P0-09 |
| Cull provenance | Independent cull timing/reason and source evidence before buyer demand is disclosed | Restricted integrity evidence; RAM review | `CullEvent`; independent cull evidence and welfare signoff need P0-04 |
| Veterinary review | Examination, diagnostic and fitness evidence associated with an animal | Sensitive animal/source evidence; authorized vet and RAM compliance | `VeterinaryReview`; authority, movement documents and exclusion rules need P0-05 |
| Research need | Requesting organization, protocol status, phenotype, inclusion/exclusion criteria, timeline and optional budget | Research organization and assigned RAM roles; budget not exposed to supplier acquisition | `ResearchNeed`; institutional protocol verification needs P0-03 |
| Research match | Candidate-to-need score and explanation after hard eligibility filters | Researcher projection omits source identity and supplier economics | `ResearchMatch`, matching service; missing evidence must remain explicit |
| Disclosure request | Requested fields, purpose, review and release state | Requester sees authorized release only; source-side approvers see restricted data | `DisclosureRequest`, `FarmDisclosurePolicy`; disclosure/retention decision P0-09 |
| Order | Buyer, case, need, lifecycle status, buyer quote, independent supplier policy snapshot and clearance times | Split buyer, supplier, finance and compliance projections | `Order`; title transfer is deliberately not inferred from `status` (P0-02) |
| Supplier policy | Species schedule, market ceiling, effective state and approver | Finance/RAM authorized only; not derived from buyer budget or diagnosis | `SupplierPricingPolicy`, `lib/pricing.ts`; approved schedule P0-07 |
| Clearance | Protocol, receiving, welfare, biosecurity, movement, transport and provenance checks | RAM compliance and evidence-limited parties | `OrderClearance`, `lib/transaction-policy.ts`; corridor rules P0-01/P0-05 |
| Transport | Assignment, custody events and incident information | Carrier gets minimum required pickup/delivery data | `TransportAssignment`, `TransportEvent`; route and custody authority P0-05/P0-10 |
| Receipt | Institutional inspection separate from carrier delivery | Receiving institution and authorized RAM roles | `ReceiptInspection`; rejection and care allocation P0-06/P0-10 |
| Settlement | Buyer receivable, supplier payable, direct costs, ledger movements and reconciliation | RAM finance; buyer/supplier each receive scoped projections | `FinancialSettlement`, `FinancialLedgerEntry`; provider and refund decisions P0-08 |
| Audit | Actor, organization, action, entity, prior/next state, reason and correlation | Restricted operations/audit roles | `AuditEvent`; retention and export policy P0-09 |

## Cross-record invariants

1. An `AnimalCase` identifier may be public; its one-to-one `AnimalSourceRecord` is a separate restricted join. Public and buyer-facing code must use an allowlisted projection.
2. `Order.buyerPriceCents` and the supplier schedule/ceiling are separate inputs. `supplierAcquisitionCents` is derived only from schedule and ceiling; a match score, diagnosis or buyer budget cannot affect it.
3. `Order.status` records software workflow. It does not by itself prove title, legal ownership, custody, veterinary clearance, animal-use authority or payment settlement.
4. `DELIVERED` is carrier delivery. `ACCEPTED` requires a separate receiving inspection. `SETTLED` and `CLOSED` require ledger and reconciliation evidence.
5. Every real-corridor configuration must carry approver, authority, version, effective interval, jurisdiction and evidence reference. An unset approval remains blocked.

## Review before pilot

The owner, veterinary lead, counsel, finance and operations must resolve P0-01 through P0-10 in `PHASE0_DECISION_REGISTER.md`. These are external acceptance records; a passing test or this dictionary cannot supply them.
