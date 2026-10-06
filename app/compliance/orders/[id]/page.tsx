import { requireSession } from "@/lib/auth/session";
import { getComplianceOrder } from "@/lib/server/transactions";

export const dynamic = "force-dynamic";

export default async function ComplianceOrderPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const order = await getComplianceOrder(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Restricted compliance review · {order.id}</div>
          <h1>{order.condition}</h1>
          <p>{order.animalCaseId} · {order.species} · {order.buyerOrganizationName}</p>
        </div>
        <span className="status">{order.status.replaceAll("_", " ")}</span>
      </div>

      <div className="privacyBanner">
        <strong>Restricted source data.</strong>
        <span>This screen is available to authorized RAM compliance roles and includes source identity solely for clearance.</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Buyer / receiving side</h2>
          <dl>
            <div><dt>Research need</dt><dd>{order.researchNeedTitle}</dd></div>
            <div><dt>Protocol reference</dt><dd>{order.protocolReference ?? "Not provided"}</dd></div>
            <div><dt>Receiving facility</dt><dd>{order.receivingFacilityName ?? "Not provided"}</dd></div>
            <div><dt>Receiving address</dt><dd>{order.receivingFacilityAddress ?? "Not provided"}</dd></div>
          </dl>
        </article>
        <article className="panel">
          <h2>Restricted source / animal side</h2>
          <dl>
            <div><dt>Source owner</dt><dd>{order.sourceFarmName ?? "Unavailable"}</dd></div>
            <div><dt>Source address</dt><dd>{order.sourceExactAddress ?? "Unavailable"}</dd></div>
            <div><dt>Pre-existing cull reason</dt><dd>{order.cullReason ?? "Unavailable"}</dd></div>
            <div><dt>Independent cull provenance</dt><dd>{order.independentCullAttestation ? "Confirmed" : "NOT CONFIRMED"}</dd></div>
            <div><dt>Veterinary transport fitness</dt><dd>{order.transportReady ? "Confirmed" : "NOT CONFIRMED"}</dd></div>
          </dl>
        </article>
      </div>

      <form className="formStack" action={"/api/compliance/orders/" + order.id + "/review"} method="post">
        <article className="panel">
          <h2>Hard clearance gates</h2>
          <div className="formGrid">
            <label className="span2 checkCard"><input type="checkbox" name="protocolConfirmed" /><span>Institutional protocol / animal-use authorization is confirmed and applicable.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="receivingFacilityConfirmed" /><span>Receiving facility is authorized and capable of receiving this species and case.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="welfareConfirmed" /><span>Animal welfare requirements are satisfied for the planned transfer.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="biosecurityConfirmed" /><span>Biosecurity and communicable-disease controls are satisfied.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="movementRequirementsConfirmed" /><span>Applicable movement permits, certificates and jurisdictional requirements are satisfied.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="transportPlanConfirmed" /><span>Transport plan and receiving timing are feasible.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="sourceProvenanceConfirmed" /><span>Independent cull provenance and source integrity are confirmed.</span></label>
            <label className="span2"><span>Blocking findings</span><textarea name="blockingFindings" rows={4} placeholder="Required when failing clearance. One finding per line." /></label>
            <label className="span2"><span>Review notes</span><textarea name="notes" rows={4} /></label>
          </div>
          <div className="formActions">
            <button className="secondaryButton" type="submit" name="decision" value="FAILED">Fail clearance</button>
            <button className="primaryButton" type="submit" name="decision" value="CLEARED">Clear for pickup</button>
          </div>
        </article>
      </form>
    </section>
  );
}
