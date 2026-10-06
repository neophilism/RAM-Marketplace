import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getFinancialSettlement } from "@/lib/server/settlements";

export const dynamic = "force-dynamic";

function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return sign + "$" + (Math.abs(cents) / 100).toLocaleString();
}

export default async function SettlementPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const settlement = await getFinancialSettlement(session, id);

  const balancesClear =
    settlement.buyerOutstandingCents === 0 &&
    settlement.supplierOutstandingCents === 0;

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Financial settlement · {settlement.id}</div>
          <h1>{settlement.animalCaseId}</h1>
          <p>{settlement.species} · {settlement.condition} · order {settlement.orderId}</p>
        </div>
        <span className="status">{settlement.settlementStatus}</span>
      </div>

      <div className="privacyBanner">
        <strong>Pricing separation preserved.</strong>
        <span>The supplier payable shown here is the immutable acquisition amount previously calculated from the independent species policy. This workspace can record payment, but cannot reprice the farmer from buyer value.</span>
      </div>

      <div className="metricGrid">
        <article><strong>{money(settlement.buyerReceivableCents)}</strong><span>Buyer receivable</span></article>
        <article><strong>{money(settlement.buyerOutstandingCents)}</strong><span>Buyer outstanding</span></article>
        <article><strong>{money(settlement.supplierPayableCents)}</strong><span>Supplier payable</span></article>
        <article><strong>{money(settlement.supplierOutstandingCents)}</strong><span>Supplier outstanding</span></article>
        <article><strong>{money(settlement.directCostsCents)}</strong><span>Direct costs</span></article>
        <article><strong>{money(settlement.grossSpreadCents)}</strong><span>Gross spread snapshot</span></article>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Supplier acquisition snapshot</h2>
          <dl>
            <div><dt>Standardized cull schedule</dt><dd>{money(settlement.supplierScheduleCents)}</dd></div>
            <div><dt>Market ceiling</dt><dd>{money(settlement.supplierMarketCeilingCents)}</dd></div>
            <div><dt>Committed supplier payable</dt><dd>{money(settlement.supplierPayableCents)}</dd></div>
            <div><dt>Formula</dt><dd>lower of schedule and market ceiling</dd></div>
          </dl>
        </article>

        <article className="panel">
          <h2>Settlement state</h2>
          <dl>
            <div><dt>Order</dt><dd>{settlement.orderStatus.replaceAll("_", " ")}</dd></div>
            <div><dt>Financial ledger</dt><dd>{settlement.settlementStatus}</dd></div>
            <div><dt>Opened</dt><dd>{new Date(settlement.openedAt).toLocaleString()}</dd></div>
            <div><dt>Settled</dt><dd>{settlement.settledAt ? new Date(settlement.settledAt).toLocaleString() : "Pending"}</dd></div>
            <div><dt>Closed</dt><dd>{settlement.closedAt ? new Date(settlement.closedAt).toLocaleString() : "Pending reconciliation"}</dd></div>
          </dl>
        </article>
      </div>

      {settlement.settlementStatus === "OPEN" && (
        <div className="detailGrid">
          <article className="panel">
            <h2>Record buyer payment</h2>
            <p>Partial payments are allowed. The ledger prevents recording more than the outstanding receivable.</p>
            <form className="formStack" action={"/api/finance/settlements/" + settlement.id + "/movement"} method="post">
              <input type="hidden" name="movementType" value="BUYER_PAYMENT" />
              <label><span>Amount (USD) *</span><input name="amountUsd" type="number" min="0.01" step="0.01" max={settlement.buyerOutstandingCents / 100} required /></label>
              <label><span>External / bank / processor reference *</span><input name="externalReference" required /></label>
              <label><span>Notes</span><textarea name="notes" rows={3} /></label>
              <button className="primaryButton" type="submit" disabled={settlement.buyerOutstandingCents === 0}>Record buyer payment</button>
            </form>
          </article>

          <article className="panel">
            <h2>Record supplier payout</h2>
            <p>The amount due is fixed by the earlier independent acquisition commitment, not by the buyer price.</p>
            <form className="formStack" action={"/api/finance/settlements/" + settlement.id + "/movement"} method="post">
              <input type="hidden" name="movementType" value="SUPPLIER_PAYOUT" />
              <label><span>Amount (USD) *</span><input name="amountUsd" type="number" min="0.01" step="0.01" max={settlement.supplierOutstandingCents / 100} required /></label>
              <label><span>External / bank / processor reference *</span><input name="externalReference" required /></label>
              <label><span>Notes</span><textarea name="notes" rows={3} /></label>
              <button className="primaryButton" type="submit" disabled={settlement.supplierOutstandingCents === 0}>Record supplier payout</button>
            </form>
          </article>
        </div>
      )}

      {settlement.settlementStatus === "OPEN" && balancesClear && (
        <article className="panel">
          <h2>Finalize financial settlement</h2>
          {settlement.orderStatus === "ACCEPTED" ? (
            <>
              <p>Buyer receivable and supplier payable are both fully satisfied. Finalizing advances the order from ACCEPTED to SETTLED.</p>
              <form action={"/api/finance/settlements/" + settlement.id + "/finalize"} method="post">
                <button className="primaryButton" type="submit">Finalize settlement</button>
              </form>
            </>
          ) : (
            <p>All balances are clear, but the order cannot settle until the buyer institution has accepted the delivered animal.</p>
          )}
        </article>
      )}

      {settlement.settlementStatus === "SETTLED" && (
        <article className="panel">
          <h2>Reconcile and close</h2>
          <p>Closing confirms that the ledger agrees with the external accounting/payment records. The close action does not change the study lifecycle.</p>
          <form className="formStack" action={"/api/finance/settlements/" + settlement.id + "/close"} method="post">
            <label><span>Reconciliation reference *</span><input name="reconciliationReference" required placeholder="Bank batch, processor settlement, or accounting reference" /></label>
            <label><span>Reconciliation notes</span><textarea name="reconciliationNotes" rows={4} /></label>
            <label className="checkCard">
              <input type="checkbox" name="reconciliationAttestation" required />
              <span>I attest that the buyer receivable, supplier payout, and recorded external references reconcile to the financial records for this order.</span>
            </label>
            <button className="primaryButton" type="submit">Close reconciled order</button>
          </form>
        </article>
      )}

      {settlement.settlementStatus === "CLOSED" && (
        <div className="privacyBanner">
          <strong>Reconciled and closed.</strong>
          <span>{settlement.reconciliationReference ?? "Reconciliation recorded"}{settlement.reconciliationNotes ? " · " + settlement.reconciliationNotes : ""}</span>
        </div>
      )}

      <article className="panel">
        <h2>Append-only ledger</h2>
        <div className="tableCard">
          <div className="tableRow tableHead"><span>Event</span><span>Amount</span><span>Reference</span><span>Recorded</span></div>
          {settlement.entries.map((entry) => (
            <div className="tableRow" key={entry.id}>
              <strong>{entry.type.replaceAll("_", " ")}</strong>
              <span>{money(entry.amountCents)}</span>
              <span>{entry.externalReference ?? "Snapshot"}</span>
              <span>{new Date(entry.occurredAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </article>

      <Link className="secondaryButton" href="/finance">Back to finance</Link>
    </section>
  );
}
