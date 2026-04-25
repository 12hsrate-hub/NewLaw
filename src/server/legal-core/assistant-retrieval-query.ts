import type { LegalCoreIntent } from "@/server/legal-core/metadata";
import type { LawFamily, NormRole } from "@/server/legal-core/legal-selection";

export const assistantRetrievalRuntimeTags = [
  "material_offense",
  "detention",
  "ticket",
  "identity_check",
  "attorney",
  "attorney_request",
  "bodycam",
  "evidence",
  "official_duty",
  "special_service_scope",
  "public_assembly",
  "immunity",
] as const;

export type AssistantRetrievalRuntimeTag = (typeof assistantRetrievalRuntimeTags)[number];

export type AssistantRetrievalPlanInput = {
  normalized_input: string;
  intent: LegalCoreIntent;
  required_law_families: LawFamily[];
  preferred_norm_roles: NormRole[];
  legal_anchors: Array<keyof typeof anchorTermDictionary>;
  question_scope: "general_question" | "self_case" | "representative_case";
  forbidden_scope_markers: string[];
};

export type AssistantRetrievalQueryBreakdown = {
  expanded_query: string;
  base_terms: string[];
  anchor_terms: string[];
  family_terms: string[];
  runtime_tags: AssistantRetrievalRuntimeTag[];
  applied_biases: string[];
};

const DEFAULT_PRECEDENT_RETRIEVAL_QUERY_MAX_LENGTH = 500;
const DEFAULT_ASSISTANT_RETRIEVAL_QUERY_MAX_LENGTH = 500;

const anchorTermDictionary = {
  administrative_offense: [
    "административный кодекс",
    "правонарушение",
    "состав",
    "штраф",
    "тикет",
    "маскировка",
  ],
  detention_procedure: [
    "процессуальный кодекс",
    "задержание",
    "основания задержания",
    "доставка",
    "идентификация",
  ],
  attorney_rights: ["адвокат", "защитник", "право на защиту", "допуск защитника"],
  attorney_request: [
    "адвокатский запрос",
    "официальный адвокатский запрос",
    "срок ответа",
    "обязанность ответить",
  ],
  video_recording: ["bodycam", "body-cam", "бодикам", "видеофиксация", "видеозапись"],
  official_duty: ["служебные обязанности", "обязан", "руководство", "должностное лицо"],
  sanction: ["санкция", "штраф", "ответственность", "наказание"],
  exception: ["исключение", "кроме случаев", "за исключением"],
  remedy: ["жалоба", "обжалование", "оспаривание"],
  evidence: ["доказательства", "запись", "видео", "подтверждение"],
} as const satisfies Record<string, readonly string[]>;

const lawFamilyTermDictionary = {
  administrative_code: ["административный кодекс", "административное правонарушение"],
  procedural_code: ["процессуальный кодекс", "процедура задержания"],
  criminal_code: ["уголовный кодекс", "уголовная ответственность"],
  advocacy_law: ["закон об адвокатуре", "адвокатская деятельность"],
  ethics_code: ["этический кодекс", "этические обязанности"],
  constitution: ["конституция", "конституционные гарантии"],
  department_specific: ["ведомственный порядок", "служебный регламент"],
  government_code: ["государственная служба", "служебные обязанности"],
  immunity_law: ["иммунитет", "неприкосновенность"],
  public_assembly_law: ["публичное мероприятие", "митинг", "собрание"],
  other: [],
} as const satisfies Record<LawFamily, readonly string[]>;

function normalizeQuestion(input: string) {
  return input.trim().toLowerCase();
}

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function pushUniqueTerm(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function pushUniqueTerms(target: string[], values: readonly string[]) {
  for (const value of values) {
    pushUniqueTerm(target, value);
  }
}

function pushUniqueTag(target: AssistantRetrievalRuntimeTag[], value: AssistantRetrievalRuntimeTag) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function buildHintedQuery(input: {
  normalizedInput: string;
  hints: string[];
  prefixLabel: string;
  maxLength: number;
}) {
  if (input.normalizedInput.length === 0) {
    return input.normalizedInput;
  }

  if (input.normalizedInput.length >= input.maxLength) {
    return input.normalizedInput.slice(0, input.maxLength);
  }

  if (input.hints.length === 0) {
    return input.normalizedInput;
  }

  const prefix = `${input.normalizedInput}\n\n${input.prefixLabel}: `;
  const selectedHints: string[] = [];
  let currentLength = prefix.length;

  for (const hint of input.hints) {
    const separatorLength = selectedHints.length > 0 ? 2 : 0;
    const nextLength = currentLength + separatorLength + hint.length;

    if (nextLength > input.maxLength) {
      break;
    }

    selectedHints.push(hint);
    currentLength = nextLength;
  }

  if (selectedHints.length === 0) {
    return input.normalizedInput;
  }

  return `${prefix}${selectedHints.join("; ")}`;
}

function tokenizeBaseTerms(input: string) {
  return Array.from(
    new Set(normalizeQuestion(input).match(/[\p{L}\p{N}._-]+/gu) ?? []),
  ).filter((token) => token.length >= 2);
}

function buildRuntimeTags(input: AssistantRetrievalPlanInput) {
  const normalizedSource = normalizeQuestion(input.normalized_input);
  const tags: AssistantRetrievalRuntimeTag[] = [];

  if (input.legal_anchors.includes("administrative_offense")) {
    pushUniqueTag(tags, "material_offense");
  }

  if (input.legal_anchors.includes("detention_procedure")) {
    pushUniqueTag(tags, "detention");
  }

  if (hasKeyword(normalizedSource, ["штраф", "тикет", "квитанц"])) {
    pushUniqueTag(tags, "ticket");
  }

  if (hasKeyword(normalizedSource, ["идентификац", "личност"])) {
    pushUniqueTag(tags, "identity_check");
  }

  if (input.legal_anchors.includes("attorney_rights")) {
    pushUniqueTag(tags, "attorney");
  }

  if (input.legal_anchors.includes("attorney_request")) {
    pushUniqueTag(tags, "attorney");
    pushUniqueTag(tags, "attorney_request");
  }

  if (input.legal_anchors.includes("video_recording")) {
    pushUniqueTag(tags, "bodycam");
  }

  if (input.legal_anchors.includes("evidence") || input.intent === "evidence_check") {
    pushUniqueTag(tags, "evidence");
  }

  if (input.legal_anchors.includes("official_duty")) {
    pushUniqueTag(tags, "official_duty");
  }

  if (
    hasKeyword(normalizedSource, [
      "департамент",
      "тюрьм",
      "нацгвард",
      "национальн гвард",
      "управление тюрем",
      "правительство",
    ])
  ) {
    pushUniqueTag(tags, "special_service_scope");
  }

  if (hasKeyword(normalizedSource, ["митинг", "акци", "публичн меропр", "собра"])) {
    pushUniqueTag(tags, "public_assembly");
  }

  if (hasKeyword(normalizedSource, ["иммунитет", "неприкоснов"])) {
    pushUniqueTag(tags, "immunity");
  }

  return tags;
}

function buildAppliedBiases(input: AssistantRetrievalPlanInput) {
  const biases: string[] = [];

  if (input.required_law_families.includes("administrative_code")) {
    biases.push("prefer_family:administrative_code");
  }

  if (input.required_law_families.includes("advocacy_law")) {
    biases.push("prefer_family:advocacy_law");
  }

  if (input.required_law_families.includes("procedural_code")) {
    biases.push("prefer_family:procedural_code_secondary");
  }

  if (input.question_scope === "general_question") {
    biases.push("demote_department_specific_for_general_question");
  }

  if (input.forbidden_scope_markers.includes("публичное мероприятие")) {
    biases.push("demote_public_assembly_without_marker");
  }

  if (input.forbidden_scope_markers.includes("иммунитет")) {
    biases.push("demote_immunity_without_marker");
  }

  if (
    input.preferred_norm_roles.includes("primary_basis") &&
    !input.preferred_norm_roles.includes("procedure")
  ) {
    biases.push("prefer_material_basis_over_procedure");
  }

  return biases;
}

export function buildAssistantRetrievalQuery(
  input: AssistantRetrievalPlanInput,
): AssistantRetrievalQueryBreakdown {
  const normalizedInput = input.normalized_input.trim();

  if (normalizedInput.length === 0) {
    return {
      expanded_query: normalizedInput,
      base_terms: [],
      anchor_terms: [],
      family_terms: [],
      runtime_tags: [],
      applied_biases: [],
    };
  }

  const anchorTerms: string[] = [];

  for (const anchor of input.legal_anchors) {
    pushUniqueTerms(anchorTerms, anchorTermDictionary[anchor] ?? []);
  }

  const familyTerms: string[] = [];

  for (const family of input.required_law_families) {
    pushUniqueTerms(familyTerms, lawFamilyTermDictionary[family] ?? []);
  }

  const baseTerms = tokenizeBaseTerms(normalizedInput);
  const runtimeTags = buildRuntimeTags(input);
  const appliedBiases = buildAppliedBiases(input);
  const retrievalHints = Array.from(new Set([...anchorTerms, ...familyTerms]));

  return {
    expanded_query: buildHintedQuery({
      normalizedInput,
      hints: retrievalHints,
      prefixLabel: "retrieval_hints",
      maxLength: DEFAULT_ASSISTANT_RETRIEVAL_QUERY_MAX_LENGTH,
    }),
    base_terms: baseTerms,
    anchor_terms: anchorTerms,
    family_terms: familyTerms,
    runtime_tags: runtimeTags,
    applied_biases: appliedBiases,
  };
}

export function buildAssistantPrecedentRetrievalQuery(input: {
  normalized_input: string;
  breakdown: AssistantRetrievalQueryBreakdown;
  maxLength?: number;
}) {
  const maxLength = input.maxLength ?? DEFAULT_PRECEDENT_RETRIEVAL_QUERY_MAX_LENGTH;
  const normalizedInput = input.normalized_input.trim();

  const hints = Array.from(
    new Set(
      [...input.breakdown.anchor_terms, ...input.breakdown.family_terms].filter(
        (term) => term.trim().length > 0,
      ),
    ),
  );

  return buildHintedQuery({
    normalizedInput,
    hints,
    prefixLabel: "precedent_hints",
    maxLength,
  });
}
