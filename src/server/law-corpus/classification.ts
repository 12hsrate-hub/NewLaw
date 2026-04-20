export type LawTopicClassification = "primary" | "supplement" | "ignored";

type ManualOverrideState = {
  isExcluded?: boolean;
  classificationOverride?: "primary" | "supplement" | null;
};

const supplementTitlePattern =
  /нормативн(?:ый|ые)\s+акт(?:ы)?\s+изменени[яе]\s+законодательн(?:ой|ую)\s+баз/iu;
const ignoredTitlePatterns = [
  /судебн(?:ые|ый)\s+прецедент/iu,
  /форма\s+обращени/iu,
  /список\s+сенатор/iu,
  /регламент\s+проведени[яе]\s+заседани/iu,
];
const primaryTitlePatterns = [
  /\bзакон\b/iu,
  /кодекс/iu,
  /конституци/iu,
  /устав/iu,
  /положение/iu,
  /регламент/iu,
];

export function classifyLawTopicTitle(
  title: string,
  manualOverride: ManualOverrideState = {},
): LawTopicClassification {
  if (manualOverride.isExcluded) {
    return "ignored";
  }

  if (manualOverride.classificationOverride) {
    return manualOverride.classificationOverride;
  }

  if (ignoredTitlePatterns.some((pattern) => pattern.test(title))) {
    return "ignored";
  }

  if (supplementTitlePattern.test(title)) {
    return "supplement";
  }

  if (primaryTitlePatterns.some((pattern) => pattern.test(title))) {
    return "primary";
  }

  return "ignored";
}
