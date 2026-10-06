import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getOrderDispute } from "@/lib/server/disputes";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return "$" + (cents / 100).toLocaleString();
}

export default async function DisputePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const dispute = await getOrderDispute(session, id);

  const fullyUnwound =
    dispute.buyerCreditsCents === dispute.buyerReceivableCents &&
    dispute.buyerOutstandingCents === 0 &&
    dispute.buyerRefundDueCents === 0 &&
    dispute.supplierOutstandingCents === 0;

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Order dispute · {dispute.id}</div>
          <h1>{dispute.animalCaseId}</h1>
          <p>{dispute.species} · {dispute.condition} · order {dispute.orderId}</p>
        </div>
        <span className="status">{dispute.status}</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Receiving rejection</h2>
          <dl>
            <div><dt>Receipt decision</dt><dd>{dispute.receiptDecision ?? "Rejected"}</dd></div>
            <div><dt>Order state</dt><dd>{dispute.orderStatus.replaceAll("_", " ")}</dd></div>
            <div><dt>Opened</dt><dd>{new Date(dispute.openedAt).toLocaleString()}</dd></div>
            <div><dt>Research need</dt><dd>{dispute.researchNeedTitle} · {dispute.researchNeedStatus.replaceAll("_", " ")}</dd></div>
          </dl>
          <h3>Blocking discrepancy</h3>
          <p>{dispute.receiptDiscrepancyNotes ?? dispute.reason}</p>
        </article>

        <article className="panel">
          <h2>Financial position</h2>
          <dl>
            <div><dt>Original buyer receivable</dt><dd>{money(dispute.buyerReceivableCents)}</dd></div>
            <div><dt>Buyer credits</dt><dd>{money(dispute.buyerCreditsCents)}</dd></div>
            <div><dt>Buyer paid</dt><dd>{money(dispute.buyerPaidCents)}</dd></div>
            <div><dt>Buyer refunded</dt><dd>{money(dispute.buyerRefundedCents)}</dd></div>
            <div><dt>Buyer outstanding</dt><dd>{money(dispute.buyerOutstandingCents)}</dd></div>
            <div><dt>Refund due</dt><dd>{money(dispute.buyerRefundDueCents)}</dd></div>
            <div><dt>Supplier payable</dt><dd>{money(dispute.supplierPayableCents)}</dd></div>
            <div><dt>Supplier outstanding</dt><dd>{money(dispute.supplierOutstandingCents)}</dd></div>
          </dl>
          {dispute.financialSettlementId ? (
            <Link className="secondaryButton" href={"/finance/settlements/" + dispute.financialSettlementId}>Open financial ledger</Link>
          ) : null}
        </article>
      </div>

      {dispute.status === "OPEN" && (
        <>
          <div className="privacyBanner">
            <strong>Resolution rules.</strong>
            <span>Acceptance keeps this animal and starts the study. Replacement fully unwinds this order and reopens the research need for rematching. Refund fully unwinds the order and closes the research need. Replacement/refund require a full buyer credit, any resulting cash refund, and supplier payout to be complete.</span>
          </div>

          <article className="panel">
            <h2>Resolve dispute</h2>
            <form className="formStack" action={"/api/ops/disputes/" + dispute.id + "/resolve"} method="post">
              <label>
                <span>Resolution *</span>
                <select name="resolutionType" required>
                  <option value="ACCEPT_AS_IS">Accept existing animal after review</option>
                  <option value="ACCEPT_WITH_CREDIT">Accept existing animal with buyer credit</option>
                  <option value="REPLACEMENT" disabled={!fullyUnwound}>Replacement — reopen research need</option>
                  <option value="REFUND" disabled={!fullyUnwound}>Refund — close research need</option>
                </select>
              </label>
              <label><span>Resolution rationale *</span><textarea name="resolutionNotes" minLength={20} rows={6} required /></label>
              <label className="checkCard">
                <input type="checkbox" name="operatorAttestation" required />
                <span>I attest that the resolution matches the receiving findings, financial ledger, and approved RAM exception policy.</span>
              </label>
              <button className="primaryButton" type="submit">Resolve dispute</button>
            </form>
          </article>
        </>
      )}

      {dispute.status === "RESOLVED" && (
        <article className="panel">
          <h2>Resolved</h2>
          <dl>
            <div><dt>Resolution</dt><dd>{dispute.resolutionType?.replaceAll("_", " ") ?? "Recorded"}</dd></div>
            <div><dt>Resolved</dt><dd>{dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleString() : "Recorded"}</dd></div>
            <div><dt>Notes</dt><dd>{dispute.resolutionNotes ?? "None"}</dd></div>
          </dl>
        </article>
      )}

      <Link className="secondaryButton" href="/ops/disputes">Back to disputes</Link>
    </section>
  );
}
