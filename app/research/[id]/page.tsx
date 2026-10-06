import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listResearchNeedMatches } from "@/lib/server/clinical";

export const dynamic = "force-dynamic";

const componentLabels = [
  ["phenotypeFit", "Phenotype"],
  ["diagnosticConfidence", "Diagnostics"],
  ["etiologyFit", "Etiology"],
  ["comorbidityFit", "Comorbidity"],
  ["timingAvailability", "Timing"],
  ["logisticsFit", "Logistics"],
  ["priceFit", "Price"]
] as const;

export default async function ResearchNeedMatchesPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const matches = await listResearchNeedMatches(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Research need · {id}</div>
          <h1>Ranked candidate matches</h1>
          <p>Only candidates that pass all hard exclusions appear here. Review flags identify facts requiring human confirmation rather than assumptions.</p>
        </div>
        <Link className="secondaryButton" href="/research">Back to needs</Link>
      </div>

      {matches.length === 0 ? (
        <div className="panel emptyState">No eligible matches have been generated yet. The research need must be active and at least one candidate must be published.</div>
      ) : matches.map((match) => (
        <article className="matchCard" key={match.animalCaseId}>
          <div className="matchHeader">
            <div>
              <div className="eyebrow">{match.animalCaseId}</div>
              <h2>Explainable model fit</h2>
            </div>
            <div className="matchScore">{match.totalScore}/100</div>
          </div>

          <div className="scoreGrid">
            {componentLabels.map(([key, label]) => (
              <div key={key}>
                <strong>{match.components[key]}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {match.reviewFlags.length > 0 && (
            <>
              <h3>Human review flags</h3>
              <ul className="flagList">
                {match.reviewFlags.map((flag) => <li key={flag}>{flag}</li>)}
              </ul>
            </>
          )}

          <details>
            <summary>Why this score?</summary>
            <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </details>

          <div className="formActions">
            <Link className="primaryButton" href={"/marketplace/" + match.animalCaseId}>View anonymous animal profile</Link>
          </div>
        </article>
      ))}
    </section>
  );
}
