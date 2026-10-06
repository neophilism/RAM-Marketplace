import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listDisclosureEligibleResearchNeeds } from "@/lib/server/disclosures";

export const dynamic = "force-dynamic";

export default async function NewDisclosureRequestPage({
  searchParams
}: {
  searchParams: Promise<{
    animalCaseId?: string;
    researchNeedId?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const animalCaseId = params.animalCaseId?.trim() ?? "";
  const needs = animalCaseId
    ? await listDisclosureEligibleResearchNeeds(session, animalCaseId)
    : [];
  const preferredNeed =
    needs.find((need) => need.id === params.researchNeedId)?.id ??
    needs[0]?.id ??
    "";

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Permissioned source information</div>
          <h1>Request additional source facts</h1>
          <p>
            RAM will first review whether the information is relevant to the research
            or purchase decision. The farm&apos;s standing permissions and any required
            case-specific approval, NDA, or transaction milestone are then enforced.
          </p>
        </div>
      </div>

      {!animalCaseId ? (
        <article className="panel">
          <h2>Choose an animal first</h2>
          <p>
            Source requests must be tied to a specific anonymous animal and one of
            your eligible research needs.
          </p>
          <Link className="primaryButton" href="/marketplace">Browse marketplace</Link>
        </article>
      ) : needs.length === 0 ? (
        <article className="panel">
          <h2>No eligible research relationship</h2>
          <p>
            You can request source information only when this animal is an eligible
            match for one of your active research needs or is already part of your
            organization&apos;s order workflow.
          </p>
          <Link className="secondaryButton" href={"/marketplace/" + animalCaseId}>Back to animal</Link>
        </article>
      ) : (
        <form className="formStack" action="/api/disclosures" method="post">
          <input type="hidden" name="animalCaseId" value={animalCaseId} />

          <section className="panel">
            <div className="eyebrow">{animalCaseId}</div>
            <h2>Research context</h2>
            <div className="formGrid">
              <label className="span2">
                <span>Research need *</span>
                <select name="researchNeedId" defaultValue={preferredNeed} required>
                  {needs.map((need) => (
                    <option key={need.id} value={need.id}>
                      {need.title} · {need.status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Facts requested</h2>
            <p>
              Request the minimum information needed. Exact farm address and source
              contact information are not part of this disclosure channel.
            </p>
            <div className="formStack">
              <label className="checkCard">
                <input type="checkbox" name="requestedFields" value="GENERAL_HUSBANDRY" />
                <span><strong>General husbandry / environmental context</strong><br />Housing, feeding or environmental information supplied by the farm, sanitized before release.</span>
              </label>
              <label className="checkCard">
                <input type="checkbox" name="requestedFields" value="COUNTY" />
                <span><strong>County / local jurisdiction</strong><br />Useful when location materially affects epidemiology, movement requirements or study design. NDA required.</span>
              </label>
              <label className="checkCard">
                <input type="checkbox" name="requestedFields" value="FARM_IDENTITY" />
                <span><strong>Farm legal identity</strong><br />Released only when the applicable farm permission and transaction gate permit it. NDA required.</span>
              </label>
              <label>
                <span>Why does this affect the research or purchase decision? *</span>
                <textarea
                  name="scientificReason"
                  rows={6}
                  minLength={20}
                  required
                  placeholder="Explain specifically why the requested source fact changes scientific suitability, compliance, logistics, or the decision to purchase this animal."
                />
              </label>
            </div>
          </section>

          <div className="formActions">
            <Link className="secondaryButton" href={"/marketplace/" + animalCaseId}>Cancel</Link>
            <button className="primaryButton" type="submit">Submit request</button>
          </div>
        </form>
      )}
    </section>
  );
}
