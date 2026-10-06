import process from "node:process";

const base = process.env.RAM_E2E_BASE_URL ?? "http://127.0.0.1:3117";
const origin = base;
const sessions = {};

function fail(message) {
  throw new Error(message);
}

function form(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === false) continue;
    body.set(key, value === true ? "on" : String(value));
  }
  return body;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("Origin", origin);
  if (options.cookie) headers.set("Cookie", options.cookie);
  return fetch(base + path, {
    ...options,
    headers,
    redirect: options.redirect ?? "manual"
  });
}

async function waitForServer() {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  fail("RAM E2E server did not become ready");
}

async function login(actor) {
  const response = await request("/api/session/demo", {
    method: "POST",
    body: form({ actor })
  });
  if (response.status !== 303) {
    fail("Login failed for " + actor + ": " + response.status + " " + await response.text());
  }
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) fail("Demo login did not set a session cookie");
  return setCookie.split(";")[0];
}

async function postForm(path, fields, cookie, expected = 303) {
  const response = await request(path, {
    method: "POST",
    body: form(fields),
    cookie
  });
  if (response.status !== expected) {
    fail("POST " + path + " expected " + expected + ", got " + response.status + ": " + await response.text());
  }
  return response;
}

async function page(path, cookie) {
  const response = await request(path, {
    method: "GET",
    cookie,
    redirect: "follow"
  });
  const text = await response.text();
  if (!response.ok) fail("GET " + path + " failed: " + response.status + " " + text);
  return text;
}

function recordHeader(response) {
  const value = response.headers.get("x-ram-record");
  if (!value) fail("Expected X-RAM-Record header");
  return value;
}

function redirectId(response, prefix) {
  const location = response.headers.get("location");
  if (!location) fail("Expected redirect Location header");
  const pathname = new URL(location, base).pathname;
  const id = pathname.split("/").filter(Boolean).at(-1);
  if (!id || !id.startsWith(prefix)) {
    fail("Expected redirect ID beginning " + prefix + ", got " + pathname);
  }
  return id;
}

function firstLinkedId(html, routePrefix, idPrefix) {
  const marker = 'href="' + routePrefix + idPrefix;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) fail("Could not find " + idPrefix + " link under " + routePrefix);
  const idStart = markerIndex + ('href="' + routePrefix).length;
  const idEnd = html.indexOf('"', idStart);
  if (idEnd < 0) fail("Malformed linked ID");
  return html.slice(idStart, idEnd);
}

function assertContains(text, expected, label) {
  if (!text.includes(expected)) {
    fail(label + " did not contain expected text: " + expected);
  }
}

async function createDeliveredOrder(label) {
  const condition = "Pilot sensorineural loss " + label;

  const animalResponse = await postForm("/api/animal-cases", {
    species: "Swine",
    breed: "Commercial cross",
    sex: "Female",
    ageMonths: 12,
    weightKg: 70,
    condition,
    diseaseStage: "Moderate",
    observedSigns: "Documented hearing response deficit during routine farm observation.",
    firstObservedDate: "2026-09-15",
    existingDiagnosis: condition,
    currentTreatment: "Supportive care only",
    generalHusbandry: "Standard group housing with routine feed and water access.",
    cullDecisionDate: "2026-09-20",
    plannedCullAt: "2026-10-20",
    cullReason: "Animal independently selected for culling before any research inquiry.",
    welfareUrgency: "ROUTINE",
    independentCullAttestation: true,
    ownerAttestation: true
  }, sessions.farmer);
  const animalId = recordHeader(animalResponse);

  const needResponse = await postForm("/api/research-needs", {
    title: "Pilot need " + label,
    condition,
    species: "Swine",
    minAgeMonths: 6,
    maxAgeMonths: 36,
    sex: "Any",
    diseaseStage: "Moderate",
    etiologyRequirement: "Naturally occurring",
    requiredPhenotype: "Bilateral sensorineural hearing loss with elevated ABR thresholds",
    acceptableComorbidities: "Stable minor comorbidities acceptable",
    requiredDiagnostics: "ABR",
    procedures: "Device evaluation under approved institutional protocol",
    quantity: 1,
    timeline: "Within 30 days",
    budgetUsd: 5000,
    protocolStatus: "APPROVED",
    scientificRationale: "Pilot validation of RAM matching using a naturally occurring disease phenotype rather than an induced injury model."
  }, sessions.scientist);
  const needId = recordHeader(needResponse);

  await postForm("/api/ops/candidates/" + animalId + "/prescreen", {}, sessions.ram);
  await postForm("/api/vet/candidates/" + animalId + "/claim", {}, sessions.veterinarian);
  await postForm("/api/vet/reviews", {
    animalCaseId: animalId,
    outcome: "ELIGIBLE",
    diagnosis: condition,
    diseaseStage: "Moderate",
    etiology: "Naturally occurring",
    diagnosticConfidence: "Confirmed",
    phenotype: "Bilateral sensorineural hearing loss with elevated ABR thresholds",
    comorbidities: "None material",
    diagnosticEvidence: "ABR",
    publicSummary: "Naturally occurring bilateral sensorineural hearing loss confirmed by ABR.",
    welfareNotes: "Stable for cleared transport.",
    transportReady: true,
    reviewerAttestation: true
  }, sessions.veterinarian);

  await postForm("/api/ops/candidates/" + animalId + "/publish", {
    listPriceUsd: 5000,
    availabilityText: "Available within 14 days",
    sourceDisclosure: "REQUESTABLE",
    publishAttestation: true
  }, sessions.ram);
  await postForm("/api/ops/research-needs/" + needId + "/activate", {}, sessions.ram);

  const reserveResponse = await postForm("/api/orders/reserve", {
    animalCaseId: animalId,
    researchNeedId: needId
  }, sessions.scientist);
  const orderId = redirectId(reserveResponse, "ORD-");

  await postForm("/api/orders/" + orderId + "/commit", {
    receivingFacilityName: "Example Translational Sciences Lab",
    receivingFacilityAddress: "100 Research Way, Test City, MD 20000",
    protocolReference: "PROTO-" + label,
    institutionalApprovalAttested: true,
    purchasingAuthorityAttested: true
  }, sessions.procurement);

  await postForm("/api/finance/orders/" + orderId + "/acquire", {}, sessions.finance);

  const financeHtml = await page("/finance", sessions.finance);
  const settlementId = firstLinkedId(financeHtml, "/finance/settlements/", "FS-");

  await postForm("/api/finance/settlements/" + settlementId + "/movement", {
    movementType: "SUPPLIER_PAYOUT",
    amountUsd: 200,
    externalReference: "supplier-" + label,
    notes: "Pilot supplier payout"
  }, sessions.finance);

  await postForm("/api/compliance/orders/" + orderId + "/review", {
    decision: "CLEARED",
    protocolConfirmed: true,
    receivingFacilityConfirmed: true,
    welfareConfirmed: true,
    biosecurityConfirmed: true,
    movementRequirementsConfirmed: true,
    transportPlanConfirmed: true,
    sourceProvenanceConfirmed: true,
    notes: "Pilot clearance passed."
  }, sessions.compliance);

  await postForm("/api/ops/logistics/assign", {
    orderId,
    transportOrganizationId: "demo-logistics-organization",
    movementDocumentRefs: "MOVE-" + label,
    sanitationRequirements: "Disinfect transport surfaces before loading.",
    specialInstructions: "Maintain cleared welfare and biosecurity plan."
  }, sessions.ram);

  const transportHtml = await page("/transport", sessions.transporter);
  const assignmentId = firstLinkedId(transportHtml, "/transport/", "TA-");
  const transportDetail = await page("/transport/" + assignmentId, sessions.transporter);
  assertContains(transportDetail, "Minimum-necessary transport packet", "transport detail");
  if (transportDetail.includes("Anonymous Partner Farm")) fail("Transport packet leaked farm legal identity");

  await postForm("/api/transport/" + assignmentId + "/event", {
    eventType: "PICKUP_CONFIRMED",
    sanitationConfirmed: true,
    custodyAttestation: true,
    notes: "Pilot pickup confirmed."
  }, sessions.transporter);
  await postForm("/api/transport/" + assignmentId + "/event", {
    eventType: "DELIVERY_CONFIRMED",
    custodyAttestation: true,
    notes: "Pilot delivery confirmed."
  }, sessions.transporter);

  return { needId, orderId, settlementId, label };
}

async function closeSettlement(settlementId, label) {
  await postForm("/api/finance/settlements/" + settlementId + "/close", {
    reconciliationReference: "recon-" + label,
    reconciliationNotes: "Pilot reconciliation completed.",
    reconciliationAttestation: true
  }, sessions.finance);
}

async function runHappyPath() {
  const flow = await createDeliveredOrder("happy");
  await postForm("/api/receiving/" + flow.orderId + "/inspect", {
    decision: "ACCEPT",
    animalIdentityConfirmed: true,
    movementDocumentsReceived: true,
    physicalConditionConsistent: true,
    welfareIntakeAcceptable: true,
    notes: "Pilot receiving acceptance.",
    inspectorAttestation: true
  }, sessions.receiver);

  await postForm("/api/finance/settlements/" + flow.settlementId + "/movement", {
    movementType: "BUYER_PAYMENT",
    amountUsd: 5000,
    externalReference: "buyer-happy",
    notes: "Pilot buyer payment"
  }, sessions.finance);
  await postForm("/api/finance/settlements/" + flow.settlementId + "/finalize", {}, sessions.finance);
  await closeSettlement(flow.settlementId, "happy");

  const orderHtml = await page("/orders/" + flow.orderId, sessions.procurement);
  assertContains(orderHtml, "CLOSED", "happy-path buyer order");
}

async function rejectDeliveredOrder(flow, resolutionType) {
  await postForm("/api/receiving/" + flow.orderId + "/inspect", {
    decision: "REJECT",
    animalIdentityConfirmed: true,
    movementDocumentsReceived: true,
    physicalConditionConsistent: false,
    welfareIntakeAcceptable: true,
    discrepancyNotes: "Physical condition materially differed from the cleared shipping record during intake.",
    notes: "Pilot receiving rejection.",
    inspectorAttestation: true
  }, sessions.receiver);

  await postForm("/api/finance/settlements/" + flow.settlementId + "/movement", {
    movementType: "BUYER_PAYMENT",
    amountUsd: 5000,
    externalReference: "buyer-" + flow.label
  }, sessions.finance);
  await postForm("/api/finance/settlements/" + flow.settlementId + "/movement", {
    movementType: "BUYER_CREDIT",
    amountUsd: 5000,
    externalReference: "credit-" + flow.label,
    notes: "Full credit for rejected receipt."
  }, sessions.finance);
  await postForm("/api/finance/settlements/" + flow.settlementId + "/movement", {
    movementType: "BUYER_REFUND",
    amountUsd: 5000,
    externalReference: "refund-" + flow.label,
    notes: "Cash refund after full credit."
  }, sessions.finance);

  const disputeHtml = await page("/ops/disputes", sessions.ram);
  const disputeId = firstLinkedId(disputeHtml, "/ops/disputes/", "OD-");

  await postForm("/api/ops/disputes/" + disputeId + "/resolve", {
    resolutionType,
    resolutionNotes: resolutionType === "REPLACEMENT"
      ? "Pilot dispute fully unwound; reopen the research need for a replacement match."
      : "Pilot dispute fully unwound; refund complete and research need should close.",
    operatorAttestation: true
  }, sessions.ram);

  await closeSettlement(flow.settlementId, flow.label);

  const orderHtml = await page("/orders/" + flow.orderId, sessions.procurement);
  assertContains(orderHtml, "CLOSED", resolutionType + " buyer order");

  const researchHtml = await page("/research", sessions.scientist);
  assertContains(researchHtml, flow.needId, resolutionType + " research need");
  assertContains(researchHtml, resolutionType === "REPLACEMENT" ? "ACTIVE" : "CLOSED", resolutionType + " research need status");
}

await waitForServer();
for (const actor of ["farmer", "scientist", "veterinarian", "ram", "procurement", "finance", "compliance", "transporter", "receiver"]) {
  sessions[actor] = await login(actor);
}

await postForm("/api/finance/pricing-policies", {
  species: "Swine",
  standardizedCullScheduleUsd: 250,
  marketCeilingUsd: 200
}, sessions.finance);

await runHappyPath();
await rejectDeliveredOrder(await createDeliveredOrder("replacement"), "REPLACEMENT");
await rejectDeliveredOrder(await createDeliveredOrder("refund"), "REFUND");

console.log("RAM prototype E2E passed: happy path, replacement, and refund.");
