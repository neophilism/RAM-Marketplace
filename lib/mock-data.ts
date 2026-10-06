import type { AnimalListing } from "@/lib/domain";

export const animalListings: AnimalListing[] = [
  {
    id: "RAM-SW-0001847",
    species: "Swine",
    breed: "Yorkshire cross",
    sex: "Female",
    age: "18 months",
    weightKg: 118,
    condition: "Progressive sensorineural hearing loss",
    phenotype: ["Bilateral threshold elevation", "Stable vestibular function", "No otitis externa"],
    diseaseStage: "Moderate",
    diagnosticConfidence: "Confirmed",
    comorbidities: [],
    diagnosticEvidence: [],
    region: "Midwest U.S.",
    availability: "14 days",
    priceUsd: 7800,
    ramVerified: true,
    sourceDisclosure: "REQUESTABLE",
    transportReady: true,
    summary: "Naturally occurring bilateral auditory impairment documented over 7 months."
  },
  {
    id: "RAM-BO-0000921",
    species: "Bovine",
    breed: "Holstein",
    sex: "Female",
    age: "5 years",
    weightKg: 612,
    condition: "Chronic osteoarthritis",
    phenotype: ["Bilateral stifle degeneration", "Reduced range of motion", "Weight-bearing asymmetry"],
    diseaseStage: "Moderate–advanced",
    diagnosticConfidence: "High",
    comorbidities: [],
    diagnosticEvidence: [],
    region: "Upper Midwest U.S.",
    availability: "21 days",
    priceUsd: 11200,
    ramVerified: true,
    sourceDisclosure: "POST_RESERVATION",
    transportReady: true,
    summary: "Longitudinal farm records document progressive mobility decline without experimental induction."
  },
  {
    id: "RAM-OV-0000473",
    species: "Ovine",
    breed: "Dorset",
    sex: "Male",
    age: "4 years",
    weightKg: 91,
    condition: "Dilated cardiomyopathy phenotype",
    phenotype: ["Reduced fractional shortening", "Exercise intolerance", "No acute infectious signs"],
    diseaseStage: "Early–moderate",
    diagnosticConfidence: "Confirmed",
    comorbidities: [],
    diagnosticEvidence: [],
    region: "Northeast U.S.",
    availability: "10 days",
    priceUsd: 9400,
    ramVerified: true,
    sourceDisclosure: "REQUESTABLE",
    transportReady: false,
    summary: "Naturally developed cardiac dysfunction with repeat echocardiographic confirmation."
  }
];

export function getAnimal(id: string) {
  return animalListings.find((animal) => animal.id === id);
}
