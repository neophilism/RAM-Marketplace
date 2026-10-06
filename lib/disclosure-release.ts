import {
  sanitizeRestrictedNarrative,
  type DisclosureField
} from "./disclosure-policy";

export interface DisclosureSourceFacts {
  generalHusbandry?: string | null;
  countyLabel?: string | null;
  legalOwnerName?: string | null;
  exactAddress?: string | null;
  ownerContactName?: string | null;
  ownerContactEmail?: string | null;
  localVetName?: string | null;
  localVetContact?: string | null;
}

export interface DisclosureReleaseSnapshot {
  releasedFields: DisclosureField[];
  releasedData: Partial<Record<DisclosureField, string>>;
}

export function buildDisclosureReleaseSnapshot(
  requestedFields: DisclosureField[],
  source: DisclosureSourceFacts
): DisclosureReleaseSnapshot {
  const releasedFields: DisclosureField[] = [];
  const releasedData: Partial<Record<DisclosureField, string>> = {};

  const identifiers = [
    source.legalOwnerName,
    source.exactAddress,
    source.ownerContactName,
    source.ownerContactEmail,
    source.localVetName,
    source.localVetContact
  ];

  for (const field of requestedFields) {
    if (field === "GENERAL_HUSBANDRY") {
      const value = source.generalHusbandry?.trim();
      if (value) {
        releasedFields.push(field);
        releasedData[field] = sanitizeRestrictedNarrative(value, identifiers);
      }
    }

    if (field === "COUNTY") {
      const value = source.countyLabel?.trim();
      if (value) {
        releasedFields.push(field);
        releasedData[field] = value;
      }
    }

    if (field === "FARM_IDENTITY") {
      const value = source.legalOwnerName?.trim();
      if (value) {
        releasedFields.push(field);
        releasedData[field] = value;
      }
    }
  }

  return { releasedFields, releasedData };
}

export function assertScopedReleaseSnapshot(
  snapshot: DisclosureReleaseSnapshot
) {
  const allowed = new Set(snapshot.releasedFields);

  for (const key of Object.keys(snapshot.releasedData)) {
    if (!allowed.has(key as DisclosureField)) {
      throw new Error("Disclosure snapshot contains a field that was not explicitly released");
    }
  }

  const serialized = JSON.stringify(snapshot.releasedData).toLowerCase();
  for (const forbidden of [
    "exactaddress",
    "ownercontactname",
    "ownercontactemail",
    "localvetname",
    "localvetcontact"
  ]) {
    if (serialized.includes(forbidden.toLowerCase())) {
      throw new Error("Disclosure snapshot contains forbidden restricted-source metadata");
    }
  }
}
