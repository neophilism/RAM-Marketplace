"use client";
import { useState, type FormEvent } from "react";

interface RuleReviewDraft {
  ruleId: string;
  revision: number;
  digest: string;
  status: "DRAFT";
  originState: string;
  destinationState: string;
  species: string;
  conditionFamily: string;
  prohibited: boolean;
  rationale: string;
  sourceReferences: string[];
  effectiveFrom: string;
  effectiveUntil: string;
}

export function RuleDraftEditor({ authorId }: { authorId: string }) {
  const [ruleId, setRuleId] = useState("");
  const [originState, setOriginState] = useState("");
  const [destinationState, setDestinationState] = useState("");
  const [species, setSpecies] = useState("");
  const [conditionFamily, setConditionFamily] = useState("");
  const [prohibited, setProhibited] = useState(true);
  const [rationale, setRationale] = useState("");
  const [sourceReferences, setSourceReferences] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [currentDigest, setCurrentDigest] = useState<string | undefined>();
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadLatest() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ops/compliance/rules/drafts?ruleId=" + encodeURIComponent(ruleId), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load drafts");
      const latest = result.revisions?.[0] as RuleReviewDraft | undefined;
      if (!latest) {
        setCurrentDigest(undefined);
        setRevision(0);
        setMessage("No saved revisions. The next submission will create draft revision 1.");
      } else {
        setCurrentDigest(latest.digest);
        setRevision(latest.revision);
        setOriginState(latest.originState);
        setDestinationState(latest.destinationState);
        setSpecies(latest.species);
        setConditionFamily(latest.conditionFamily);
        setProhibited(latest.prohibited);
        setRationale(latest.rationale);
        setSourceReferences(latest.sourceReferences.join("\n"));
        setEffectiveFrom(latest.effectiveFrom);
        setEffectiveUntil(latest.effectiveUntil);
        setMessage("Loaded revision " + latest.revision + ". Changes require its exact digest.");
      }
    } catch (error) {
      setCurrentDigest(undefined);
      setMessage(error instanceof Error ? error.message : "Unable to load draft");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ops/compliance/rules/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            ruleId, originState: originState.toUpperCase(), destinationState: destinationState.toUpperCase(),
            species, conditionFamily, prohibited, rationale,
            sourceReferences: sourceReferences.split("\n").map((x) => x.trim()).filter(Boolean),
            effectiveFrom, effectiveUntil, authorId
          },
          expectedDigest: currentDigest
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save draft");
      setCurrentDigest(result.draft.digest);
      setRevision(result.draft.revision);
      setMessage("DRAFT revision " + result.draft.revision + " saved. No corridor or movement is authorized.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save draft");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="privacyBanner">
        <strong>Draft authoring only</strong>
        <span>Saved revisions do not approve a jurisdiction, medical use, welfare clearance or animal movement.</span>
      </div>
      <div className="formActions">
        <label>Rule identifier
          <input required value={ruleId} onChange={(e) => { setRuleId(e.target.value); setRevision(0); setCurrentDigest(undefined); }} placeholder="corridor-species-condition" />
        </label>
        <button type="button" className="secondaryButton" disabled={busy || !ruleId} onClick={loadLatest}>Load latest saved draft</button>
      </div>
      <form className="formStack" onSubmit={submit}>
        <div className="formGrid">
          <label>Origin state code<input required maxLength={2} value={originState} onChange={(e) => setOriginState(e.target.value)} /></label>
          <label>Destination state code<input required maxLength={2} value={destinationState} onChange={(e) => setDestinationState(e.target.value)} /></label>
          <label>Species<input required value={species} onChange={(e) => setSpecies(e.target.value)} /></label>
          <label>Condition family<input required value={conditionFamily} onChange={(e) => setConditionFamily(e.target.value)} /></label>
          <label>Effective from<input required type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></label>
          <label>Effective through<input required type="date" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} /></label>
        </div>
        <label><input type="checkbox" checked={prohibited} onChange={(e) => setProhibited(e.target.checked)} /> Prohibition asserted in draft (does not activate a rule)</label>
        <label>Rationale<textarea required value={rationale} onChange={(e) => setRationale(e.target.value)} /></label>
        <label>Authority/source references (one per line)<textarea required value={sourceReferences} onChange={(e) => setSourceReferences(e.target.value)} /></label>
        <div className="formActions">
          <span>Current revision: {revision || "not saved"}</span>
          <button className="primaryButton" type="submit" disabled={busy || !ruleId}>{busy ? "Working..." : "Save draft revision"}</button>
        </div>
      </form>
      <p role="status">{message}</p>
    </div>
  );
}
