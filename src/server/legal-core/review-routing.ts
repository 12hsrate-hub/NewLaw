import type { LegalCoreRiskLevel, LegalCoreSelfAssessment } from "@/server/legal-core/metadata";

export type FutureAIQualityReviewMarker = {
  queue_for_future_ai_quality_review: boolean;
  future_review_priority: LegalCoreRiskLevel;
  future_review_flags: string[];
  future_review_reason_codes: string[];
};

function buildMarker(input: {
  priority: LegalCoreRiskLevel;
  flags: string[];
  reasonCodes: string[];
}): FutureAIQualityReviewMarker {
  const flags = Array.from(new Set(input.flags));
  const reasonCodes = Array.from(new Set(input.reasonCodes));

  return {
    queue_for_future_ai_quality_review: flags.length > 0 || reasonCodes.length > 0,
    future_review_priority: input.priority,
    future_review_flags: flags,
    future_review_reason_codes: reasonCodes,
  };
}

function derivePriority(selfAssessment: LegalCoreSelfAssessment, reasonCodes: string[]) {
  if (
    selfAssessment.answer_risk_level === "high" ||
    reasonCodes.includes("no_usable_corpus") ||
    reasonCodes.includes("insufficient_grounding") ||
    reasonCodes.includes("law_version_contract_violation") ||
    reasonCodes.includes("model_unavailable_after_retrieval") ||
    reasonCodes.includes("rewrite_proxy_unavailable")
  ) {
    return "high" as const;
  }

  if (
    selfAssessment.answer_risk_level === "medium" ||
    selfAssessment.insufficient_data ||
    reasonCodes.includes("precedent_only_grounding") ||
    reasonCodes.includes("missing_fact_data")
  ) {
    return "medium" as const;
  }

  return "low" as const;
}

export function buildAssistantFutureReviewMarker(input: {
  selfAssessment: LegalCoreSelfAssessment;
  status: "answered" | "no_norms" | "no_corpus" | "unavailable";
  lawResultCount: number;
  precedentResultCount: number;
  lawVersionContractConsistent?: boolean;
}) {
  const flags: string[] = [];
  const reasonCodes: string[] = [];

  if (input.selfAssessment.insufficient_data) {
    flags.push("insufficient_data");
  }

  if (input.selfAssessment.answer_risk_level !== "low") {
    flags.push("elevated_answer_risk");
  }

  if (input.status === "no_corpus") {
    reasonCodes.push("no_usable_corpus");
  }

  if (input.status === "no_norms") {
    reasonCodes.push("no_relevant_norms");
  }

  if (input.status === "unavailable") {
    reasonCodes.push("model_unavailable_after_retrieval");
  }

  if (input.status === "answered" && input.lawResultCount === 0 && input.precedentResultCount > 0) {
    reasonCodes.push("precedent_only_grounding");
  }

  if (input.lawVersionContractConsistent === false) {
    reasonCodes.push("law_version_contract_violation");
  }

  return buildMarker({
    priority: derivePriority(input.selfAssessment, reasonCodes),
    flags,
    reasonCodes,
  });
}

export function buildDocumentRewriteFutureReviewMarker(input: {
  selfAssessment: LegalCoreSelfAssessment;
  status: "success" | "unavailable";
  missingDataCount: number;
  usedSourceCount: number;
  lawVersionContractConsistent?: boolean;
}) {
  const flags: string[] = [];
  const reasonCodes: string[] = [];

  if (input.selfAssessment.insufficient_data) {
    flags.push("insufficient_data");
  }

  if (input.selfAssessment.answer_risk_level !== "low") {
    flags.push("elevated_answer_risk");
  }

  if (input.missingDataCount > 0) {
    reasonCodes.push("missing_fact_data");
  }

  if (input.usedSourceCount === 0) {
    reasonCodes.push("no_legal_guardrails");
  }

  if (input.status === "unavailable") {
    reasonCodes.push("rewrite_proxy_unavailable");
  }

  if (input.lawVersionContractConsistent === false) {
    reasonCodes.push("law_version_contract_violation");
  }

  return buildMarker({
    priority: derivePriority(input.selfAssessment, reasonCodes),
    flags,
    reasonCodes,
  });
}

export function buildGroundedDocumentRewriteFutureReviewMarker(input: {
  selfAssessment: LegalCoreSelfAssessment;
  status: "success" | "unavailable" | "insufficient_corpus";
  missingDataCount: number;
  groundingMode: "law_grounded" | "precedent_grounded" | null;
  lawVersionContractConsistent?: boolean;
}) {
  const flags: string[] = [];
  const reasonCodes: string[] = [];

  if (input.selfAssessment.insufficient_data) {
    flags.push("insufficient_data");
  }

  if (input.selfAssessment.answer_risk_level !== "low") {
    flags.push("elevated_answer_risk");
  }

  if (input.missingDataCount > 0) {
    reasonCodes.push("missing_fact_data");
  }

  if (input.groundingMode === "precedent_grounded") {
    reasonCodes.push("precedent_only_grounding");
  }

  if (input.status === "insufficient_corpus") {
    reasonCodes.push("insufficient_grounding");
  }

  if (input.status === "unavailable") {
    reasonCodes.push("rewrite_proxy_unavailable");
  }

  if (input.lawVersionContractConsistent === false) {
    reasonCodes.push("law_version_contract_violation");
  }

  return buildMarker({
    priority: derivePriority(input.selfAssessment, reasonCodes),
    flags,
    reasonCodes,
  });
}
