export default function NewResearchNeedPage() {
  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Researcher workspace · New need</div>
          <h1>Define the model you need</h1>
          <p>Use hard constraints only where they are truly necessary; over-constraining a request can hide scientifically useful natural variation.</p>
        </div>
      </div>

      <form className="formStack">
        <section className="panel formSection">
          <div className="sectionNumber">01</div>
          <div><h2>Scientific objective</h2><p>Start with the disease state and the reason the model is needed.</p></div>
          <div className="formGrid">
            <label className="span2"><span>Research need title *</span><input name="title" required placeholder="e.g. Naturally occurring bilateral hearing loss in swine" /></label>
            <label><span>Condition / disease *</span><input name="condition" required /></label>
            <label><span>Preferred species</span><input name="species" placeholder="Leave open if multiple species could work" /></label>
            <label className="span2"><span>Scientific rationale *</span><textarea name="scientificRationale" required rows={5} placeholder="Why is this model needed, and what question will it answer?" /></label>
          </div>
        </section>

        <section className="panel formSection">
          <div className="sectionNumber">02</div>
          <div><h2>Inclusion and exclusion criteria</h2><p>These fields become hard gates or high-weight matching signals.</p></div>
          <div className="formGrid">
            <label><span>Minimum age (months)</span><input name="minAgeMonths" type="number" min="0" /></label>
            <label><span>Maximum age (months)</span><input name="maxAgeMonths" type="number" min="1" /></label>
            <label><span>Sex</span><select name="sex" defaultValue="Any"><option>Any</option><option>Female</option><option>Male</option></select></label>
            <label><span>Disease stage</span><input name="diseaseStage" /></label>
            <label className="span2"><span>Required phenotype *</span><textarea name="requiredPhenotype" required rows={4} /></label>
            <label className="span2"><span>Exclusion criteria</span><textarea name="exclusionCriteria" rows={3} /></label>
            <label className="span2"><span>Acceptable comorbidities / natural variation</span><textarea name="acceptableComorbidities" rows={3} /></label>
            <label className="span2"><span>Required diagnostics</span><textarea name="requiredDiagnostics" rows={3} /></label>
          </div>
        </section>

        <section className="panel formSection">
          <div className="sectionNumber">03</div>
          <div><h2>Study and procurement</h2><p>RAM uses this to determine facility, timing, transport and institutional-clearance fit.</p></div>
          <div className="formGrid">
            <label><span>Number of animals *</span><input name="quantity" type="number" min="1" defaultValue="1" required /></label>
            <label><span>Target budget (USD)</span><input name="budgetUsd" type="number" min="1" /></label>
            <label><span>Protocol / IACUC status *</span><select name="protocolStatus" defaultValue="NOT_STARTED"><option value="NOT_STARTED">Not started</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option><option value="APPROVED">Approved</option></select></label>
            <label><span>Needed by *</span><input name="timeline" required placeholder="e.g. within 90 days" /></label>
            <label className="span2"><span>Planned procedures</span><textarea name="procedures" rows={4} /></label>
          </div>
        </section>

        <div className="formActions">
          <button className="secondaryButton" type="button">Save draft</button>
          <button className="primaryButton" type="submit">Submit research need</button>
        </div>
      </form>
    </section>
  );
}
