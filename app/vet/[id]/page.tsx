import { requireSession } from "@/lib/auth/session";
import { getVeterinaryCandidate } from "@/lib/server/clinical";

export const dynamic = "force-dynamic";

export default async function VeterinaryCandidatePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const candidate = await getVeterinaryCandidate(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Veterinary review · {candidate.id}</div>
          <h1>{candidate.condition}</h1>
          <p>{candidate.species} · {candidate.ageLabel} · {candidate.status.replaceAll("_", " ")}</p>
        </div>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Restricted clinical intake</h2>
          <dl>
            <div><dt>Observed signs</dt><dd>{candidate.observedSigns ?? "Not provided"}</dd></div>
            <div><dt>Existing diagnosis</dt><dd>{candidate.existingDiagnosis ?? "Not provided"}</dd></div>
            <div><dt>Current treatment</dt><dd>{candidate.currentTreatment ?? "None documented"}</dd></div>
            <div><dt>Pre-existing cull reason</dt><dd>{candidate.cullReason ?? "Not available"}</dd></div>
          </dl>
        </article>
        <article className="panel">
          <h2>Assignment</h2>
          <p>{candidate.assignedToMe ? "This review is assigned to your signed-in veterinary identity." : "Claim this candidate from the veterinary queue before submitting a review."}</p>
        </article>
      </div>

      {candidate.assignedToMe && (
        <form className="formStack" action="/api/vet/reviews" method="post">
          <input type="hidden" name="animalCaseId" value={candidate.id} />
          <section className="panel">
            <h2>Clinical determination</h2>
            <div className="formGrid">
              <label>
                <span>Outcome *</span>
                <select name="outcome" defaultValue="ELIGIBLE" required>
                  <option value="ELIGIBLE">Eligible for RAM</option>
                  <option value="NEEDS_DIAGNOSTICS">Needs additional diagnostics</option>
                  <option value="INELIGIBLE">Ineligible</option>
                  <option value="WELFARE_HOLD">Welfare hold</option>
                </select>
              </label>
              <label><span>Diagnosis</span><input name="diagnosis" /></label>
              <label><span>Disease stage</span><input name="diseaseStage" /></label>
              <label>
                <span>Diagnostic confidence</span>
                <select name="diagnosticConfidence" defaultValue="">
                  <option value="">Select</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                </select>
              </label>
              <label className="span2">
                <span>Phenotype observations</span>
                <textarea name="phenotype" rows={5} placeholder="One observation per line, or separate with semicolons." />
              </label>
              <label className="span2">
                <span>Scientist-facing summary</span>
                <textarea name="publicSummary" rows={4} placeholder="No farm identity, exact location, owner name, local vet identity or other source-identifying information." />
              </label>
              <label className="span2">
                <span>Diagnostic plan, if more work is needed</span>
                <textarea name="diagnosticPlan" rows={3} />
              </label>
              <label className="span2">
                <span>Welfare notes</span>
                <textarea name="welfareNotes" rows={3} />
              </label>
              <label className="span2 checkCard">
                <input type="checkbox" name="transportReady" />
                <span>Transport is clinically appropriate based on current information.</span>
              </label>
              <label className="span2 checkCard">
                <input type="checkbox" name="reviewerAttestation" required />
                <span>I attest that this determination is based on the animal's clinical condition and welfare, independently of buyer demand or research value.</span>
              </label>
            </div>
            <div className="formActions">
              <button className="primaryButton" type="submit">Submit veterinary review</button>
            </div>
          </section>
        </form>
      )}
    </section>
  );
}
