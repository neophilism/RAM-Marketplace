import Link from "next/link";

const cases = [
  { id: "RAM-SW-0001847", condition: "Hearing loss", status: "AVAILABLE", action: "2 researcher views" },
  { id: "RAM-SW-0001902", condition: "Chronic dermatitis", status: "VET_REVIEW", action: "Vet visit scheduled" },
  { id: "RAM-SW-0001911", condition: "Mobility impairment", status: "DRAFT", action: "Finish submission" }
];

export default function FarmPage() {
  return (
    <section className="page">
      <div className="pageHeader">
        <div><div className="eyebrow">Private farm portal</div><h1>Your animal cases</h1><p>Your farm identity is never presented as a public seller profile.</p></div>
        <Link className="primaryButton" href="/farm/new">Report an animal</Link>
      </div>
      <div className="privacyBanner"><strong>Source protection is on.</strong><span>Scientists see RAM animal IDs and approved scientific information—not your farm name, logo, address, or seller profile.</span></div>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Animal</span><span>Condition</span><span>Status</span><span>Next step</span></div>
        {cases.map((item) => <div className="tableRow" key={item.id}><strong>{item.id}</strong><span>{item.condition}</span><span className="status">{item.status.replaceAll("_", " ")}</span><span>{item.action}</span></div>)}
      </div>
      <div className="detailGrid">
        <article className="panel">
          <h2>Default disclosure rules</h2>
          <label className="checkLine"><input type="checkbox" defaultChecked /> General husbandry details may be shared</label>
          <label className="checkLine"><input type="checkbox" /> County may be shared after NDA</label>
          <label className="checkLine"><input type="checkbox" /> Farm identity may be shared before purchase</label>
          <label className="checkLine"><input type="checkbox" defaultChecked /> Farm identity may be shared after purchase when operationally required</label>
        </article>
        <article className="panel"><h2>Pending information requests</h2><p className="emptyState">No requests currently require your approval.</p></article>
      </div>
    </section>
  );
}
