import Link from "next/link";
import { getMarketplaceListings } from "@/lib/server/marketplace";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const animalListings = await getMarketplaceListings();

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Scientist marketplace</div>
          <h1>Available realistic animal models</h1>
          <p>Listings are animal-centered and source-anonymized by default.</p>
        </div>
        <Link className="primaryButton" href="/research/new">Create research need</Link>
      </div>
      <div className="marketLayout">
        <aside className="filterPanel">
          <h2>Refine</h2>
          {["Species","Condition","Disease stage","Diagnostic confidence","Region","Availability","Price"].map((label) => (
            <label key={label}><span>{label}</span><input placeholder={"Filter by " + label.toLowerCase()} /></label>
          ))}
        </aside>
        <div className="results">
          <div className="resultsMeta">{animalListings.length} verified models · farm identities withheld</div>
          {animalListings.map((animal) => (
            <Link className="animalCard" href={"/marketplace/" + animal.id} key={animal.id}>
              <div>
                <div className="cardTopline"><span className="pill">{animal.species}</span>{animal.ramVerified && <span className="verified">RAM verified</span>}</div>
                <h2>{animal.condition}</h2>
                <p>{animal.summary}</p>
                <div className="specRow"><span>{animal.breed}</span><span>{animal.age}</span><span>{animal.sex}</span><span>{animal.weightKg || "—"} kg</span></div>
              </div>
              <div className="cardAside"><strong>${animal.priceUsd.toLocaleString()}</strong><span>{animal.region}</span><span>{animal.availability}</span></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
