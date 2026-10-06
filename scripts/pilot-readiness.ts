import {
  evaluatePilotReadiness,
  readinessSummary
} from "../lib/pilot-readiness";

const checks = evaluatePilotReadiness(process.env);
for (const check of checks) {
  console.log(
    "[" + check.status.padEnd(6) + "] " + check.label + " — " + check.detail
  );
}

const summary = readinessSummary(checks);
console.log("");
console.log(
  "Automatic configuration: " +
    (summary.automaticReady ? "READY" : "BLOCKED") +
    "; manual deployment gates: " +
    summary.manualGates
);

if (!summary.automaticReady) {
  process.exitCode = 1;
}
