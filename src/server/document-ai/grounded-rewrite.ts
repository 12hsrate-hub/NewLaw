import { getDocumentByIdForAccount } from "@/db/repositories/document.repository";
import { createAIRequest } from "@/db/repositories/ai-request.repository";
import {
  getClaimsRewriteSectionText,
  getDocumentRewriteSectionLabel,
  getOgpRewriteSectionText,
  isGroundedClaimsRewriteSectionKey,
  isGroundedOgpRewriteSectionKey,
  isGroundedRewriteSectionSupportedForDocumentType,
} from "@/document-ai/sections";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import { searchAssistantCorpus } from "@/server/legal-assistant/retrieval";
import {
  DocumentAccessDeniedError,
  readClaimsDraftPayload,
  readOgpComplaintDraftPayload,
} from "@/server/document-area/persistence";
import {
  groundedDocumentFieldRewriteUsageMetaSchema,
  type GroundedDocumentFieldRewriteUsageMeta,
  type GroundedDocumentReference,
  type GroundedDocumentRewriteMode,
  type GroundedDocumentRewriteSectionKey,
} from "@/schemas/document-ai";

const GROUNDED_DOCUMENT_FIELD_REWRITE_FEATURE_KEY = "document_field_rewrite_grounded";
const MAX_TARGET_TEXT_LENGTH = 6_000;
const MAX_CONTEXT_TEXT_LENGTH = 2_400;
const MAX_SEARCH_QUERY_LENGTH = 1_400;
const MAX_PROMPT_BLOCK_TEXT_LENGTH = 900;
const MAX_SUGGESTION_PREVIEW_LENGTH = 160;
const MAX_LAW_PROMPT_BLOCKS = 4;
const MAX_PRECEDENT_PROMPT_BLOCKS = 3;

type AssistantRetrievalResult = Awaited<ReturnType<typeof searchAssistantCorpus>>;

type GroundedDocumentFieldRewriteDependencies = {
  getDocumentByIdForAccount: typeof getDocumentByIdForAccount;
  searchAssistantCorpus: typeof searchAssistantCorpus;
  requestProxyCompletion: typeof requestAssistantProxyCompletion;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: GroundedDocumentFieldRewriteDependencies = {
  getDocumentByIdForAccount,
  searchAssistantCorpus,
  requestProxyCompletion: requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

type GroundedDocumentFieldRewriteBlockedReason = "unsupported_section" | "source_text_empty";

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

type GroundedRewritePromptContext = {
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
  sectionKey: GroundedDocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  contextFieldKeys: string[];
  contextText: string;
  searchQuery: string;
};

export class GroundedDocumentFieldRewriteBlockedError extends Error {
  constructor(
    public readonly reasons: GroundedDocumentFieldRewriteBlockedReason[],
  ) {
    super("Grounded document field rewrite blocked.");
    this.name = "GroundedDocumentFieldRewriteBlockedError";
  }
}

export class GroundedDocumentFieldRewriteUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundedDocumentFieldRewriteUnavailableError";
  }
}

export class GroundedDocumentFieldRewriteInsufficientCorpusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundedDocumentFieldRewriteInsufficientCorpusError";
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
    return { present: false };
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
        .slice(0, 4),
    } satisfies CompactEvidenceSummary;
  }

  return {
    groupCount: input.evidenceGroups.length,
    rowCount: input.evidenceGroups.reduce((total, group) => total + group.rows.length, 0),
    titles: input.evidenceGroups
      .map((group) => group.title.trim())
      .filter((title) => title.length > 0)
      .slice(0, 4),
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
  return clampText(
    [input.sectionLabel, input.sourceText, input.contextText].filter(Boolean).join("\n"),
    MAX_SEARCH_QUERY_LENGTH,
  );
}

function buildOgpGroundedContext(input: {
  payload: ReturnType<typeof readOgpComplaintDraftPayload>;
  sectionKey: GroundedDocumentRewriteSectionKey;
}) {
  if (!isGroundedOgpRewriteSectionKey(input.sectionKey)) {
    throw new GroundedDocumentFieldRewriteBlockedError(["unsupported_section"]);
  }

  const sourceText = getOgpRewriteSectionText(input.payload, input.sectionKey);
  const trustorSummary = buildCompactTrustorSummary({
    filingMode: input.payload.filingMode,
    trustorSnapshot: input.payload.trustorSnapshot,
  });
  const evidenceSummary = buildCompactEvidenceSummary({ evidenceItems: input.payload.evidenceItems });
  const contextFieldKeys = [
    "objectOrganization",
    "objectFullName",
    "incidentAt",
    "appealNumber",
    "situationDescription",
  ];
  const contextText = buildContextText({
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
  });
  const sectionLabel = getDocumentRewriteSectionLabel(input.sectionKey);

  return {
    documentType: "ogp_complaint" as const,
    sectionKey: input.sectionKey,
    sectionLabel,
    sourceText,
    contextFieldKeys,
    contextText,
    searchQuery: buildSearchQuery({
      sectionLabel,
      sourceText,
      contextText,
    }),
  } satisfies GroundedRewritePromptContext;
}

function buildClaimsGroundedContext(input: {
  documentType: "rehabilitation" | "lawsuit";
  payload: ReturnType<typeof readClaimsDraftPayload>;
  sectionKey: GroundedDocumentRewriteSectionKey;
}) {
  if (!isGroundedClaimsRewriteSectionKey(input.sectionKey)) {
    throw new GroundedDocumentFieldRewriteBlockedError(["unsupported_section"]);
  }

  const sourceText = getClaimsRewriteSectionText(input.payload, input.sectionKey);
  const trustorSummary = buildCompactTrustorSummary({
    filingMode: input.payload.filingMode,
    trustorSnapshot: input.payload.trustorSnapshot,
  });
  const evidenceSummary = buildCompactEvidenceSummary({ evidenceGroups: input.payload.evidenceGroups });
  const sectionLabel = getDocumentRewriteSectionLabel(input.sectionKey);
  const contextFieldKeys =
    input.sectionKey === "legal_basis_summary"
      ? ["respondentName", "claimSubject", "factualBackground", "requestedRelief"]
      : ["respondentName", "claimSubject", "factualBackground", "legalBasisSummary"];
  const contextText = buildContextText({
    fields:
      input.sectionKey === "legal_basis_summary"
        ? [
            ["respondentName", input.payload.respondentName],
            ["claimSubject", input.payload.claimSubject],
            ["factualBackground", input.payload.factualBackground],
            ["requestedRelief", input.payload.requestedRelief],
          ]
        : [
            ["respondentName", input.payload.respondentName],
            ["claimSubject", input.payload.claimSubject],
            ["factualBackground", input.payload.factualBackground],
            ["legalBasisSummary", input.payload.legalBasisSummary],
          ],
    filingMode: input.payload.filingMode,
    trustorSummary,
    evidenceSummary,
  });

  return {
    documentType: input.documentType,
    sectionKey: input.sectionKey,
    sectionLabel,
    sourceText,
    contextFieldKeys,
    contextText,
    searchQuery: buildSearchQuery({
      sectionLabel,
      sourceText,
      contextText,
    }),
  } satisfies GroundedRewritePromptContext;
}

function buildGroundedPromptContext(input: {
  documentType: "ogp_complaint" | "rehabilitation" | "lawsuit";
  payload: unknown;
  sectionKey: GroundedDocumentRewriteSectionKey;
}) {
  if (!isGroundedRewriteSectionSupportedForDocumentType(input.documentType, input.sectionKey)) {
    throw new GroundedDocumentFieldRewriteBlockedError(["unsupported_section"]);
  }

  if (input.documentType === "ogp_complaint") {
    return buildOgpGroundedContext({
      payload: readOgpComplaintDraftPayload(input.payload),
      sectionKey: input.sectionKey,
    });
  }

  return buildClaimsGroundedContext({
    documentType: input.documentType,
    payload: readClaimsDraftPayload(input.documentType, input.payload),
    sectionKey: input.sectionKey,
  });
}

function buildGroundedMode(retrieval: AssistantRetrievalResult): GroundedDocumentRewriteMode | null {
  if (retrieval.lawRetrieval.resultCount > 0) {
    return "law_grounded";
  }

  if (retrieval.precedentRetrieval.resultCount > 0) {
    return "precedent_grounded";
  }

  return null;
}

function buildCompactReferences(
  retrieval: AssistantRetrievalResult,
  groundingMode: GroundedDocumentRewriteMode,
): GroundedDocumentReference[] {
  if (groundingMode === "law_grounded") {
    return retrieval.lawRetrieval.results.slice(0, MAX_LAW_PROMPT_BLOCKS).map((result) => ({
      sourceKind: "law",
      lawKey: result.lawKey,
      lawTitle: result.lawTitle,
      lawVersionId: result.lawVersionId,
      lawBlockId: result.lawBlockId,
      articleNumberNormalized: result.articleNumberNormalized ?? null,
      sourceTopicUrl: result.sourceTopicUrl,
    }));
  }

  return retrieval.precedentRetrieval.results
    .slice(0, MAX_PRECEDENT_PROMPT_BLOCKS)
    .map((result) => ({
      sourceKind: "precedent",
      precedentKey: result.precedentKey,
      precedentTitle: result.precedentTitle,
      precedentVersionId: result.precedentVersionId,
      precedentBlockId: result.precedentBlockId,
      validityStatus: result.validityStatus,
      sourceTopicUrl: result.sourceTopicUrl,
    }));
}

function buildGroundedSystemPrompt(mode: GroundedDocumentRewriteMode) {
  const sharedLines = [
    "Ты помогаешь переписать одну юридическую секцию документа.",
    "Работай только как grounded writing assistant.",
    "Используй только переданный confirmed corpus выбранного сервера.",
    "Не придумывай новые факты, даты, имена, trustor details, evidence, нормы закона, судебные прецеденты, суммы или требования, которых нет во входных данных и retrieval context.",
    "Не переписывай весь документ и не давай советы пользователю.",
    "Сохрани фактический смысл исходного текста.",
    "Сделай секцию яснее, структурнее и формальнее.",
    "Верни только улучшенную секцию как plain text без markdown и без служебных пояснений.",
  ];

  if (mode === "law_grounded") {
    return [
      ...sharedLines,
      "Опирайся только на переданные current primary laws.",
      "Не подменяй норму закона общими знаниями.",
      "Не добавляй прецеденты, если они не даны в retrieval context этой секции.",
    ].join("\n");
  }

  return [
    ...sharedLines,
    "В этом запросе надёжная опора есть только в confirmed judicial precedents.",
    "Не выдавай precedent как норму закона и не придумывай отсутствующие статьи или нормы.",
    "Если текст нельзя добросовестно улучшить только на основе переданных precedents, лучше сохранить осторожную формулировку, чем выдумывать правовую норму.",
  ].join("\n");
}

function buildLawGroundedContextText(retrieval: AssistantRetrievalResult) {
  return retrieval.lawRetrieval.results
    .slice(0, MAX_LAW_PROMPT_BLOCKS)
    .map((result, index) =>
      [
        `Law source ${index + 1}`,
        `- law_key: ${result.lawKey}`,
        `- title: ${result.lawTitle}`,
        `- article_number_normalized: ${result.articleNumberNormalized ?? "n/a"}`,
        `- law_version_id: ${result.lawVersionId}`,
        `- law_block_id: ${result.lawBlockId}`,
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- text: ${clampText(result.blockText, MAX_PROMPT_BLOCK_TEXT_LENGTH)}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function buildPrecedentGroundedContextText(retrieval: AssistantRetrievalResult) {
  return retrieval.precedentRetrieval.results
    .slice(0, MAX_PRECEDENT_PROMPT_BLOCKS)
    .map((result, index) =>
      [
        `Precedent source ${index + 1}`,
        `- precedent_key: ${result.precedentKey}`,
        `- title: ${result.precedentTitle}`,
        `- validity_status: ${result.validityStatus}`,
        `- precedent_version_id: ${result.precedentVersionId}`,
        `- precedent_block_id: ${result.precedentBlockId}`,
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- text: ${clampText(result.blockText, MAX_PROMPT_BLOCK_TEXT_LENGTH)}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function buildGroundedUserPrompt(input: {
  serverName: string;
  documentTitle: string;
  context: GroundedRewritePromptContext;
  retrieval: AssistantRetrievalResult;
  groundingMode: GroundedDocumentRewriteMode;
}) {
  const groundedSources =
    input.groundingMode === "law_grounded"
      ? buildLawGroundedContextText(input.retrieval)
      : buildPrecedentGroundedContextText(input.retrieval);

  return [
    `Сервер: ${input.serverName}`,
    `Документ: ${input.documentTitle}`,
    `Тип документа: ${input.context.documentType}`,
    `Секция: ${input.context.sectionLabel} (${input.context.sectionKey})`,
    `Grounding mode: ${input.groundingMode}`,
    `Combined corpus snapshot hash: ${input.retrieval.combinedRetrievalRevision.combinedCorpusSnapshotHash}`,
    "",
    "Исходный текст секции:",
    clampText(input.context.sourceText, MAX_TARGET_TEXT_LENGTH) || "(пусто)",
    "",
    "Контекст секции:",
    input.context.contextText || "Дополнительный контекст не передан.",
    "",
    input.groundingMode === "law_grounded"
      ? "Grounded нормы закона:"
      : "Grounded судебные прецеденты:",
    groundedSources,
    "",
    "Перепиши только исходный текст секции.",
    "Не добавляй отсутствующие факты, нормы, статьи, прецеденты или новые требования.",
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

function buildInsufficientCorpusMessage(retrieval: AssistantRetrievalResult) {
  if (!retrieval.hasAnyUsableCorpus) {
    return "Для этого сервера сейчас нет подтверждённого usable corpus, на который можно опереть AI-предложение для этой секции.";
  }

  return "Для этой секции сейчас не нашлось достаточной grounded опоры в подтверждённом corpus. Попробуйте уточнить текст секции или обновить corpus сервера.";
}

export function mapGroundedDocumentFieldRewriteBlockingReasonsToMessages(
  reasons: GroundedDocumentFieldRewriteBlockedReason[],
) {
  return reasons.map((reason) => {
    if (reason === "unsupported_section") {
      return "Grounded AI v2 пока поддерживается только для legal sections этого rollout.";
    }

    return "В этой секции пока нет текста для grounded улучшения.";
  });
}

export async function rewriteOwnedGroundedDocumentField(
  input: {
    accountId: string;
    documentId: string;
    sectionKey: GroundedDocumentRewriteSectionKey;
  },
  dependencies: GroundedDocumentFieldRewriteDependencies = defaultDependencies,
): Promise<{
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  groundingMode: GroundedDocumentRewriteMode;
  references: GroundedDocumentReference[];
  usageMeta: GroundedDocumentFieldRewriteUsageMeta;
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

  const promptContext = buildGroundedPromptContext({
    documentType: document.documentType,
    payload: document.formPayloadJson,
    sectionKey: input.sectionKey,
  });
  const sourceText = clampText(promptContext.sourceText, MAX_TARGET_TEXT_LENGTH);

  if (sourceText.length === 0) {
    throw new GroundedDocumentFieldRewriteBlockedError(["source_text_empty"]);
  }

  const retrieval = await dependencies.searchAssistantCorpus({
    serverId: document.serverId,
    query: promptContext.searchQuery,
    lawLimit: MAX_LAW_PROMPT_BLOCKS,
    precedentLimit: MAX_PRECEDENT_PROMPT_BLOCKS,
  });
  const groundingMode = buildGroundedMode(retrieval);
  const references = groundingMode ? buildCompactReferences(retrieval, groundingMode) : [];
  const requestPayloadBase = {
    documentId: document.id,
    documentType: document.documentType,
    sectionKey: input.sectionKey,
    serverId: document.serverId,
    updatedAt: document.updatedAt.toISOString(),
    groundingMode: groundingMode ?? "insufficient_corpus",
    lawResultCount: retrieval.lawRetrieval.resultCount,
    precedentResultCount: retrieval.precedentRetrieval.resultCount,
    hasCurrentLawCorpus: retrieval.hasCurrentLawCorpus,
    hasUsablePrecedentCorpus: retrieval.hasUsablePrecedentCorpus,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
    contextFieldKeys: promptContext.contextFieldKeys,
    sourceLength: sourceText.length,
    retrievalPromptBlockCount: references.length,
  };

  if (!groundingMode || references.length === 0) {
    const message = buildInsufficientCorpusMessage(retrieval);

    await dependencies.createAIRequest({
      accountId: input.accountId,
      serverId: document.serverId,
      featureKey: GROUNDED_DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
      requestPayloadJson: requestPayloadBase,
      responsePayloadJson: {
        statusBranch: "insufficient_corpus",
        references,
      },
      status: "unavailable",
      errorMessage: message,
    });

    throw new GroundedDocumentFieldRewriteInsufficientCorpusError(message);
  }

  const startedAt = dependencies.now();
  const proxyResponse = await dependencies.requestProxyCompletion({
    systemPrompt: buildGroundedSystemPrompt(groundingMode),
    userPrompt: buildGroundedUserPrompt({
      serverName: document.server.name,
      documentTitle: document.title,
      context: promptContext,
      retrieval,
      groundingMode,
    }),
    requestMetadata: {
      featureKey: GROUNDED_DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
      documentId: document.id,
      documentType: document.documentType,
      sectionKey: input.sectionKey,
      groundingMode,
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      retrievalPromptBlockCount: references.length,
    },
  });
  const finishedAt = dependencies.now();
  const latencyMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

  if (proxyResponse.status !== "success") {
    await dependencies.createAIRequest({
      accountId: input.accountId,
      serverId: document.serverId,
      featureKey: GROUNDED_DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
      providerKey: "providerKey" in proxyResponse ? proxyResponse.providerKey ?? null : null,
      proxyKey: "proxyKey" in proxyResponse ? proxyResponse.proxyKey ?? null : null,
      model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
      requestPayloadJson: requestPayloadBase,
      responsePayloadJson: {
        statusBranch: "unavailable",
        latencyMs,
        references,
        attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
      },
      status: proxyResponse.status,
      errorMessage: proxyResponse.message,
    });

    throw new GroundedDocumentFieldRewriteUnavailableError(
      "Grounded AI rewrite сейчас недоступен. Попробуйте ещё раз позже.",
    );
  }

  const suggestionText = proxyResponse.content.trim();
  const finishReason = extractFinishReason(proxyResponse.responsePayloadJson ?? null);
  const usageMeta = groundedDocumentFieldRewriteUsageMetaSchema.parse({
    featureKey: GROUNDED_DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
    providerKey: proxyResponse.providerKey ?? null,
    proxyKey: proxyResponse.proxyKey ?? null,
    model: proxyResponse.model ?? null,
    latencyMs,
    suggestionLength: suggestionText.length,
    finishReason,
    attemptedProxyKeys: proxyResponse.attemptedProxyKeys,
    groundingMode,
    lawResultCount: retrieval.lawRetrieval.resultCount,
    precedentResultCount: retrieval.precedentRetrieval.resultCount,
    retrievalPromptBlockCount: references.length,
  });

  await dependencies.createAIRequest({
    accountId: input.accountId,
    serverId: document.serverId,
    featureKey: GROUNDED_DOCUMENT_FIELD_REWRITE_FEATURE_KEY,
    providerKey: usageMeta.providerKey,
    proxyKey: usageMeta.proxyKey,
    model: usageMeta.model,
    requestPayloadJson: requestPayloadBase,
    responsePayloadJson: {
      statusBranch: groundingMode,
      suggestionLength: usageMeta.suggestionLength,
      latencyMs: usageMeta.latencyMs,
      finishReason: usageMeta.finishReason,
      references,
      attemptedProxyKeys: usageMeta.attemptedProxyKeys,
      suggestionPreview: suggestionText.slice(0, MAX_SUGGESTION_PREVIEW_LENGTH),
    },
    status: "success",
    errorMessage: null,
  });

  return {
    sourceText,
    suggestionText,
    basedOnUpdatedAt: document.updatedAt.toISOString(),
    groundingMode,
    references,
    usageMeta,
  };
}

export const __groundedDocumentFieldRewriteInternals = {
  buildGroundedPromptContext,
  buildGroundedMode,
  buildGroundedSystemPrompt,
  buildGroundedUserPrompt,
  buildCompactReferences,
};
