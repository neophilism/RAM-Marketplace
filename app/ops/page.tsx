const queue = [
  { type: "Veterinary review", item: "RAM-SW-0001902", urgency: "Today", owner: "Unassigned" },
  { type: "Disclosure request", item: "RAM-OV-0000473", urgency: "4h SLA", owner: "Privacy review" },
  { type: "Match review", item: "Need RN-00127", urgency: "6 candidates", owner: "Scientific ops" },
  { type: "Transport gate", item: "RAM-BO-0000921", urgency: "48h", owner: "Logistics" }
];

export default function OpsPage() {
  return (
    <section className="page">
      <div className="pageHeader"><div><div className="eyebrow">RAM internal</div><h1>Operations command center</h1><p>One queue spanning clinical verification, matching, disclosure, compliance, contracting and logistics.</p></div></div>
      <div className="metricGrid">
        <article><strong>142</strong><span>Active animal cases</span></article>
        <article><strong>38</strong><span>Open research needs</span></article>
        <article><strong>27</strong><span>Candidate matches</span></article>
        <article><strong>11.4d</strong><span>Median time to match</span></article>
      </div>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Queue</span><span>Item</span><span>Timing</span><span>Owner</span></div>
        {queue.map((item) => <div className="tableRow" key={item.type + item.item}><strong>{item.type}</strong><span>{item.item}</span><span>{item.urgency}</span><span>{item.owner}</span></div>)}
      </div>
      <div className="panel"><h2>Privacy enforcement</h2><p>Scientist-facing services query an anonymized projection of animal data. Source-farm records, exact locations, owner identity, payment details and non-authorized documents are restricted to RAM roles and explicit disclosure workflows.</p></div>
    </section>
  );
}
