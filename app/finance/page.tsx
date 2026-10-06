import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  listFinanceOrders,
  listSupplierPricingPolicies
} from "@/lib/server/transactions";
import { listFinancialSettlements } from "@/lib/server/settlements";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return "$" + (cents / 100).toLocaleString();
}

export default async function FinancePage() {
  const session = await requireSession();
  const [orders, policies, settlements] = await Promise.all([
    listFinanceOrders(session),
    listSupplierPricingPolicies(session),
    listFinancialSettlements(session)
  ]);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM finance</div>
          <h1>Independent supplier acquisition</h1>
          <p>Farm-side acquisition is calculated only from the pre-established species policy. Buyer identity, buyer budget, buyer quote, diagnosis, rarity and match score are deliberately absent from this decision surface.</p>
        </div>
      </div>

      <div className="formActions">
        <Link className="secondaryButton" href="/finance/payment-profiles">
          Payment routing profiles
        </Link>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Create supplier pricing policy</h2>
          <form className="formStack" action="/api/finance/pricing-policies" method="post">
            <div className="formGrid">
              <label><span>Species *</span><input name="species" required placeholder="e.g. Swine" /></label>
              <label><span>Standardized cull schedule (USD) *</span><input name="standardizedCullScheduleUsd" type="number" min="0" step="0.01" required /></label>
              <label><span>Market ceiling (USD) *</span><input name="marketCeilingUsd" type="number" min="0" step="0.01" required /></label>
            </div>
            <div className="formActions"><button className="primaryButton" type="submit">Activate policy</button></div>
          </form>
        </article>

        <article className="panel">
          <h2>Policy rule</h2>
          <p>Supplier acquisition = the lower of the standardized cull schedule and market ceiling. Creating a new active policy for a species retires the prior active policy.</p>
        </article>
      </div>

      <h2>Active & historical policies</h2>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Species</span><span>Schedule</span><span>Ceiling</span><span>Status</span></div>
        {policies.length === 0 ? (
          <div className="emptyState">No supplier pricing policies configured.</div>
        ) : policies.map((policy) => (
          <div className="tableRow" key={policy.id}>
            <strong>{policy.species}</strong>
            <span>{money(policy.standardizedCullScheduleCents)}</span>
            <span>{money(policy.marketCeilingCents)}</span>
            <span className="status">{policy.active ? "ACTIVE" : "RETIRED"}</span>
          </div>
        ))}
      </div>

      <h2>Financial settlements</h2>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Order</span><span>Buyer / supplier</span><span>Outstanding</span><span>Status</span></div>
        {settlements.length === 0 ? (
          <div className="emptyState">No financial settlements yet. A settlement ledger opens automatically when RAM commits a supplier acquisition.</div>
        ) : settlements.map((settlement) => (
          <div className="tableRow" key={settlement.id}>
            <div>
              <Link href={"/finance/settlements/" + settlement.id}><strong>{settlement.orderId}</strong></Link>
              <div className="subtle">{settlement.animalCaseId} · {settlement.species}</div>
            </div>
            <div>
              <strong>{money(settlement.buyerReceivableCents)} receivable</strong>
              <div className="subtle">{money(settlement.supplierPayableCents)} supplier payable · {money(settlement.grossSpreadCents)} gross spread</div>
            </div>
            <div>
              <strong>{money(settlement.buyerOutstandingCents)} buyer</strong>
              <div className="subtle">{money(settlement.supplierOutstandingCents)} supplier</div>
            </div>
            <div>
              <span className="status">{settlement.settlementStatus}</span>
              <div className="subtle">order {settlement.orderStatus.replaceAll("_", " ")}</div>
            </div>
          </div>
        ))}
      </div>

      <h2>Acquisition commitments awaiting RAM</h2>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Order</span><span>Animal</span><span>Independent policy</span><span>Action</span></div>
        {orders.length === 0 ? (
          <div className="emptyState">No buyer-committed orders are awaiting acquisition.</div>
        ) : orders.map((order) => (
          <div className="tableRow" key={order.id}>
            <strong>{order.id}</strong>
            <div><strong>{order.animalCaseId}</strong><div className="subtle">{order.species} · {order.condition}</div></div>
            <div>
              {order.pricingPolicy ? (
                <>
                  <strong>{money(Math.min(order.pricingPolicy.standardizedCullScheduleCents, order.pricingPolicy.marketCeilingCents))}</strong>
                  <div className="subtle">schedule {money(order.pricingPolicy.standardizedCullScheduleCents)} · ceiling {money(order.pricingPolicy.marketCeilingCents)}</div>
                </>
              ) : <span className="subtle">No active {order.species} policy</span>}
            </div>
            <div>
              {order.pricingPolicy ? (
                <form action={"/api/finance/orders/" + order.id + "/acquire"} method="post">
                  <button className="primaryButton" type="submit">Commit acquisition</button>
                </form>
              ) : <span className="subtle">Create policy first</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
