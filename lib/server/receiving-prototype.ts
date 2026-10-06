export interface PrototypeReceiptInspection {
  id: string;
  orderId: string;
  inspectorUserId: string;
  decision: "ACCEPTED" | "REJECTED";
  animalIdentityConfirmed: boolean;
  movementDocumentsReceived: boolean;
  physicalConditionConsistent: boolean;
  welfareIntakeAcceptable: boolean;
  discrepancyNotes?: string;
  notes?: string;
  inspectedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __ramPrototypeReceiptInspections: PrototypeReceiptInspection[] | undefined;
}

function records() {
  if (!globalThis.__ramPrototypeReceiptInspections) {
    globalThis.__ramPrototypeReceiptInspections = [];
  }
  return globalThis.__ramPrototypeReceiptInspections;
}

export function getPrototypeReceiptInspection(orderId: string) {
  return records().find((inspection) => inspection.orderId === orderId);
}

export function savePrototypeReceiptInspection(
  input: Omit<PrototypeReceiptInspection, "id" | "inspectedAt">
) {
  if (getPrototypeReceiptInspection(input.orderId)) {
    throw new Error("Receiving inspection has already been recorded");
  }

  const record: PrototypeReceiptInspection = {
    ...input,
    id: `RI-${String(records().length + 1).padStart(6, "0")}`,
    inspectedAt: new Date().toISOString()
  };
  records().unshift(record);
  return record;
}
