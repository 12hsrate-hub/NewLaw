export type PrecedentTopicClassification = "precedent_candidate" | "ignored";

type ManualOverrideState = {
  isExcluded?: boolean;
  classificationOverride?: "precedent" | "ignored" | null;
  relatedLawExists?: boolean;
};

const explicitPrecedentPatterns = [
  /судебн(?:ый|ые)\s+прецедент/iu,
  /\bпрецедент\b/iu,
  /решени[ея]\s+верховного\s+суда/iu,
  /постановлени[ея]\s+верховного\s+суда/iu,
];

const explicitIgnoredPatterns = [
  /\bзакон\b/iu,
  /кодекс/iu,
  /конституци/iu,
  /нормативн(?:ый|ые)\s+акт(?:ы)?\s+изменени[яе]\s+законодательн(?:ой|ую)\s+баз/iu,
];

export function classifyPrecedentTopicTitle(
  title: string,
  manualOverride: ManualOverrideState = {},
): PrecedentTopicClassification {
  if (manualOverride.isExcluded) {
    return "ignored";
  }

  if (manualOverride.classificationOverride === "ignored") {
    return "ignored";
  }

  if (manualOverride.classificationOverride === "precedent") {
    return "precedent_candidate";
  }

  if (manualOverride.relatedLawExists) {
    return "ignored";
  }

  if (explicitIgnoredPatterns.some((pattern) => pattern.test(title))) {
    return "ignored";
  }

  if (explicitPrecedentPatterns.some((pattern) => pattern.test(title))) {
    return "precedent_candidate";
  }

  return "ignored";
}
