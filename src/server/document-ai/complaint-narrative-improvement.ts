import {
  complaintNarrativeImprovementUsageMetaSchema,
  complaintNarrativeImprovementResultSchema,
  complaintNarrativeImprovementRuntimeInputSchema,
  type ComplaintNarrativeImprovementResult,
  type ComplaintNarrativeImprovementRuntimeInput,
  type ComplaintNarrativeLengthMode,
  type ComplaintNarrativeRiskFlag,
  type ComplaintNarrativeImprovementUsageMeta,
} from "@/schemas/document-ai";
import type { DocumentAuthorSnapshot } from "@/schemas/document";
import { ZodError } from "zod";
import { createAIRequest } from "@/db/repositories/ai-request.repository";
import { getDocumentByIdForAccount } from "@/db/repositories/document.repository";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import {
  COMPLAINT_NARRATIVE_IMPROVEMENT_PROMPT_VERSION,
  extractProxyUsageMetrics,
} from "@/server/legal-core/observability";
import {
  DocumentAccessDeniedError,
  readDocumentAuthorSnapshot,
  readOgpComplaintDraftPayload,
} from "@/server/document-area/persistence";

const NARRATIVE_FEATURE_KEY = "complaint_narrative_improvement";
const AMBIGUOUS_DATE_TIME_REVIEW_NOTE =
  "Необходимо проверить, к какому именно событию относится указанная дата/время.";
const MISSING_EVIDENCE_REVIEW_NOTE =
  "В raw_situation_description упомянуто доказательство, но в evidence list оно не подтверждено.";
const MAX_IMPROVED_TEXT_PREVIEW_LENGTH = 240;

type ComplaintNarrativeImprovementDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: ComplaintNarrativeImprovementDependencies = {
  getDocumentByIdForAccount,
  requestProxyCompletion: requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

export type ComplaintNarrativeImprovementBlockedReason =
  | "missing_server_id"
  | "missing_active_character"
  | "missing_applicant_role"
  | "missing_organization"
  | "missing_subject_name"
  | "missing_victim_or_trustor_mode"
  | "missing_trustor_name"
  | "missing_raw_situation_description"
  | "missing_date_time";

export class ComplaintNarrativeImprovementBlockedError extends Error {
  constructor(public readonly reasons: ComplaintNarrativeImprovementBlockedReason[]) {
    super("Complaint narrative improvement blocked.");
    this.name = "ComplaintNarrativeImprovementBlockedError";
  }
}

export class ComplaintNarrativeImprovementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintNarrativeImprovementValidationError";
  }
}

export class ComplaintNarrativeImprovementUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintNarrativeImprovementUnavailableError";
  }
}

export class ComplaintNarrativeImprovementInvalidOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintNarrativeImprovementInvalidOutputError";
  }
}

export class ComplaintNarrativeImprovementUnsupportedDocumentTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintNarrativeImprovementUnsupportedDocumentTypeError";
  }
}

export class ComplaintNarrativeImprovementInvalidDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplaintNarrativeImprovementInvalidDraftError";
  }
}

function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function deriveApplicantRole(input: {
  authorSnapshot: DocumentAuthorSnapshot;
  filingMode: "self" | "representative";
}) {
  if (input.filingMode === "representative") {
    if (
      input.authorSnapshot.accessFlags.includes("advocate") ||
      input.authorSnapshot.roleKeys.includes("lawyer")
    ) {
      return "representative_advocate";
    }

    return "representative_applicant";
  }

  return "self_applicant";
}

function formatTrustorMode(input: {
  filingMode: "self" | "representative";
  trustorName: string | null;
}) {
  if (input.filingMode === "representative") {
    return {
      victim_or_trustor_mode: "trustor" as const,
      victim_or_trustor_name: input.trustorName,
    };
  }

  return {
    victim_or_trustor_mode: "self" as const,
    victim_or_trustor_name: null,
  };
}

function formatEvidenceList(
  evidenceItems: Array<{
    labelSnapshot: string;
    url: string;
  }>,
) {
  return evidenceItems
    .map((item) => ({
      label: item.labelSnapshot.trim(),
      ...(item.url.trim().length > 0 ? { url: item.url.trim() } : {}),
    }))
    .filter((item) => item.label.length > 0)
    .slice(0, 40);
}

function formatLegalContext(input: {
  selectedLegalContext?:
    | {
        laws?: Array<{
          law_name: string;
          article?: string;
          part?: string;
          excerpt?: string;
        }>;
        precedents?: Array<{
          title: string;
          reason: string;
        }>;
      }
    | null;
}) {
  if (!input.selectedLegalContext) {
    return null;
  }

  return {
    laws: (input.selectedLegalContext.laws ?? []).slice(0, 8),
    precedents: (input.selectedLegalContext.precedents ?? []).slice(0, 4),
  };
}

export function buildComplaintNarrativeImprovementInputFromDraft(input: {
  document: {
    documentType: string;
    serverId: string;
    authorSnapshotJson: unknown;
    formPayloadJson: unknown;
  };
  lawVersion?: string | null;
  lengthMode?: ComplaintNarrativeLengthMode;
  attorneyRequestContext?: Record<string, unknown> | null;
  arrestOrBodycamContext?: Record<string, unknown> | null;
  selectedLegalContext?:
    | {
        laws?: Array<{
          law_name: string;
          article?: string;
          part?: string;
          excerpt?: string;
        }>;
        precedents?: Array<{
          title: string;
          reason: string;
        }>;
      }
    | null;
}) {
  if (input.document.documentType !== "ogp_complaint") {
    throw new ComplaintNarrativeImprovementUnsupportedDocumentTypeError(
      "Complaint narrative improvement поддерживается только для OGP complaint drafts.",
    );
  }

  const authorSnapshot = readDocumentAuthorSnapshot(input.document.authorSnapshotJson);
  const payload = readOgpComplaintDraftPayload(input.document.formPayloadJson);
  const trustorName = payload.trustorSnapshot?.fullName.trim() || null;
  const trustorMode = formatTrustorMode({
    filingMode: payload.filingMode,
    trustorName,
  });

  return complaintNarrativeImprovementRuntimeInputSchema.parse({
    server_id: input.document.serverId,
    law_version: input.lawVersion ?? null,
    active_character: {
      full_name: authorSnapshot.fullName.trim(),
      role_label: authorSnapshot.position.trim() || null,
    },
    applicant_role: deriveApplicantRole({
      authorSnapshot,
      filingMode: payload.filingMode,
    }),
    representative_mode: payload.filingMode,
    victim_or_trustor_mode: trustorMode.victim_or_trustor_mode,
    victim_or_trustor_name: trustorMode.victim_or_trustor_name,
    organization: payload.objectOrganization.trim(),
    subject_name: payload.objectFullName.trim(),
    date_time: payload.incidentAt.trim(),
    raw_situation_description: payload.situationDescription.trim(),
    evidence_list: formatEvidenceList(payload.evidenceItems),
    attorney_request_context: input.attorneyRequestContext ?? null,
    arrest_or_bodycam_context: input.arrestOrBodycamContext ?? null,
    selected_legal_context: formatLegalContext({
      selectedLegalContext: input.selectedLegalContext,
    }),
    length_mode: input.lengthMode ?? "normal",
  });
}

export function buildComplaintNarrativeImprovementRuntimeInput(input: {
  document: {
    documentType: "ogp_complaint";
    serverId: string;
    authorSnapshotJson: unknown;
    formPayloadJson: unknown;
  };
  lawVersion?: string | null;
  lengthMode?: ComplaintNarrativeLengthMode;
  attorneyRequestContext?: Record<string, unknown> | null;
  arrestOrBodycamContext?: Record<string, unknown> | null;
  selectedLegalContext?:
    | {
        laws?: Array<{
          law_name: string;
          article?: string;
          part?: string;
          excerpt?: string;
        }>;
        precedents?: Array<{
          title: string;
          reason: string;
        }>;
      }
    | null;
}) {
  return buildComplaintNarrativeImprovementInputFromDraft(input);
}

export function validateComplaintNarrativeImprovementPreflight(
  input: ComplaintNarrativeImprovementRuntimeInput,
) {
  const reasons: ComplaintNarrativeImprovementBlockedReason[] = [];

  if (input.server_id.trim().length === 0) {
    reasons.push("missing_server_id");
  }

  if (input.active_character.full_name.trim().length === 0) {
    reasons.push("missing_active_character");
  }

  if ((input.applicant_role ?? "").trim().length === 0) {
    reasons.push("missing_applicant_role");
  }

  if (input.organization.trim().length === 0) {
    reasons.push("missing_organization");
  }

  if (input.subject_name.trim().length === 0) {
    reasons.push("missing_subject_name");
  }

  if (!["self", "trustor"].includes(input.victim_or_trustor_mode)) {
    reasons.push("missing_victim_or_trustor_mode");
  }

  if (
    input.victim_or_trustor_mode === "trustor" &&
    (input.victim_or_trustor_name ?? "").trim().length === 0
  ) {
    reasons.push("missing_trustor_name");
  }

  if (input.raw_situation_description.trim().length === 0) {
    reasons.push("missing_raw_situation_description");
  }

  if (input.date_time.trim().length === 0) {
    reasons.push("missing_date_time");
  }

  return reasons;
}

export function assertComplaintNarrativeImprovementPreflight(
  input: ComplaintNarrativeImprovementRuntimeInput,
) {
  const reasons = validateComplaintNarrativeImprovementPreflight(input);

  if (reasons.length > 0) {
    throw new ComplaintNarrativeImprovementBlockedError(reasons);
  }
}

function formatLengthMode(mode: ComplaintNarrativeLengthMode) {
  if (mode === "short") {
    return "short (900-1400 chars, hard max 4000)";
  }

  if (mode === "detailed") {
    return "detailed (2500-3500 chars, hard max 4000)";
  }

  return "normal (1800-2600 chars, hard max 4000)";
}

function buildLegalContextSummary(input: ComplaintNarrativeImprovementRuntimeInput) {
  if (!input.selected_legal_context) {
    return "No selected legal context provided.";
  }

  const laws =
    input.selected_legal_context.laws.length > 0
      ? input.selected_legal_context.laws
          .map((law) =>
            [
              law.law_name,
              law.article ? `article=${law.article}` : null,
              law.part ? `part=${law.part}` : null,
            ]
              .filter(Boolean)
              .join(", "),
          )
          .join(" | ")
      : "none";
  const precedents =
    input.selected_legal_context.precedents.length > 0
      ? input.selected_legal_context.precedents
          .map((precedent) => `${precedent.title}: ${precedent.reason}`)
          .join(" | ")
      : "none";

  return [`Laws: ${laws}`, `Precedents: ${precedents}`].join("\n");
}

function buildEvidenceSummary(input: ComplaintNarrativeImprovementRuntimeInput) {
  if (input.evidence_list.length === 0) {
    return "Evidence list: none";
  }

  return `Evidence list: ${input.evidence_list
    .slice(0, 6)
    .map((item) => item.label)
    .join(" | ")}`;
}

function buildStructuredContextSummary(label: string, value: Record<string, unknown> | null | undefined) {
  if (!value) {
    return `${label}: none`;
  }

  return `${label}: ${clampText(JSON.stringify(value), 1_400)}`;
}

function buildRolePhrasingGuidance(input: ComplaintNarrativeImprovementRuntimeInput) {
  const applicantName = input.active_character.full_name;
  const trustorName = input.victim_or_trustor_name?.trim() || "доверителя";

  if (input.representative_mode === "representative") {
    if (input.applicant_role === "representative_advocate") {
      return [
        `Role phrasing guidance: prefer formulas like "Заявитель ${applicantName}, являясь адвокатом и действуя в интересах доверителя ${trustorName}, ...".`,
        `Alternative role phrasing: "В интересах доверителя ${trustorName} заявителем был направлен ...".`,
      ].join("\n");
    }

    return `Role phrasing guidance: prefer "Заявитель ${applicantName}, действуя как представитель доверителя ${trustorName}, ...".`;
  }

  return `Role phrasing guidance: prefer "Заявитель ${applicantName} обращается от своего имени ...".`;
}

export function buildComplaintNarrativeImprovementSystemPrompt() {
  return [
    "Ты улучшаешь только narrative-поле complaint draft: Подробное описание ситуации.",
    "Это не Legal Q&A, не полная жалоба, не violation summary и не BBCode generation.",
    "Верни только structured JSON без markdown и без дополнительных пояснений.",
    "Главный source-of-facts: raw_situation_description.",
    "Остальные поля используются только как context.",
    "short_violation_summary нельзя использовать как source-of-facts.",
    "Не выдумывай новые факты, даты, ФИО, доказательства, статьи и материалы.",
    "Не дублируй полный evidence list.",
    "Не повторяй целиком applicant/trustor blocks и не генерируй всю complaint structure.",
    "Стиль: официальный, юридический, нейтральный, уверенный, без эмоций и разговорных выражений.",
    "Избегай слов 'возможно', 'вероятно', 'если это правда' внутри improved_text.",
    "Нормализуй role phrasing: не смешивай формулы 'представитель' и 'адвокат' в один искусственный статусный ярлык.",
    "Не добавляй роль 'адвокат', если applicant_role этого не подтверждает.",
    "Если applicant_role неясен, используй нейтральные формулы 'заявитель' или 'представитель'.",
    "По умолчанию не используй категоричные обвинительные формулировки.",
    "Нормы и precedents можно использовать только из selected_legal_context.",
    "Если legal context отсутствует, не вставляй invented law refs в improved_text.",
    "date_time по умолчанию ambiguous: не привязывай его автоматически к задержанию, штрафу, отказу или запросу.",
    "Если тип даты неясен, верни risk_flag ambiguous_date_time и review_note про проверку типа события.",
    "Если raw text ссылается на доказательство, которого нет в evidence list, допускается risk_flag missing_evidence и review_note.",
    "Допустимые archetypes: attorney request without materials, detention without recording, disputed qualification, refusal of procedural action, multi-actor case.",
  ].join("\n");
}

export function buildComplaintNarrativeImprovementUserPrompt(
  input: ComplaintNarrativeImprovementRuntimeInput,
) {
  return [
    `Feature key: ${NARRATIVE_FEATURE_KEY}`,
    `Length mode: ${formatLengthMode(input.length_mode)}`,
    `Server id: ${input.server_id}`,
    `Law version: ${input.law_version ?? "not_provided"}`,
    `Applicant: ${input.active_character.full_name}`,
    `Applicant role/status: ${input.applicant_role ?? "not_provided"}`,
    `Representative mode: ${input.representative_mode}`,
    `Victim/trustor mode: ${input.victim_or_trustor_mode}`,
    `Victim/trustor name: ${input.victim_or_trustor_name ?? "not_provided"}`,
    `Organization: ${input.organization}`,
    `Subject name: ${input.subject_name}`,
    `Date/time field: ${input.date_time}`,
    "Date/time caution: date_time is ambiguous by default and must not be tied automatically to detention, refusal, fine, request or recording event.",
    buildEvidenceSummary(input),
    buildStructuredContextSummary("Attorney request context", input.attorney_request_context),
    buildStructuredContextSummary("Arrest/bodycam context", input.arrest_or_bodycam_context),
    "Selected legal context:",
    buildLegalContextSummary(input),
    buildRolePhrasingGuidance(input),
    "",
    "short_violation_summary: do not use as a source of facts, focus or chronology.",
    "Raw situation description:",
    input.raw_situation_description,
    "",
    "Required narrative structure:",
    "1. роль заявителя и доверителя при необходимости",
    "2. фактическое событие",
    "3. действия объекта заявления",
    "4. действия представителя после события",
    "5. материалы / что предоставлено или не предоставлено",
    "6. юридическая значимость",
    "7. применимые нормы только из selected_legal_context",
    "8. короткая финальная связка о необходимости проверки ОГП",
    "",
    "Archetypes to keep in mind:",
    "A. attorney request without materials",
    "B. detention without recording",
    "C. disputed qualification",
    "D. refusal of procedural action",
    "E. multi-actor case",
    "",
    "Output JSON contract:",
    JSON.stringify(
      {
        improved_text: "string",
        legal_basis_used: [
          {
            law_name: "string",
            article: "string?",
            part: "string?",
            reason: "string",
          },
        ],
        used_facts: ["string"],
        missing_facts: ["string"],
        review_notes: ["string"],
        risk_flags: [
          "insufficient_facts",
          "weak_legal_context",
          "missing_evidence",
          "unclear_roles",
          "unclear_timeline",
          "ambiguous_date_time",
          "possible_overclaiming",
          "legal_basis_not_found",
        ],
        should_send_to_review: true,
      },
      null,
      2,
    ),
  ].join("\n");
}

function rawTextMentionsEvidenceWithoutList(input: ComplaintNarrativeImprovementRuntimeInput) {
  if (input.evidence_list.length > 0) {
    return false;
  }

  return /(видеозапис|запис[ьи]|бодикам|bodycam|скрин|скриншот|аудиозапис|документ|материал)/i.test(
    input.raw_situation_description,
  );
}

function extractFinishReason(payload: Record<string, unknown> | null | undefined) {
  if (!payload) {
    return null;
  }

  const choices = payload.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice = choices[0];

  if (!firstChoice || typeof firstChoice !== "object") {
    return null;
  }

  const finishReason = "finish_reason" in firstChoice ? firstChoice.finish_reason : null;

  return typeof finishReason === "string" && finishReason.trim().length > 0
    ? finishReason.trim()
    : null;
}

function parseProxyStructuredJson(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fencedMatch ? fencedMatch[1].trim() : trimmed;

  return JSON.parse(jsonText) as unknown;
}

export function parseComplaintNarrativeImprovementResult(input: {
  runtimeInput: ComplaintNarrativeImprovementRuntimeInput;
  rawResult: unknown;
}): ComplaintNarrativeImprovementResult {
  const parsed = complaintNarrativeImprovementResultSchema.parse(input.rawResult);
  const hasLegalContext =
    !!input.runtimeInput.selected_legal_context &&
    (input.runtimeInput.selected_legal_context.laws.length > 0 ||
      input.runtimeInput.selected_legal_context.precedents.length > 0);

  if (!hasLegalContext && parsed.legal_basis_used.length > 0) {
    throw new ComplaintNarrativeImprovementValidationError(
      "legal_basis_used не должен содержать ссылки на нормы без selected_legal_context.",
    );
  }

  const riskFlags = new Set<ComplaintNarrativeRiskFlag>(parsed.risk_flags);
  const reviewNotes = [...parsed.review_notes];

  if (rawTextMentionsEvidenceWithoutList(input.runtimeInput)) {
    riskFlags.add("missing_evidence");
    if (!reviewNotes.includes(MISSING_EVIDENCE_REVIEW_NOTE)) {
      reviewNotes.push(MISSING_EVIDENCE_REVIEW_NOTE);
    }
  }

  return complaintNarrativeImprovementResultSchema.parse({
    ...parsed,
    review_notes: reviewNotes,
    risk_flags: [...riskFlags],
    should_send_to_review:
      parsed.should_send_to_review ||
      riskFlags.has("missing_evidence") ||
      riskFlags.has("insufficient_facts") ||
      riskFlags.has("unclear_roles") ||
      riskFlags.has("unclear_timeline") ||
      riskFlags.has("ambiguous_date_time") ||
      riskFlags.has("possible_overclaiming"),
  });
}

export function mapComplaintNarrativeImprovementBlockingReasonsToMessages(
  reasons: ComplaintNarrativeImprovementBlockedReason[],
) {
  return reasons.map((reason) => {
    switch (reason) {
      case "missing_server_id":
        return "Не указан server_id.";
      case "missing_active_character":
        return "Не указан активный заявитель.";
      case "missing_applicant_role":
        return "Не указан applicant role или статус заявителя.";
      case "missing_organization":
        return "Не указана организация объекта заявления.";
      case "missing_subject_name":
        return "Не указан объект заявления.";
      case "missing_victim_or_trustor_mode":
        return "Не указан режим подачи: self или trustor.";
      case "missing_trustor_name":
        return "Для представительской жалобы нужно указать ФИО доверителя.";
      case "missing_raw_situation_description":
        return "Не заполнено поле подробного описания ситуации.";
      case "missing_date_time":
        return "Не указаны дата и время.";
    }
  });
}

export async function improveOwnedComplaintNarrative(
  input: {
    accountId: string;
    documentId: string;
    lengthMode?: ComplaintNarrativeLengthMode;
  },
  dependencies: ComplaintNarrativeImprovementDependencies = defaultDependencies,
): Promise<{
  sourceText: string;
  runtimeInput: ComplaintNarrativeImprovementRuntimeInput;
  result: ComplaintNarrativeImprovementResult;
  basedOnUpdatedAt: string;
  usageMeta: ComplaintNarrativeImprovementUsageMeta;
}> {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document) {
    throw new DocumentAccessDeniedError();
  }

  let runtimeInput: ComplaintNarrativeImprovementRuntimeInput;

  try {
    runtimeInput = buildComplaintNarrativeImprovementInputFromDraft({
      document: {
        documentType: document.documentType,
        serverId: document.serverId,
        authorSnapshotJson: document.authorSnapshotJson,
        formPayloadJson: document.formPayloadJson,
      },
      lengthMode: input.lengthMode,
    });
  } catch (error) {
    if (error instanceof ComplaintNarrativeImprovementUnsupportedDocumentTypeError) {
      throw error;
    }

    if (error instanceof ZodError) {
      throw new ComplaintNarrativeImprovementInvalidDraftError(
        "Draft complaint содержит невалидные данные для narrative improvement.",
      );
    }

    throw error;
  }

  assertComplaintNarrativeImprovementPreflight(runtimeInput);

  const systemPrompt = buildComplaintNarrativeImprovementSystemPrompt();
  const userPrompt = buildComplaintNarrativeImprovementUserPrompt(runtimeInput);
  const startedAt = dependencies.now();
  const proxyResponse = await dependencies.requestProxyCompletion({
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    maxOutputTokens: 2_800,
    requestMetadata: {
      featureKey: NARRATIVE_FEATURE_KEY,
      documentId: document.id,
      documentType: document.documentType,
      intent: "complaint_narrative_improvement",
      response_mode: "document_ready",
      prompt_version: COMPLAINT_NARRATIVE_IMPROVEMENT_PROMPT_VERSION,
      server_id: runtimeInput.server_id,
      representative_mode: runtimeInput.representative_mode,
      victim_or_trustor_mode: runtimeInput.victim_or_trustor_mode,
      length_mode: runtimeInput.length_mode,
      has_legal_context: Boolean(
        runtimeInput.selected_legal_context &&
          (runtimeInput.selected_legal_context.laws.length > 0 ||
            runtimeInput.selected_legal_context.precedents.length > 0),
      ),
      evidence_count: runtimeInput.evidence_list.length,
      raw_input: runtimeInput.raw_situation_description,
    },
  });
  const finishedAt = dependencies.now();
  const latencyMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  const usageMetrics = extractProxyUsageMetrics(
    "responsePayloadJson" in proxyResponse ? proxyResponse.responsePayloadJson ?? null : null,
  );
  const requestPayloadBase = {
    documentId: document.id,
    documentType: document.documentType,
    updatedAt: document.updatedAt.toISOString(),
    intent: "complaint_narrative_improvement",
    response_mode: "document_ready",
    prompt_version: COMPLAINT_NARRATIVE_IMPROVEMENT_PROMPT_VERSION,
    length_mode: runtimeInput.length_mode,
    raw_input: runtimeInput.raw_situation_description,
    server_id: runtimeInput.server_id,
    evidence_count: runtimeInput.evidence_list.length,
    has_legal_context: Boolean(
      runtimeInput.selected_legal_context &&
        (runtimeInput.selected_legal_context.laws.length > 0 ||
          runtimeInput.selected_legal_context.precedents.length > 0),
    ),
    runtime_input: runtimeInput,
  };

  if (proxyResponse.status !== "success") {
    await dependencies.createAIRequest({
      accountId: input.accountId,
      serverId: document.serverId,
      featureKey: NARRATIVE_FEATURE_KEY,
      providerKey: "providerKey" in proxyResponse ? proxyResponse.providerKey ?? null : null,
      proxyKey: "proxyKey" in proxyResponse ? proxyResponse.proxyKey ?? null : null,
      model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
      requestPayloadJson: requestPayloadBase,
      responsePayloadJson: {
        statusBranch: "unavailable",
        latencyMs,
        attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
        prompt_tokens: usageMetrics.prompt_tokens,
        completion_tokens: usageMetrics.completion_tokens,
        total_tokens: usageMetrics.total_tokens,
        cost_usd: usageMetrics.cost_usd,
        output_trace: null,
      },
      status: proxyResponse.status,
      errorMessage: proxyResponse.message,
    });

    throw new ComplaintNarrativeImprovementUnavailableError(
      "AI improvement сейчас недоступен. Попробуйте ещё раз позже.",
    );
  }

  const finishReason = extractFinishReason(proxyResponse.responsePayloadJson ?? null);

  let parsedResult: ComplaintNarrativeImprovementResult;

  try {
    parsedResult = parseComplaintNarrativeImprovementResult({
      runtimeInput,
      rawResult: parseProxyStructuredJson(proxyResponse.content),
    });
  } catch (error) {
    await dependencies.createAIRequest({
      accountId: input.accountId,
      serverId: document.serverId,
      featureKey: NARRATIVE_FEATURE_KEY,
      providerKey: proxyResponse.providerKey ?? null,
      proxyKey: proxyResponse.proxyKey ?? null,
      model: proxyResponse.model ?? null,
      requestPayloadJson: requestPayloadBase,
      responsePayloadJson: {
        statusBranch: "invalid_output",
        latencyMs,
        finishReason,
        attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
        output_trace: {
          output_kind: "complaint_narrative_structured_json",
          output_preview: clampText(proxyResponse.content, MAX_IMPROVED_TEXT_PREVIEW_LENGTH),
          output_length: proxyResponse.content.length,
          finish_reason: finishReason,
        },
        prompt_tokens: usageMetrics.prompt_tokens,
        completion_tokens: usageMetrics.completion_tokens,
        total_tokens: usageMetrics.total_tokens,
        cost_usd: usageMetrics.cost_usd,
      },
      status: "failure",
      errorMessage:
        error instanceof Error
          ? error.message
          : "AI вернул невалидный structured output.",
    });

    throw new ComplaintNarrativeImprovementInvalidOutputError(
      "AI вернул невалидный structured output. Попробуйте ещё раз позже.",
    );
  }

  const usageMeta = complaintNarrativeImprovementUsageMetaSchema.parse({
    featureKey: NARRATIVE_FEATURE_KEY,
    providerKey: proxyResponse.providerKey ?? null,
    proxyKey: proxyResponse.proxyKey ?? null,
    model: proxyResponse.model ?? null,
    latencyMs,
    finishReason,
    attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
    improvedTextLength: parsedResult.improved_text.length,
    lengthMode: runtimeInput.length_mode,
  });

  await dependencies.createAIRequest({
    accountId: input.accountId,
    serverId: document.serverId,
    featureKey: NARRATIVE_FEATURE_KEY,
    providerKey: usageMeta.providerKey,
    proxyKey: usageMeta.proxyKey,
    model: usageMeta.model,
    requestPayloadJson: requestPayloadBase,
    responsePayloadJson: {
      statusBranch: "success",
      improved_text_preview: parsedResult.improved_text.slice(0, MAX_IMPROVED_TEXT_PREVIEW_LENGTH),
      improved_text_length: parsedResult.improved_text.length,
      legal_basis_used: parsedResult.legal_basis_used,
      used_facts_count: parsedResult.used_facts.length,
      missing_facts_count: parsedResult.missing_facts.length,
      review_notes: parsedResult.review_notes,
      risk_flags: parsedResult.risk_flags,
      should_send_to_review: parsedResult.should_send_to_review,
      latencyMs: usageMeta.latencyMs,
      finishReason: usageMeta.finishReason,
      attemptedProxyKeys: usageMeta.attemptedProxyKeys,
      prompt_tokens: usageMetrics.prompt_tokens,
      completion_tokens: usageMetrics.completion_tokens,
      total_tokens: usageMetrics.total_tokens,
      cost_usd: usageMetrics.cost_usd,
      output_trace: {
        output_kind: "complaint_narrative_structured_json",
        output_preview: parsedResult.improved_text.slice(0, MAX_IMPROVED_TEXT_PREVIEW_LENGTH),
        output_length: parsedResult.improved_text.length,
        finish_reason: usageMeta.finishReason,
      },
    },
    status: "success",
    errorMessage: null,
  });

  return {
    sourceText: runtimeInput.raw_situation_description,
    runtimeInput,
    result: parsedResult,
    basedOnUpdatedAt: document.updatedAt.toISOString(),
    usageMeta,
  };
}

export const __complaintNarrativeImprovementInternals = {
  AMBIGUOUS_DATE_TIME_REVIEW_NOTE,
  MISSING_EVIDENCE_REVIEW_NOTE,
  deriveApplicantRole,
  buildComplaintNarrativeImprovementInputFromDraft,
  buildComplaintNarrativeImprovementRuntimeInput,
  validateComplaintNarrativeImprovementPreflight,
  buildComplaintNarrativeImprovementSystemPrompt,
  buildComplaintNarrativeImprovementUserPrompt,
  parseComplaintNarrativeImprovementResult,
  parseProxyStructuredJson,
  extractFinishReason,
  rawTextMentionsEvidenceWithoutList,
};
