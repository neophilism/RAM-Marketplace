import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketplaceListing } from "@/lib/server/marketplace";

export const dynamic = "force-dynamic";

export default async function AnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animal = await getMarketplaceListing(id);
  if (!animal) notFound();

  return (
    <section className="page narrow">
      <div className="detailHeader">
        <div><div className="eyebrow">{animal.id}</div><h1>{animal.condition}</h1><p>{animal.summary}</p></div>
        <div className="priceBox"><span>Model price</span><strong>${animal.priceUsd.toLocaleString()}</strong><Link className="primaryButton" href="/research">Reserve through a research need</Link></div>
      </div>
      <div className="detailGrid">
        <article className="panel">
          <h2>Scientific profile</h2>
          <dl>
            <div><dt>Species / breed</dt><dd>{animal.species} · {animal.breed}</dd></div>
            <div><dt>Age / sex</dt><dd>{animal.age} · {animal.sex}</dd></div>
            <div><dt>Weight</dt><dd>{animal.weightKg ? animal.weightKg + " kg" : "Not disclosed"}</dd></div>
            <div><dt>Disease stage</dt><dd>{animal.diseaseStage}</dd></div>
            <div><dt>Etiology</dt><dd>{animal.etiology ?? "Not characterized"}</dd></div>
            <div><dt>Diagnostic confidence</dt><dd>{animal.diagnosticConfidence}</dd></div>
            <div><dt>Region</dt><dd>{animal.region}</dd></div>
          </dl>
          <h3>Observed phenotype</h3>
          <ul>{animal.phenotype.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Diagnostic evidence</h3>
          {animal.diagnosticEvidence.length > 0
            ? <ul>{animal.diagnosticEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>No diagnostic evidence has been released in the current disclosure tier.</p>}
          <h3>Comorbidities</h3>
          {animal.comorbidities.length > 0
            ? <ul>{animal.comorbidities.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>No comorbidities are documented in the public scientific record.</p>}
        </article>
        <article className="panel">
          <h2>Source privacy</h2>
          <p>The farm is intentionally anonymous. This page is generated from RAM&apos;s marketplace projection and has no access to the restricted source record.</p>
          <div className="privacyState"><strong>Current disclosure tier</strong><span>{animal.sourceDisclosure.replaceAll("_", " ")}</span></div>
          <button className="secondaryButton" type="button">Request additional source information</button>
          <p className="finePrint">Requests must identify scientific or purchasing relevance. Release depends on farm permissions, RAM review, and any required NDA or transaction milestone.</p>
        </article>
      </div>
    </section>
  );
}
