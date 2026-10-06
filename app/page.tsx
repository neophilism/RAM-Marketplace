import Link from "next/link";

export default function Home() {
  return (
    <section className="heroPage">
      <div className="eyebrow">RAM Corporation · Platform prototype</div>
      <h1>Better science from disease that already exists.</h1>
      <p className="heroCopy">
        RAM connects naturally occurring animal disease cases with biomedical research needs,
        replacing avoidable experimental induction whenever a suitable real-world model exists.
      </p>
      <div className="heroActions">
        <Link className="primaryButton" href="/marketplace">Browse animal models</Link>
        <Link className="secondaryButton" href="/farm">Submit an animal</Link>
      </div>
      <div className="principleGrid">
        <article><span>01</span><h2>Animal-first marketplace</h2><p>Researchers browse verified animal cases, never branded seller storefronts.</p></article>
        <article><span>02</span><h2>Permissioned disclosure</h2><p>Source identity and sensitive farm information remain hidden unless an approved transaction or information request permits release.</p></article>
        <article><span>03</span><h2>Explainable matching</h2><p>Hard eligibility gates first, then transparent research-fit scoring across phenotype, etiology, disease stage and logistics.</p></article>
      </div>
    </section>
  );
}
