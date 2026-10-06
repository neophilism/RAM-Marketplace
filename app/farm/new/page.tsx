import Link from "next/link";

export default function NewAnimalPage() {
  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Farm portal · New case</div>
          <h1>Report an animal</h1>
          <p>Start with what you know. RAM veterinary staff can complete or verify clinical details later.</p>
        </div>
      </div>

      <form className="formStack" action="/api/animal-cases" method="post">
        <section className="panel formSection">
          <div className="sectionNumber">01</div>
          <div>
            <h2>Animal basics</h2>
            <p>These fields establish the initial case identity and research-relevant demographics.</p>
          </div>
          <div className="formGrid">
            <label><span>Species *</span><input name="species" required placeholder="e.g. Swine" /></label>
            <label><span>Breed</span><input name="breed" placeholder="e.g. Yorkshire cross" /></label>
            <label><span>Sex *</span><select name="sex" required defaultValue=""><option value="" disabled>Select</option><option>Female</option><option>Male</option><option>Unknown</option></select></label>
            <label><span>Age (months)</span><input name="ageMonths" type="number" min="1" /></label>
            <label><span>Approx. weight (kg)</span><input name="weightKg" type="number" min="1" step="0.1" /></label>
            <label><span>Your internal animal ID</span><input name="farmAnimalId" placeholder="Never shown publicly" /></label>
          </div>
        </section>

        <section className="panel formSection">
          <div className="sectionNumber">02</div>
          <div>
            <h2>Condition and observed signs</h2>
            <p>RAM uses this information for triage. A suspected condition does not need to be fully diagnosed before submission.</p>
          </div>
          <div className="formGrid">
            <label className="span2"><span>Known or suspected condition *</span><input name="condition" required /></label>
            <label><span>Disease stage, if known</span><input name="diseaseStage" /></label>
            <label><span>First observed</span><input name="firstObservedDate" type="date" /></label>
            <label className="span2"><span>Observed signs *</span><textarea name="observedSigns" required rows={5} placeholder="Describe what has changed, duration, severity and progression." /></label>
            <label className="span2"><span>Existing diagnosis or test results</span><textarea name="existingDiagnosis" rows={3} /></label>
            <label className="span2"><span>Current treatment or supportive care</span><textarea name="currentTreatment" rows={3} /></label>
            <label className="span2"><span>General husbandry / environment notes</span><textarea name="generalHusbandry" rows={3} placeholder="Optional. Describe housing, feeding or environmental context that could be scientifically relevant. RAM keeps this restricted unless disclosure is approved." /></label>
          </div>
        </section>

        <section className="panel formSection">
          <div className="sectionNumber">03</div>
          <div>
            <h2>Cull provenance, welfare and timing</h2>
            <p>RAM is for animals already selected for culling independently of research demand. Research availability never overrides immediate welfare needs.</p>
          </div>
          <div className="formGrid">
            <label><span>Cull decision date *</span><input name="cullDecisionDate" type="date" required /></label>
            <label><span>Planned cull date *</span><input name="plannedCullAt" type="date" required /></label>
            <label className="span2"><span>Reason the animal was selected for culling *</span><textarea name="cullReason" required rows={3} placeholder="Describe the farm's pre-existing reason for culling this animal." /></label>
            <label><span>Welfare urgency *</span><select name="welfareUrgency" defaultValue="ROUTINE"><option value="ROUTINE">Routine</option><option value="SOON">Needs attention soon</option><option value="URGENT">Urgent clinical attention</option></select></label>
            <label><span>Current location</span><input value="Private farm source — hidden from marketplace" readOnly /></label>
            <label className="span2 checkCard"><input type="checkbox" name="independentCullAttestation" required /><span>I attest that the decision to cull this animal was made independently of RAM, before any research buyer or research value was known.</span></label>
            <label className="span2 checkCard"><input type="checkbox" name="ownerAttestation" required /><span>I confirm I am authorized to submit this animal and that the information is accurate to the best of my knowledge.</span></label>
          </div>
        </section>

        <div className="formActions">
          <Link className="secondaryButton" href="/farm">Cancel</Link>
          <button className="primaryButton" type="submit">Submit for RAM triage</button>
        </div>
      </form>
    </section>
  );
}
