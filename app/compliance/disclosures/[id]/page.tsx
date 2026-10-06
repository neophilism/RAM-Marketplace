import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getRamDisclosureRequest } from "@/lib/server/disclosures";

export const dynamic = "force-dynamic";

export default async function RamDisclosureReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const request = await getRamDisclosureRequest(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM disclosure review · {request.id}</div>
          <h1>{request.animalCaseId}</h1>
          <p>{request.condition} · {request.researchNeedTitle}</p>
        </div>
        <span className="status">{request.status.replaceAll("_", " ")}</span>
      </div>

      <div className="privacyBanner">
        <strong>Decision surface minimizes identity bias.</strong>
        <span>
          RAM reviews the scientific reason, requested fields, transaction milestone
          and farm permission policy. Buyer identity is not needed for this decision.
        </span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Request</h2>
          <p>{request.scientificReason}</p>
          <h3>Fields requested</h3>
          <ul>{request.requestedFields.map((field) => <li key={field}>{field.replaceAll("_", " ")}</li>)}</ul>
        </article>

        <article className="panel">
          <h2>Policy context</h2>
          <dl>
            <div><dt>Listing disclosure tier</dt><dd>{request.sourceDisclosure.replaceAll("_", " ")}</dd></div>
            <div><dt>Transaction milestone</dt><dd>{request.buyerMilestone.replaceAll("_", " ")}</dd></div>
            <div><dt>Husbandry fact available</dt><dd>{request.availableFacts.generalHusbandry ? "Yes" : "No"}</dd></div>
            <div><dt>County fact available</dt><dd>{request.availableFacts.county ? "Yes" : "No"}</dd></div>
            <div><dt>Farm identity available</dt><dd>{request.availableFacts.farmIdentity ? "Yes" : "No"}</dd></div>
          </dl>
          <h3>Standing farm permissions</h3>
          <ul>
            <li>General husbandry: {request.farmPolicy.shareGeneralHusbandry ? "pre-authorized" : "case approval required"}</li>
            <li>County after NDA: {request.farmPolicy.shareCountyAfterNda ? "pre-authorized" : "case approval required"}</li>
            <li>Identity before purchase: {request.farmPolicy.shareIdentityPrePurchase ? "pre-authorized" : "not pre-authorized"}</li>
            <li>Identity after purchase: {request.farmPolicy.shareIdentityPostPurchase ? "pre-authorized" : "case approval required"}</li>
          </ul>
        </article>
      </div>

      {request.status === "PENDING_RAM_REVIEW" && (
        <form className="panel" action={"/api/compliance/disclosures/" + request.id + "/review"} method="post">
          <h2>RAM relevance decision</h2>
          <p>
            Approval means the request is relevant enough to continue through the
            permission policy. It does not itself disclose source data.
          </p>
          <label>
            <span>Denial reason</span>
            <textarea name="denialReason" rows={4} placeholder="Required if denying the request." />
          </label>
          <div className="formActions">
            <button className="secondaryButton" name="decision" value="DENY" type="submit">Deny request</button>
            <button className="primaryButton" name="decision" value="APPROVE" type="submit">Approve relevance</button>
          </div>
        </form>
      )}

      <div className="formActions">
        <Link className="secondaryButton" href="/compliance/disclosures">Back to disclosure queue</Link>
      </div>
    </section>
  );
}
