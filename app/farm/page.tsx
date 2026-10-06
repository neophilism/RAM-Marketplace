import Link from "next/link";
import { can } from "@/lib/access";
import { requireSession } from "@/lib/auth/session";
import { dataBackend } from "@/lib/server/db";
import {
  getFarmDisclosurePolicy,
  listSupplierDisclosureQueue
} from "@/lib/server/disclosures";
import { listFarmCases } from "@/lib/server/repositories";

export const dynamic = "force-dynamic";

export default async function FarmPage() {
  const session = await requireSession();
  const cases = await listFarmCases(session);
  const backend = dataBackend();
  const canApproveDisclosures = can(session.role, "disclosure:supplier_review");
  const [policy, requests] = canApproveDisclosures
    ? await Promise.all([
        getFarmDisclosurePolicy(session),
        listSupplierDisclosureQueue(session)
      ])
    : [null, []];

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Private farm portal</div>
          <h1>Your animal cases</h1>
          <p>Your farm identity is never presented as a public seller profile.</p>
        </div>
        <Link className="primaryButton" href="/farm/new">Report an animal</Link>
      </div>

      <div className="privacyBanner">
        <strong>Source protection is on.</strong>
        <span>Scientists see RAM animal IDs and approved scientific information—not your farm name, logo, address, or seller profile.</span>
      </div>

      <div className="prototypeBanner">
        <strong>{backend === "postgres" ? "Durable PostgreSQL storage active." : "Prototype storage active."}</strong>{" "}
        {backend === "postgres"
          ? "Animal submissions, cull provenance and audit events persist in the database."
          : "Set DATABASE_URL and RAM_DATA_BACKEND=postgres to enable durable persistence."}
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Animal</span><span>Condition</span><span>Status</span><span>Next step</span></div>
        {cases.length === 0 ? (
          <div className="emptyState">No cases yet. Report the first animal selected for culling.</div>
        ) : cases.map((item) => (
          <div className="tableRow" key={item.id}>
            <strong>{item.id}</strong>
            <span>{item.condition}</span>
            <span className="status">{item.status.replaceAll("_", " ")}</span>
            <span>{item.action}</span>
          </div>
        ))}
      </div>

      {canApproveDisclosures && policy && (
        <div className="detailGrid">
          <article className="panel">
            <h2>Standing disclosure permissions</h2>
            <p>
              These settings define what RAM may release without asking you again.
              A setting left off can still be approved case-by-case when you receive
              a relevant request.
            </p>
            <form action="/api/farm/disclosure-policy" method="post">
              <label className="checkLine">
                <input
                  type="checkbox"
                  name="shareGeneralHusbandry"
                  defaultChecked={policy.shareGeneralHusbandry}
                />
                General husbandry details may be shared after RAM relevance review
              </label>
              <label className="checkLine">
                <input
                  type="checkbox"
                  name="shareCountyAfterNda"
                  defaultChecked={policy.shareCountyAfterNda}
                />
                County may be shared after NDA
              </label>
              <label className="checkLine">
                <input
                  type="checkbox"
                  name="shareIdentityPrePurchase"
                  defaultChecked={policy.shareIdentityPrePurchase}
                />
                Farm legal identity may be shared before purchase
              </label>
              <label className="checkLine">
                <input
                  type="checkbox"
                  name="shareIdentityPostPurchase"
                  defaultChecked={policy.shareIdentityPostPurchase}
                />
                Farm legal identity may be shared after buyer commitment
              </label>
              <div className="formActions">
                <button className="secondaryButton" type="submit">Save disclosure policy</button>
              </div>
            </form>
            <p className="finePrint">
              Exact source address, owner contacts, local veterinarian identity and
              supplier economics are not released by this source-information workflow.
            </p>
          </article>

          <article className="panel">
            <h2>Pending information requests</h2>
            {requests.length === 0 ? (
              <p className="emptyState">No requests currently require your approval.</p>
            ) : requests.map((request) => (
              <div className="requestDecision" key={request.id}>
                <div className="eyebrow">{request.animalCaseId}</div>
                <strong>{request.requestedFields.join(", ").replaceAll("_", " ")}</strong>
                <p>{request.scientificReason}</p>
                <form action={"/api/farm/disclosures/" + request.id + "/review"} method="post">
                  <label>
                    <span>Reason if denying</span>
                    <textarea
                      name="denialReason"
                      rows={2}
                      placeholder="Required only when denying."
                    />
                  </label>
                  <div className="formActions">
                    <button className="secondaryButton" type="submit" name="decision" value="DENY">Deny</button>
                    <button className="primaryButton" type="submit" name="decision" value="APPROVE">Approve requested facts</button>
                  </div>
                </form>
              </div>
            ))}
          </article>
        </div>
      )}

      {!canApproveDisclosures && (
        <article className="panel">
          <h2>Disclosure permissions</h2>
          <p>Only a farm owner/administrator can change standing disclosure permissions or approve case-specific requests.</p>
        </article>
      )}
    </section>
  );
}
