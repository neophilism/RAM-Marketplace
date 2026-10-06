const reviews = [
  { id: "RAM-SW-0001902", species: "Swine", condition: "Chronic dermatitis", age: "14 mo", priority: "Routine", status: "Review required" },
  { id: "RAM-BO-0000988", species: "Bovine", condition: "Progressive lameness", age: "4 yr", priority: "Soon", status: "Diagnostics requested" },
  { id: "RAM-OV-0000504", species: "Ovine", condition: "Suspected cardiomyopathy", age: "3 yr", priority: "Routine", status: "Review required" }
];

export default function VetPage() {
  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM veterinary network</div>
          <h1>Verification queue</h1>
          <p>Veterinary review gates marketplace eligibility and remains independent from buyer demand.</p>
        </div>
      </div>

      <div className="metricGrid">
        <article><strong>9</strong><span>Awaiting review</span></article>
        <article><strong>4</strong><span>Diagnostics pending</span></article>
        <article><strong>2</strong><span>Welfare holds</span></article>
        <article><strong>18h</strong><span>Median review time</span></article>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Animal</span><span>Condition</span><span>Priority</span><span>Status</span></div>
        {reviews.map((review) => (
          <div className="tableRow" key={review.id}>
            <div><strong>{review.id}</strong><div className="subtle">{review.species} · {review.age}</div></div>
            <span>{review.condition}</span>
            <strong>{review.priority}</strong>
            <span className="status">{review.status}</span>
          </div>
        ))}
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Verification gate</h2>
          <p>Confirm diagnosis or define the diagnostic workup, assess welfare suitability, determine whether the condition is naturally occurring, and identify any biosecurity or transport restrictions.</p>
        </article>
        <article className="panel">
          <h2>Possible outcomes</h2>
          <p>Eligible · Needs diagnostics · Ineligible · Welfare hold. Only eligible cases may advance to verified/available marketplace status.</p>
        </article>
      </div>
    </section>
  );
}
