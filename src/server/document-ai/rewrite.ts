import { getDocumentByIdForAccount } from "@/db/repositories/document.repository";
import { createAIRequest } from "@/db/repositories/ai-request.repository";
import {
  applyClaimsRewriteSuggestion,
  applyOgpRewriteSuggestion,
  getClaimsRewriteSectionText,
  getDocumentRewriteSectionLabel,
  getOgpRewriteSectionText,
  isClaimsRewriteSectionKey,
  isOgpRewriteSectionKey,
  isRewriteSectionSupportedForDocumentType,
} from "@/document-ai/sections";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import { searchAssistantCorpus } from "@/server/legal-assistant/retrieval";
import {
  DocumentAccessDeniedError,
  readClaimsDraftPayload,
  readDocumentAuthorSnapshot,
  readOgpComplaintDraftPayload,
} from "@/server/document-area/persistence";
import {
  documentFieldRewriteUsageMetaSchema,
  type ClaimsDocumentRewriteSectionKey,
  type DocumentFieldRewriteUsageMeta,
  type DocumentRewriteSectionKey,
  type OgpDocumentRewriteSectionKey,
} from "@/schemas/document-ai";
import {
  buildDocumentRewriteSelfAssessment,
  deriveActorContextFromFilingMode,
} from "@/server/legal-core/metadata";
import {
  buildDocumentRewriteFactLedger,
  type DocumentRewriteFactLedger,
} from "@/server/legal-core/document-rewrite";
import {
  buildDocumentGuardrailContextText,
  buildDocumentGuardrailSearchQuery,
  buildDocumentGuardrailUsedSources,
  buildDocumentRewritePolicyLines,
} from "@/server/legal-core/document-guardrails";
import {
  DOCUMENT_FIELD_REWRITE_PROMPT_VERSION,
  extractProxyUsageMetrics,
} from "@/server/legal-core/observability";
import { buildDocumentRewriteFutureReviewMarker } from "@/server/legal-core/review-routing";

const DOCUMENT_FIELD_REWRITE_FEATURE_KEY = "document_field_rewrite";
const MAX_TARGET_TEXT_LENGTH = 6_000;
const MAX_CONTEXT_TEXT_LENGTH = 2_500;
const MAX_GUARDRAIL_QUERY_LENGTH = 1_400;
const MAX_GUARDRAIL_LAW_BLOCKS = 3;
const MAX_GUARDRAIL_PRECEDENT_BLOCKS = 2;
const MAX_GUARDRAIL_BLOCK_TEXT_LENGTH = 700;
const MAX_SUGGESTION_PREVIEW_LENGTH = 160;

type DocumentFieldRewriteDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  searchAssistantCorpus: typeof searchAssistantCorpus;
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: DocumentFieldRewriteDependencies = {
  getDocumentByIdForAccount,
  searchAssistantCorpus,
  requestProxyCompletion: requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

type DocumentFieldRewriteBlockedReason = "unsupported_section" | "source_text_empty";

type CompactTrustorSummary =
  | {
      present: false;
    }
  | {
      present: true;
      fullName: string;
      passportProvided: boolean;
      noteProvided: boolean;
    };

type CompactEvidenceSummary = {
  groupCount: number;
  rowCount: number;
  titles: string[];
};

type RewritePromptContext = {
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
  sectionKey: DocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  filingMode: "self" | "representative";
  hasTrustor: boolean;
  trustorSummary: CompactTrustorSummary;
  evidenceSummary: CompactEvidenceSummary;
  contextFieldKeys: string[];
  contextText: string;
};

export class DocumentFieldRewriteBlockedError extends Error {
  constructor(
    public readonly reasons: DocumentFieldRewriteBlockedReason[],
  ) {
    super("Document field rewrite blocked.");
    this.name = "DocumentFieldRewriteBlockedError";
  }
}

export class DocumentFieldRewriteUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentFieldRewriteUnavailableError";
  }
}

function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function buildCompactTrustorSummary(input: {
  filingMode: "self" | "representative";
  trustorSnapshot:
    | {
        fullName: string;
        passportNumber: string;
        note: string;
      }
    | null
    | undefined;
}): CompactTrustorSummary {
  if (input.filingMode !== "representative" || !input.trustorSnapshot) {
    return {
      present: false,
    };
  }

  return {
    present: true,
    fullName: input.trustorSnapshot.fullName.trim(),
    passportProvided: input.trustorSnapshot.passportNumber.trim().length > 0,
    noteProvided: input.trustorSnapshot.note.trim().length > 0,
  };
}

function buildCompactEvidenceSummary(input:
  | { evidenceGroups: Array<{ title: string; rows: unknown[] }>; evidenceItems?: never }
  | { evidenceGroups?: never; evidenceItems: Array<{ labelSnapshot: string }> }) {
  if (input.evidenceItems) {
    return {
      groupCount: 0,
      rowCount: input.evidenceItems.length,
      titles: input.evidenceItems
        .map((item) => item.labelSnapshot.trim())
        .filter((title) => title.length > 0)
        .slice(0, 5),
    } satisfies CompactEvidenceSummary;
  }

  return {
    groupCount: input.evidenceGroups.length,
    rowCount: input.evidenceGroups.reduce((total, group) => total + group.rows.length, 0),
    titles: input.evidenceGroups
      .map((group) => group.title.trim())
      .filter((title) => title.length > 0)
      .slice(0, 5),
  } satisfies CompactEvidenceSummary;
}

function formatTrustorSummary(summary: CompactTrustorSummary) {
  if (!summary.present) {
    return "none";
  }

  return [
    `fullName=${summary.fullName || "not_provided"}`,
    `passportProvided=${summary.passportProvided ? "yes" : "no"}`,
    `noteProvided=${summary.noteProvided ? "yes" : "no"}`,
  ].join(", ");
}

function formatEvidenceSummary(summary: CompactEvidenceSummary) {
  return [
    `groupCount=${summary.groupCount}`,
    `rowCount=${summary.rowCount}`,
    summary.titles.length > 0 ? `titles=${summary.titles.join(" | ")}` : "titles=none",
  ].join(", ");
}

function buildContextText(input: {
  fields: Array<[string, string | null | undefined]>;
  filingMode: "self" | "representative";
  trustorSummary: CompactTrustorSummary;
  evidenceSummary: CompactEvidenceSummary;
}) {
  const lines = input.fields
    .filter(([, value]) => (value ?? "").trim().length > 0)
    .map(([key, value]) => `${key}: ${String(value).trim()}`);

  lines.push(`filingMode: ${input.filingMode}`);
  lines.push(`trustorSummary: ${formatTrustorSummary(input.trustorSummary)}`);
  lines.push(`evidenceSummary: ${formatEvidenceSummary(input.evidenceSummary)}`);

  return clampText(lines.join("\n"), MAX_CONTEXT_TEXT_LENGTH);
}

function buildSearchQuery(input: {
  sectionLabel: string;
  sourceText: string;
  contextText: string;
}) {
  return buildDocumentGuardrailSearchQuery({
    ...input,
    maxLength: MAX_GUARDRAIL_QUERY_LENGTH,
  });
}

type RewriteGuardrailRetrievalResult = Awaited<ReturnType<typeof searchAssistantCorpus>>;

function buildRewriteGuardrailUsedSources(
  retrieval: RewriteGuardrailRetrievalResult,
) {
  return buildDocumentGuardrailUsedSources(retrieval, {
    lawLimit: MAX_GUARDRAIL_LAW_BLOCKS,
    precedentLimit: MAX_GUARDRAIL_PRECEDENT_BLOCKS,
  });
}

function buildRewriteGuardrailContext(retrieval: RewriteGuardrailRetrievalResult) {
  return buildDocumentGuardrailContextText(retrieval, {
    lawLimit: MAX_GUARDRAIL_LAW_BLOCKS,
    precedentLimit: MAX_GUARDRAIL_PRECEDENT_BLOCKS,
    maxBlockTextLength: MAX_GUARDRAIL_BLOCK_TEXT_LENGTH,
  });
}

function buildOgpRewriteContext(input: {
  payload: ReturnType<typeof readOgpComplaintDraftPayload>;
  sectionKey: OgpDocumentRewriteSectionKey;
}) {
  const sourceText = getOgpRewriteSectionText(input.payload, input.sectionKey);
  const trustorSummary = buildCompactTrustorSummary({
    filingMode: input.payload.filingMode,
    trustorSnapshot: input.payload.trustorSnapshot,
  });
  const evidenceSummary = buildCompactEvidenceSummary({ evidenceItems: input.payload.evidenceItems });
  const sectionLabel = getDocumentRewriteSectionLabel(input.sectionKey);

  if (input.sectionKey === "situation_description") {
    const contextFieldKeys = [
      "objectOrganization",
      "objectFullName",
      "incidentAt",
      "appealNumber",
      "violationSummary",
    ];

    return {
      documentType: "ogp_complaint" as const,
      sectionKey: input.sectionKey,
      sectionLabel,
      sourceText,
      filingMode: input.payload.filingMode,
      hasTrustor: trustorSummary.present,
      trustorSummary,
      evidenceSummary,
      contextFieldKeys,
      contextText: buildContextText({
        fields: [
          ["objectOrganization", input.payload.objectOrganization],
          ["objectFullName", input.payload.objectFullName],
          ["incidentAt", input.payload.incidentAt],
          ["appealNumber", input.payload.appealNumber],
          ["violationSummary", input.payload.violationSummary],
        ],
        filingMode: input.payload.filingMode,
        trustorSummary,
        evidenceSummary,
      }),
    } satisfies RewritePromptContext;
  }

  const contextFieldKeys = [
    "objectOrganization",
    "objectFullName",
    "incidentAt",
    "appealNumber",
    "situationDescription",
  ];

  return {
    documentType: "ogp_complaint" as const,
    sectionKey: input.sectionKey,
    sectionLabel,
    sourceText,
    filingMode: input.payload.filingMode,
    hasTrustor: trustorSummary.present,
    trustorSummary,
    evidenceSummary,
    contextFieldKeys,
    contextText: buildContextText({
      fields: [
        ["objectOrganization", input.payload.objectOrganization],
        ["objectFullName", input.payload.objectFullName],
        ["incidentAt", input.payload.incidentAt],
        ["appealNumber", input.payload.appealNumber],
        ["situationDescription", input.payload.situationDescription],
      ],
      filingMode: input.payload.filingMode,
      trustorSummary,
      evidenceSummary,
    }),
  } satisfies RewritePromptContext;
}

function buildClaimsRewriteContext(input: {
  documentType: "rehabilitation" | "lawsuit";
  payload: ReturnType<typeof readClaimsDraftPayload>;
  sectionKey: ClaimsDocumentRewriteSectionKey;
}) {
  const sourceText = getClaimsRewriteSectionText(input.payload, input.sectionKey);
  const trustorSummary = buildCompactTrustorSummary({
    filingMode: input.payload.filingMode,
    trustorSnapshot: input.payload.trustorSnapshot,
  });
  const evidenceSummary = buildCompactEvidenceSummary({ evidenceGroups: input.payload.evidenceGroups });
  const commonFields: Array<[string, string | null | undefined]> = [
    ["respondentName", input.payload.respondentName],
    ["claimSubject", input.payload.claimSubject],
    ["factualBackground", input.payload.factualBackground],
    ["legalBasisSummary", input.payload.legalBasisSummary],
    ["requestedRelief", input.payload.requestedRelief],
  ];
  const sectionLabel = getDocumentRewriteSectionLabel(input.sectionKey);

  if (input.sectionKey === "rehabilitation_basis" || input.sectionKey === "harm_summary") {
    const contextFieldKeys = [
      "respondentName",
      "claimSubject",
      "factualBackground",
      "requestedRelief",
      "caseReference",
    ];

    return {
      documentType: input.documentType,
      sectionKey: input.sectionKey,
      sectionLabel,
      sourceText,
      filingMode: input.payload.filingMode,
      hasTrustor: trustorSummary.present,
      trustorSummary,
      evidenceSummary,
      contextFieldKeys,
      contextText: buildContextText({
        fields: [
          ...commonFields.filter(([key]) =>
            ["respondentName", "claimSubject", "factualBackground", "requestedRelief"].includes(key),
          ),
          ["caseReference", "caseReference" in input.payload ? input.payload.caseReference : ""],
        ],
        filingMode: input.payload.filingMode,
        trustorSummary,
        evidenceSummary,
      }),
    } satisfies RewritePromptContext;
  }

  if (input.sectionKey === "pretrial_summary") {
    const contextFieldKeys = [
      "respondentName",
      "claimSubject",
      "factualBackground",
      "requestedRelief",
      "courtName",
      "defendantName",
      "claimAmount",
    ];

    return {
      documentType: input.documentType,
      sectionKey: input.sectionKey,
      sectionLabel,
      sourceText,
      filingMode: input.payload.filingMode,
      hasTrustor: trustorSummary.present,
      trustorSummary,
      evidenceSummary,
      contextFieldKeys,
      contextText: buildContextText({
        fields: [
          ...commonFields.filter(([key]) =>
            ["respondentName", "claimSubject", "factualBackground", "requestedRelief"].includes(key),
          ),
          ["courtName", "courtName" in input.payload ? input.payload.courtName : ""],
          ["defendantName", "defendantName" in input.payload ? input.payload.defendantName : ""],
          ["claimAmount", "claimAmount" in input.payload ? input.payload.claimAmount : ""],
        ],
        filingMode: input.payload.filingMode,
        trustorSummary,
        evidenceSummary,
      }),
    } satisfies RewritePromptContext;
  }

  if (input.sectionKey === "legal_basis_summary") {
    const contextFieldKeys = [
      "respondentName",
      "claimSubject",
      "factualBackground",
      "requestedRelief",
    ];

    return {
      documentType: input.documentType,
      sectionKey: input.sectionKey,
      sectionLabel,
      sourceText,
      filingMode: input.payload.filingMode,
      hasTrustor: trustorSummary.present,
      trustorSummary,
      evidenceSummary,
      contextFieldKeys,
      contextText: buildContextText({
        fields: commonFields.filter(([key]) =>
          ["respondentName", "claimSubject", "factualBackground", "requestedRelief"].includes(key),
        ),
        filingMode: input.payload.filingMode,
        trustorSummary,
        evidenceSummary,
      }),
    } satisfies RewritePromptContext;
  }

  if (input.sectionKey === "requested_relief") {
    const contextFieldKeys = [
      "respondentName",
      "claimSubject",
      "factualBackground",
      "legalBasisSummary",
    ];

    return {
      documentType: input.documentType,
      sectionKey: input.sectionKey,
      sectionLabel,
      sourceText,
      filingMode: input.payload.filingMode,
      hasTrustor: trustorSummary.present,
      trustorSummary,
      evidenceSummary,
      contextFieldKeys,
      contextText: buildContextText({
        fields: commonFields.filter(([key]) =>
          ["respondentName", "claimSubject", "factualBackground", "legalBasisSummary"].includes(key),
        ),
        filingMode: input.payload.filingMode,
        trustorSummary,
        evidenceSummary,
      }),
    } satisfies RewritePromptContext;
  }

  const contextFieldKeys = [
    "respondentName",
    "claimSubject",
    "legalBasisSummary",
    "requestedRelief",
  ];

  return {
    documentType: input.documentType,
    sectionKey: input.sectionKey,
    sectionLabel,
    sourceText,
    filingMode: input.payload.filingMode,
    hasTrustor: trustorSummary.present,
    trustorSummary,
    evidenceSummary,
    contextFieldKeys,
    contextText: buildContextText({
      fields: commonFields.filter(([key]) =>
        ["respondentName", "claimSubject", "legalBasisSummary", "requestedRelief"].includes(key),
      ),
      filingMode: input.payload.filingMode,
      trustorSummary,
      evidenceSummary,
    }),
  } satisfies RewritePromptContext;
}

function buildRewritePromptContext(input: {
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
  payload: unknown;
  sectionKey: DocumentRewriteSectionKey;
}) {
  if (!isRewriteSectionSupportedForDocumentType(input.documentType, input.sectionKey)) {
    throw new DocumentFieldRewriteBlockedError(["unsupported_section"]);
  }

  if (input.documentType === "ogp_complaint") {
    const payload = readOgpComplaintDraftPayload(input.payload);

    if (!isOgpRewriteSectionKey(input.sectionKey)) {
      throw new DocumentFieldRewriteBlockedError(["unsupported_section"]);
    }

    return buildOgpRewriteContext({
      payload,
      sectionKey: input.sectionKey,
    });
  }

  const payload = readClaimsDraftPayload(input.documentType, input.payload);

  if (!isClaimsRewriteSectionKey(input.sectionKey)) {
    throw new DocumentFieldRewriteBlockedError(["unsupported_section"]);
  }

  return buildClaimsRewriteContext({
    documentType: input.documentType,
    payload,
    sectionKey: input.sectionKey,
  });
}

function buildRewriteSystemPrompt() {
  return [
    ...buildDocumentRewritePolicyLines({
      includeGuardrailsAsBoundary: true,
    }),
    "Не превращай ответ в список советов или комментариев для пользователя.",
    "Не используй markdown, заголовки, кавычки вокруг всего ответа и служебные пояснения.",
    "Верни только улучшенную версию секции как plain text.",
  ].join("\n");
}

function buildRewriteUserPrompt(input: {
  serverName: string;
  documentTitle: string;
  authorFullName: string;
  context: RewritePromptContext;
  factLedger: DocumentRewriteFactLedger;
  guardrailContext: {
    combinedCorpusSnapshotHash: string;
    lawContext: string;
    precedentContext: string;
  };
}) {
  return [
    `Сервер: ${input.serverName}`,
    `Документ: ${input.documentTitle}`,
    `Автор snapshot: ${input.authorFullName}`,
    `Тип документа: ${input.context.documentType}`,
    `Секция: ${input.context.sectionLabel} (${input.context.sectionKey})`,
    `Режим подачи: ${input.context.filingMode}`,
    `Trustor present: ${input.context.hasTrustor ? "yes" : "no"}`,
    "",
    "Исходный текст секции:",
    clampText(input.context.sourceText, MAX_TARGET_TEXT_LENGTH) || "(пусто)",
    "",
    "Контекст секции:",
    input.context.contextText || "Дополнительный контекст не передан.",
    "",
    "Fact ledger:",
    JSON.stringify(input.factLedger, null, 2),
    "",
    "Legal guardrails:",
    `Combined corpus snapshot hash: ${input.guardrailContext.combinedCorpusSnapshotHash}`,
    input.guardrailContext.lawContext || "Подходящие legal guardrails по нормам закона не найдены.",
    input.guardrailContext.precedentContext ||
      "Подходящие legal guardrails по подтверждённым прецедентам не найдены.",
    "",
    "Перепиши только исходный текст секции.",
    "Не добавляй новые обстоятельства и не меняй смысл.",
  ].join("\n");
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

export function mapDocumentFieldRewriteBlockingReasonsToMessages(
  reasons: DocumentFieldRewriteBlockedReason[],
) {
  return reasons.map((reason) => {
    if (reason === "unsupported_section") {
      return "Для этой секции AI rewrite в v1 не поддерживается.";
    }

    return "В этой секции пока нет текста для улучшения.";
  });
}

export async function rewriteOwnedDocumentField(
  input: {
    accountId: string;
    documentId: string;
    sectionKey: DocumentRewriteSectionKey;
  },
  dependencies: DocumentFieldRewriteDependencies = defaultDependencies,
): Promise<{
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  usageMeta: DocumentFieldRewriteUsageMeta;
}> {
  const document = await dependencies.getDocumentByIdForAccount({
    accountId: input.accountId,
    documentId: input.documentId,
  });

  if (!document) {
    throw new DocumentAccessDeniedError();
  }

  if (
    document.documentType === "attorney_request" ||
    document.documentType === "legal_services_agreement"
  ) {
    throw new DocumentAccessDeniedError();
  }

  const authorSnapshot = readDocumentAuthorSnapshot(document.authorSnapshotJson);
  const promptContext = buildRewritePromptContext({
    documentType: document.documentType,
    payload: document.formPayloadJson,
    sectionKey: input.sectionKey,
  });
  const factLedger = buildDocumentRewriteFactLedger({
    documentType: document.documentType,
    payload: document.formPayloadJson,
    sectionKey: input.sectionKey,
    sourceText: promptContext.sourceText,
  });
  const sourceText = clampText(promptContext.sourceText, MAX_TARGET_TEXT_LENGTH);

  if (sourceText.length === 0) {
    throw new DocumentFieldRewriteBlockedError(["source_text_empty"]);
  }

  const startedAt = dependencies.now();
  const actorContext = deriveActorContextFromFilingMode(promptContext.filingMode);
  const selfAssessment = buildDocumentRewriteSelfAssessment({
    missingDataCount: factLedger.missing_data.length,
    sourceLength: sourceText.length,
  });
  const guardrailRetrieval = await dependencies.searchAssistantCorpus({
    serverId: document.serverId,
    query: buildSearchQuery({
      sectionLabel: promptContext.sectionLabel,
      sourceText: promptContext.sourceText,
      contextText: promptContext.contextText,
    }),
    lawLimit: MAX_GUARDRAIL_LAW_BLOCKS,
    precedentLimit: MAX_GUARDRAIL_PRECEDENT_BLOCKS,
  });
  const guardrailUsedSources = buildRewriteGuardrailUsedSources(guardrailRetrieval);
  const guardrailContext = buildRewriteGuardrailContext(guardrailRetrieval);
  const successFutureReviewMarker = buildDocumentRewriteFutureReviewMarker({
    selfAssessment,
    status: "success",
    missingDataCount: factLedger.missing_data.length,
    usedSourceCount: guardrailUsedSources.length,
  });
  const unavailableFutureReviewMarker = buildDocumentRewriteFutureReviewMarker({
    selfAssessment,
    status: "unavailable",
    missingDataCount: factLedger.missing_data.length,
    usedSourceCount: guardrailUsedSources.length,
  });
  const proxyResponse = await dependencies.requestProxyCompletion({
    systemPrompt: buildRewriteSystemPrompt(),
    userPrompt: buildRewriteUserPrompt({
      serverName: document.server.name,
      documentTitle: document.title,
      authorFullName: authorSnapshot.fullName,
      context: promptContext,
      factLedger,
      guardrailContext,
    }),
    requestMetadata: {
      featureKey: DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
      documentId: document.id,
      documentType: document.documentType,
      sectionKey: input.sectionKey,
      intent: "document_text_improvement",
      actor_context: actorContext,
      response_mode: "document_ready",
      prompt_version: DOCUMENT_FIELD_REWRITE_PROMPT_VERSION,
      law_version_ids: guardrailRetrieval.combinedRetrievalRevision.lawCurrentVersionIds,
      lawResultsCount: guardrailRetrieval.lawRetrieval.resultCount,
      precedentResultsCount: guardrailRetrieval.precedentRetrieval.resultCount,
    },
  });
  const finishedAt = dependencies.now();
  const latencyMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  const usageMetrics = extractProxyUsageMetrics(
    "responsePayloadJson" in proxyResponse ? proxyResponse.responsePayloadJson ?? null : null,
  );

  if (proxyResponse.status !== "success") {
    await dependencies.createAIRequest({
      accountId: input.accountId,
      serverId: document.serverId,
      featureKey: DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
      providerKey: "providerKey" in proxyResponse ? proxyResponse.providerKey ?? null : null,
      proxyKey: "proxyKey" in proxyResponse ? proxyResponse.proxyKey ?? null : null,
      model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
      requestPayloadJson: {
        documentId: document.id,
        documentType: document.documentType,
        sectionKey: input.sectionKey,
        updatedAt: document.updatedAt.toISOString(),
        filingMode: promptContext.filingMode,
        actor_context: actorContext,
        intent: "document_text_improvement",
        response_mode: "document_ready",
        prompt_version: DOCUMENT_FIELD_REWRITE_PROMPT_VERSION,
        hasTrustor: promptContext.hasTrustor,
        evidenceGroupCount: promptContext.evidenceSummary.groupCount,
        sourceLength: sourceText.length,
        contextFieldKeys: promptContext.contextFieldKeys,
        contextLength: promptContext.contextText.length,
        combinedRetrievalRevision: guardrailRetrieval.combinedRetrievalRevision,
        law_version_ids: guardrailRetrieval.combinedRetrievalRevision.lawCurrentVersionIds,
        used_sources: guardrailUsedSources,
        fact_ledger: factLedger,
      },
      responsePayloadJson: {
        latencyMs,
        attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
        prompt_tokens: usageMetrics.prompt_tokens,
        completion_tokens: usageMetrics.completion_tokens,
        total_tokens: usageMetrics.total_tokens,
        cost_usd: usageMetrics.cost_usd,
        confidence: selfAssessment.answer_confidence,
        ...unavailableFutureReviewMarker,
        self_assessment: selfAssessment,
      },
      status: proxyResponse.status,
      errorMessage: proxyResponse.message,
    });

    throw new DocumentFieldRewriteUnavailableError(
      "AI rewrite сейчас недоступен. Попробуйте ещё раз позже.",
    );
  }

  const suggestionText = proxyResponse.content.trim();
  const finishReason = extractFinishReason(proxyResponse.responsePayloadJson ?? null);
  const usageMeta = documentFieldRewriteUsageMetaSchema.parse({
    featureKey: DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
    providerKey: proxyResponse.providerKey ?? null,
    proxyKey: proxyResponse.proxyKey ?? null,
    model: proxyResponse.model ?? null,
    latencyMs,
    suggestionLength: suggestionText.length,
    finishReason,
    attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
  });

  await dependencies.createAIRequest({
    accountId: input.accountId,
    serverId: document.serverId,
    featureKey: DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
    providerKey: usageMeta.providerKey,
    proxyKey: usageMeta.proxyKey,
    model: usageMeta.model,
    requestPayloadJson: {
      documentId: document.id,
      documentType: document.documentType,
      sectionKey: input.sectionKey,
      updatedAt: document.updatedAt.toISOString(),
      filingMode: promptContext.filingMode,
      actor_context: actorContext,
      intent: "document_text_improvement",
      response_mode: "document_ready",
      prompt_version: DOCUMENT_FIELD_REWRITE_PROMPT_VERSION,
      hasTrustor: promptContext.hasTrustor,
      evidenceGroupCount: promptContext.evidenceSummary.groupCount,
      sourceLength: sourceText.length,
      contextFieldKeys: promptContext.contextFieldKeys,
      contextLength: promptContext.contextText.length,
      combinedRetrievalRevision: guardrailRetrieval.combinedRetrievalRevision,
      law_version_ids: guardrailRetrieval.combinedRetrievalRevision.lawCurrentVersionIds,
      used_sources: guardrailUsedSources,
      fact_ledger: factLedger,
    },
    responsePayloadJson: {
      suggestionLength: usageMeta.suggestionLength,
      latencyMs: usageMeta.latencyMs,
      finishReason: usageMeta.finishReason,
      attemptedProxyKeys: usageMeta.attemptedProxyKeys,
      suggestionPreview: suggestionText.slice(0, MAX_SUGGESTION_PREVIEW_LENGTH),
      prompt_tokens: usageMetrics.prompt_tokens,
      completion_tokens: usageMetrics.completion_tokens,
      total_tokens: usageMetrics.total_tokens,
      cost_usd: usageMetrics.cost_usd,
      confidence: selfAssessment.answer_confidence,
      ...successFutureReviewMarker,
      self_assessment: selfAssessment,
    },
    status: "success",
    errorMessage: null,
  });

  return {
    sourceText,
    suggestionText,
    basedOnUpdatedAt: document.updatedAt.toISOString(),
    usageMeta,
  };
}

export const __documentFieldRewriteInternals = {
  buildCompactTrustorSummary,
  buildCompactEvidenceSummary,
  buildRewritePromptContext,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt,
  extractFinishReason,
  applyClaimsRewriteSuggestion,
  applyOgpRewriteSuggestion,
};
