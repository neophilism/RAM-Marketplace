import { can } from "@/lib/access";
import { requireSession } from "@/lib/auth/session";
import { getBuyerOrder } from "@/lib/server/transactions";

export const dynamic = "force-dynamic";

function money(cents: number | null) {
  return cents == null ? "—" : "$" + (cents / 100).toLocaleString();
}

export default async function OrderPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const order = await getBuyerOrder(session, id);
  const canCommit = can(session.role, "order:buyer_commit");
  const cancellable = ["DRAFT", "CANDIDATE_HELD", "CHECKOUT_PENDING", "BUYER_COMMITTED"].includes(order.status);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Order · {order.id}</div>
          <h1>{order.condition}</h1>
          <p>{order.animalCaseId} · {order.species} · research need {order.researchNeedId}</p>
        </div>
        <span className="status">{order.status.replaceAll("_", " ")}</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Buyer quote</h2>
          <dl>
            <div><dt>Quoted total</dt><dd>{money(order.buyerPriceCents)}</dd></div>
            <div><dt>Quote expires</dt><dd>{order.quoteExpiresAt ? new Date(order.quoteExpiresAt).toLocaleString() : "—"}</dd></div>
            <div><dt>Reservation hold expires</dt><dd>{order.holdExpiresAt ? new Date(order.holdExpiresAt).toLocaleString() : "—"}</dd></div>
          </dl>
          <h3>Quote components</h3>
          <ul>
            {Object.entries(order.buyerPriceComponents).map(([name, cents]) => (
              <li key={name}>{name.replaceAll(/([A-Z])/g, " $1")}: {money(cents)}</li>
            ))}
          </ul>
          <p className="finePrint">Supplier acquisition pricing is calculated separately and is not exposed in the buyer quote.</p>
        </article>

        <article className="panel">
          <h2>Receiving & institutional details</h2>
          <dl>
            <div><dt>Facility</dt><dd>{order.receivingFacilityName ?? "Not yet committed"}</dd></div>
            <div><dt>Protocol reference</dt><dd>{order.protocolReference ?? "Not yet committed"}</dd></div>
            <div><dt>Buyer commitment</dt><dd>{order.buyerCommittedAt ? new Date(order.buyerCommittedAt).toLocaleString() : "Pending"}</dd></div>
            <div><dt>RAM acquisition</dt><dd>{order.acquisitionCommitted ? "Committed" : "Pending"}</dd></div>
            <div><dt>Clearance</dt><dd>{order.clearanceDecision ?? "Not started"}</dd></div>
            <div><dt>Receiving decision</dt><dd>{order.receiptDecision ?? "Pending delivery / inspection"}</dd></div>
            <div><dt>Receiving inspected</dt><dd>{order.receiptInspectedAt ? new Date(order.receiptInspectedAt).toLocaleString() : "Pending"}</dd></div>
          </dl>
        </article>
      </div>

      {order.status === "CHECKOUT_PENDING" && (
        <article className="panel">
          <h2>Commit to purchase</h2>
          {canCommit ? (
            <form className="formStack" action={"/api/orders/" + order.id + "/commit"} method="post">
              <div className="formGrid">
                <label><span>Receiving facility name *</span><input name="receivingFacilityName" required /></label>
                <label><span>Protocol / IACUC reference *</span><input name="protocolReference" required /></label>
                <label className="span2"><span>Receiving facility address *</span><input name="receivingFacilityAddress" required /></label>
                <label className="span2 checkCard">
                  <input type="checkbox" name="institutionalApprovalAttested" required />
                  <span>I attest that the institution has authorized this animal-model acquisition under the referenced protocol or equivalent approval process.</span>
                </label>
                <label className="span2 checkCard">
                  <input type="checkbox" name="purchasingAuthorityAttested" required />
                  <span>I attest that I am authorized to commit this organization to the quoted purchase.</span>
                </label>
              </div>
              <div className="formActions">
                <button className="primaryButton" type="submit">Commit to quoted purchase</button>
              </div>
            </form>
          ) : (
            <p>This quote requires a user with research procurement / quote-approval authority to commit the organization.</p>
          )}
        </article>
      )}

      {order.status === "BUYER_COMMITTED" && (
        <div className="privacyBanner">
          <strong>Buyer commitment recorded.</strong>
          <span>RAM now calculates and commits the farm-side acquisition independently, without using your quoted price or identity as an input.</span>
        </div>
      )}

      {order.status === "CLEARANCE_PENDING" && (
        <div className="privacyBanner">
          <strong>RAM acquisition committed.</strong>
          <span>The order is now in compliance clearance. No pickup may occur until every blocking gate is cleared.</span>
        </div>
      )}

      {order.status === "READY_FOR_PICKUP" && (
        <div className="privacyBanner">
          <strong>Cleared for pickup.</strong>
          <span>Commercial and compliance gates are complete. Transport workflow is the next phase.</span>
        </div>
      )}

      {order.status === "DELIVERED" && (
        <div className="privacyBanner">
          <strong>Delivered to receiving facility.</strong>
          <span>Carrier handoff is complete. The institution&apos;s receiving/compliance role must separately inspect and accept or reject intake.</span>
        </div>
      )}

      {order.status === "ACCEPTED" && (
        <div className="privacyBanner">
          <strong>Institutional intake accepted.</strong>
          <span>The receiving inspection passed and the associated research need may enter its in-study phase.</span>
        </div>
      )}

      {order.status === "REJECTED_AT_RECEIPT" && (
        <article className="panel">
          <h2>Rejected at receipt</h2>
          <p>{order.receiptDiscrepancyNotes ?? "The receiving inspection documented a blocking discrepancy."}</p>
          <p className="finePrint">The research need remains unstarted while the rejection proceeds to later dispute/replacement/refund handling.</p>
        </article>
      )}

      {order.status === "CLEARANCE_FAILED" && (
        <article className="panel">
          <h2>Clearance failed</h2>
          <p>{order.clearanceNotes ?? "A blocking compliance finding prevents this order from proceeding."}</p>
        </article>
      )}

      {cancellable && (
        <form action={"/api/orders/" + order.id + "/cancel"} method="post">
          <button className="secondaryButton" type="submit">Cancel reservation / order</button>
        </form>
      )}
    </section>
  );
}
