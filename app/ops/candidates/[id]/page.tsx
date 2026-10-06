import { requireSession } from "@/lib/auth/session";
import { getOpsCandidate } from "@/lib/server/clinical";

export const dynamic = "force-dynamic";

export default async function OpsCandidatePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const candidate = await getOpsCandidate(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM publication review · {candidate.id}</div>
          <h1>{candidate.condition}</h1>
          <p>{candidate.species} · {candidate.status.replaceAll("_", " ")}</p>
        </div>
      </div>

      <article className="panel">
        <h2>Verified scientific record</h2>
        <dl>
          <div><dt>Disease stage</dt><dd>{candidate.diseaseStage ?? "Not specified"}</dd></div>
          <div><dt>Etiology</dt><dd>{candidate.etiology ?? "Not characterized"}</dd></div>
          <div><dt>Diagnostic confidence</dt><dd>{candidate.diagnosticConfidence ?? "Not specified"}</dd></div>
          <div><dt>Transport ready</dt><dd>{candidate.transportReady ? "Yes" : "No / unresolved"}</dd></div>
          <div><dt>Public summary</dt><dd>{candidate.publicSummary}</dd></div>
        </dl>
        <h3>Phenotype</h3>
        <ul>{candidate.phenotype.map((item) => <li key={item}>{item}</li>)}</ul>
        <h3>Diagnostic evidence</h3>
        <ul>{candidate.diagnosticEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
        <h3>Comorbidities</h3>
        <ul>{candidate.comorbidities.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>

      {candidate.status === "VERIFIED" ? (
        <form className="formStack" action={"/api/ops/candidates/" + candidate.id + "/publish"} method="post">
          <section className="panel">
            <h2>Marketplace publication</h2>
            <p>Buyer pricing is set independently of the supplier acquisition payment. Publishing will immediately run the candidate against every active research need.</p>
            <div className="formGrid">
              <label><span>Buyer list price (USD) *</span><input name="listPriceUsd" type="number" min="1" step="1" required /></label>
              <label><span>Availability *</span><input name="availabilityText" placeholder="e.g. Available within 14 days" required /></label>
              <label className="span2">
                <span>Source disclosure tier *</span>
                <select name="sourceDisclosure" defaultValue="REQUESTABLE" required>
                  <option value="PUBLIC_ANONYMIZED">Public anonymized fields only</option>
                  <option value="REQUESTABLE">Additional source facts requestable</option>
                  <option value="POST_RESERVATION">Additional source facts after reservation</option>
                  <option value="POST_PURCHASE">Additional source facts after purchase</option>
                </select>
              </label>
              <label className="span2 checkCard">
                <input type="checkbox" name="publishAttestation" required />
                <span>I confirm the public record contains no unauthorized source-identifying information and the candidate passed the independent veterinary gate.</span>
              </label>
            </div>
            <div className="formActions">
              <button className="primaryButton" type="submit">Publish & run matching</button>
            </div>
          </section>
        </form>
      ) : (
        <div className="prototypeBanner">This candidate is not currently in VERIFIED status and cannot be published.</div>
      )}
    </section>
  );
}
