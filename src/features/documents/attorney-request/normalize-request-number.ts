export type AttorneyRequestNumberNormalizationResult = {
  rawInput: string;
  normalized: string;
  isValid: boolean;
};

export function normalizeAttorneyRequestNumber(input: string): AttorneyRequestNumberNormalizationResult {
  const rawInput = input.trim();
  const withoutRepeatedBar = rawInput.replace(/\bBAR\b|BAR(?=\d)/gi, " ");
  const digits = withoutRepeatedBar.replace(/\D/g, "");
  const normalized = digits.length > 0 ? `BAR-${digits}` : "";

  return {
    rawInput,
    normalized,
    isValid: /^BAR-\d+$/.test(normalized),
  };
}
