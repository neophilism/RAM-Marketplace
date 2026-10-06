import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getRequesterDisclosureRequest } from "@/lib/server/disclosures";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  GENERAL_HUSBANDRY: "General husbandry / environmental context",
  COUNTY: "County / local jurisdiction",
  FARM_IDENTITY: "Farm legal identity"
};

export default async function DisclosureRequestPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const request = await getRequesterDisclosureRequest(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Source request · {request.id}</div>
          <h1>{request.animalCaseId}</h1>
          <p>{request.researchNeedTitle}</p>
        </div>
        <span className="status">{request.status.replaceAll("_", " ")}</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Request</h2>
          <h3>Requested facts</h3>
          <ul>
            {request.requestedFields.map((field) => (
              <li key={field}>{labels[field] ?? field}</li>
            ))}
          </ul>
          <h3>Decision relevance</h3>
          <p>{request.scientificReason}</p>
        </article>

        <article className="panel">
          <h2>Approval path</h2>
          <dl>
            <div><dt>RAM relevance review</dt><dd>{request.status === "PENDING_RAM_REVIEW" ? "Pending" : "Completed"}</dd></div>
            <div><dt>Farm approval</dt><dd>{request.status === "PENDING_SUPPLIER_APPROVAL" ? "Pending" : "As required by policy"}</dd></div>
            <div><dt>NDA</dt><dd>{request.ndaRequired ? (request.ndaAccepted ? "Accepted" : "Required") : "Not required"}</dd></div>
          </dl>
        </article>
      </div>

      {request.status === "APPROVED" && request.ndaRequired && !request.ndaAccepted && (
        <article className="panel">
          <h2>Accept confidentiality terms</h2>
          <p>
            The approved source facts remain restricted to your organization&apos;s
            evaluation of this animal and may not be used to identify, publicize,
            contact, or solicit the source farm outside the RAM transaction process.
          </p>
          <form action={"/api/disclosures/" + request.id + "/nda"} method="post">
            <label className="checkCard">
              <input type="checkbox" name="accepted" required />
              <span>I accept these confidentiality restrictions for the approved source information.</span>
            </label>
            <div className="formActions">
              <button className="primaryButton" type="submit">Accept & release approved facts</button>
            </div>
          </form>
        </article>
      )}

      {request.status === "RELEASED" && (
        <article className="panel">
          <div className="eyebrow">Approved release snapshot</div>
          <h2>Additional source information</h2>
          <p>
            This is the complete approved release for this request. It is a scoped
            snapshot—not access to RAM&apos;s restricted source record.
          </p>
          <dl>
            {request.releasedFields.map((field) => (
              <div key={field}>
                <dt>{labels[field] ?? field}</dt>
                <dd>{request.releasedData[field] ?? "No data available"}</dd>
              </div>
            ))}
          </dl>
          <p className="finePrint">
            Exact source address, source contacts, local veterinarian identity,
            supplier economics and other non-approved fields remain restricted.
          </p>
        </article>
      )}

      {request.status === "DENIED" && (
        <article className="panel">
          <h2>Request denied</h2>
          <p>{request.denialReason ?? "The requested disclosure was not approved."}</p>
        </article>
      )}

      <div className="formActions">
        <Link className="secondaryButton" href="/disclosures">All requests</Link>
        <Link className="secondaryButton" href={"/marketplace/" + request.animalCaseId}>Animal profile</Link>
      </div>
    </section>
  );
}
