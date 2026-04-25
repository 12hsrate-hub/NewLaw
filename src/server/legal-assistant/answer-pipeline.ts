import { createAIRequest } from "@/db/repositories/ai-request.repository";
import {
  type AssistantTypedRetrievalReference,
  searchAssistantCorpus,
} from "@/server/legal-assistant/retrieval";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";
import {
  type LegalCoreActorContext,
  buildAssistantSelfAssessment,
  classifyAssistantIntent,
  detectQuestionResponseMode,
} from "@/server/legal-core/metadata";
import {
  extractProxyUsageMetrics,
  LEGAL_ASSISTANT_PROMPT_VERSION,
} from "@/server/legal-core/observability";
import { buildAssistantFutureReviewMarker } from "@/server/legal-core/review-routing";

type RetrievalResult = Awaited<ReturnType<typeof searchAssistantCorpus>>;

type AnswerPipelineDependencies = {
  searchAssistantCorpus: typeof searchAssistantCorpus;
  requestAssistantProxyCompletion: typeof requestAssistantProxyCompletion;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: AnswerPipelineDependencies = {
  searchAssistantCorpus,
  requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

export type AssistantAnswerSections = {
  summary: string;
  normativeAnalysis: string;
  precedentAnalysis: string;
  interpretation: string;
  sources?: string;
};

function normalizeSectionText(input: string) {
  return input.trim().replace(/\n{3,}/g, "\n\n");
}

export function composeAssistantAnswerMarkdown(sections: AssistantAnswerSections) {
  return [
    "## Краткий вывод",
    normalizeSectionText(sections.summary),
    "",
    "## Что прямо следует из норм закона",
    normalizeSectionText(sections.normativeAnalysis),
    "",
    "## Что подтверждается судебными прецедентами",
    normalizeSectionText(sections.precedentAnalysis),
    "",
    "## Вывод / интерпретация",
    normalizeSectionText(sections.interpretation),
    "",
    "## Использованные нормы / источники",
    normalizeSectionText(
      sections.sources ??
        "Подтверждённые нормы, прецеденты и источники перечислены в grounded metadata ответа.",
    ),
  ].join("\n");
}

export function parseAssistantAnswerSections(content: string): AssistantAnswerSections {
  const normalizedContent = content.trim();
  const sectionPattern =
    /##\s*(Краткий вывод|Что прямо следует из норм закона|Что прямо следует из норм|Что подтверждается судебными прецедентами|Вывод \/ интерпретация|Использованные нормы \/ источники)\s*([\s\S]*?)(?=##\s*(?:Краткий вывод|Что прямо следует из норм закона|Что прямо следует из норм|Что подтверждается судебными прецедентами|Вывод \/ интерпретация|Использованные нормы \/ источники)|$)/g;
  const sectionMap = new Map<string, string>();

  for (const match of normalizedContent.matchAll(sectionPattern)) {
    const title = match[1] === "Что прямо следует из норм" ? "Что прямо следует из норм закона" : match[1];
    sectionMap.set(title, match[2].trim());
  }

  if (sectionMap.size === 0) {
    return {
      summary: normalizedContent,
      normativeAnalysis:
        "Модель не вернула отдельную секцию по тому, что прямо следует из норм закона.",
      precedentAnalysis:
        "Модель не выделила отдельную секцию по судебным прецедентам. Нужна ручная перепроверка grounded references.",
      interpretation:
        "Модель не выделила интерпретацию отдельно. Нужна ручная перепроверка по использованным источникам.",
      sources: "Использованные нормы и источники нужно брать только из grounded metadata ответа.",
    };
  }

  return {
    summary: sectionMap.get("Краткий вывод") ?? "Краткий вывод модель не вернула отдельно.",
    normativeAnalysis:
      sectionMap.get("Что прямо следует из норм закона") ??
      "Модель не вернула отдельную секцию по нормам закона.",
    precedentAnalysis:
      sectionMap.get("Что подтверждается судебными прецедентами") ??
      "Релевантные подтверждённые судебные прецеденты не были выделены отдельной секцией.",
    interpretation:
      sectionMap.get("Вывод / интерпретация") ??
      "Модель не вернула отдельную секцию интерпретации.",
    sources:
      sectionMap.get("Использованные нормы / источники") ??
      "Использованные нормы и источники нужно брать только из grounded metadata ответа.",
  };
}

const MAX_PROMPT_LAW_BLOCKS = 4;
const MAX_PROMPT_PRECEDENT_BLOCKS = 3;
const MAX_PROMPT_BLOCK_TEXT_LENGTH = 1200;
const MAX_REFERENCE_SNIPPET_LENGTH = 280;
const MAX_ANSWER_PREVIEW_LENGTH = 280;

type GroundedLawReference = {
  sourceKind: "law";
  serverId: string;
  lawId: string;
  lawKey: string;
  lawTitle: string;
  lawVersionId: string;
  lawVersionStatus: string;
  lawBlockId: string;
  blockType: string;
  blockOrder: number;
  articleNumberNormalized?: string | null;
  snippet: string;
  sourceTopicUrl: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
};

type GroundedPrecedentReference = {
  sourceKind: "precedent";
  serverId: string;
  precedentId: string;
  precedentKey: string;
  precedentTitle: string;
  precedentVersionId: string;
  precedentVersionStatus: string;
  precedentBlockId: string;
  blockType: string;
  blockOrder: number;
  validityStatus: string;
  snippet: string;
  sourceTopicUrl: string;
  sourceTopicTitle: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
};

type AssistantSourceLedgerEntry = {
  server_id: string;
  law_id: string;
  law_name: string;
  article_number: string | null;
  part_number: string | null;
  law_version: string;
  source_topic_url: string;
};

type AssistantSourceLedger = {
  server_id: string;
  law_version_ids: string[];
  found_norms: AssistantSourceLedgerEntry[];
  context_norms: AssistantSourceLedgerEntry[];
  used_norms: AssistantSourceLedgerEntry[];
};

type AssistantLawVersionContract = {
  server_id: string;
  law_corpus_snapshot_hash: string;
  law_version_ids: string[];
  contract_mode: "current_snapshot_only";
  found_norms_outside_current_snapshot: string[];
  context_norms_outside_current_snapshot: string[];
  used_norms_outside_current_snapshot: string[];
  is_current_snapshot_consistent: boolean;
};

type AssistantUsedSource =
  | {
      source_kind: "law";
      server_id: string;
      law_id: string;
      law_name: string;
      law_version: string;
      article_number: string | null;
      source_topic_url: string;
    }
  | {
      source_kind: "precedent";
      server_id: string;
      precedent_id: string;
      precedent_name: string;
      precedent_version: string;
      validity_status: string;
      source_topic_url: string;
    };

function buildSourceLedgerEntry(
  result:
    | RetrievalResult["lawRetrieval"]["results"][number]
    | Extract<AssistantTypedRetrievalReference, { sourceKind: "law" }>,
): AssistantSourceLedgerEntry {
  return {
    server_id: result.serverId,
    law_id: result.lawId,
    law_name: result.lawTitle,
    article_number: result.articleNumberNormalized ?? null,
    part_number: null,
    law_version: result.lawVersionId,
    source_topic_url: result.sourceTopicUrl,
  };
}

function buildAssistantUsedSources(retrieval: RetrievalResult): AssistantUsedSource[] {
  const lawSources = selectPromptContextResults(retrieval.results, "law", MAX_PROMPT_LAW_BLOCKS)
    .filter((result): result is Extract<AssistantTypedRetrievalReference, { sourceKind: "law" }> => {
      return result.sourceKind === "law";
    })
    .map((result) => ({
      source_kind: "law" as const,
      server_id: result.serverId,
      law_id: result.lawId,
      law_name: result.lawTitle,
      law_version: result.lawVersionId,
      article_number: result.articleNumberNormalized ?? null,
      source_topic_url: result.sourceTopicUrl,
    }));
  const precedentSources = selectPromptContextResults(
    retrieval.results,
    "precedent",
    MAX_PROMPT_PRECEDENT_BLOCKS,
  )
    .filter(
      (result): result is Extract<AssistantTypedRetrievalReference, { sourceKind: "precedent" }> => {
        return result.sourceKind === "precedent";
      },
    )
    .map((result) => ({
      source_kind: "precedent" as const,
      server_id: result.serverId,
      precedent_id: result.precedentId,
      precedent_name: result.precedentTitle,
      precedent_version: result.precedentVersionId,
      validity_status: result.validityStatus,
      source_topic_url: result.sourceTopicUrl,
    }));

  return [...lawSources, ...precedentSources];
}

function buildAssistantSourceLedger(retrieval: RetrievalResult) {
  const foundNorms = retrieval.lawRetrieval.results.map(buildSourceLedgerEntry);
  const contextNorms = selectPromptContextResults(retrieval.results, "law", MAX_PROMPT_LAW_BLOCKS)
    .filter((result): result is Extract<AssistantTypedRetrievalReference, { sourceKind: "law" }> => {
      return result.sourceKind === "law";
    })
    .map(buildSourceLedgerEntry);
  const lawVersionIds = Array.from(new Set(foundNorms.map((entry) => entry.law_version)));

  return {
    server_id: retrieval.serverId,
    law_version_ids: lawVersionIds,
    found_norms: foundNorms,
    context_norms: contextNorms,
    used_norms: [],
  } satisfies AssistantSourceLedger;
}

function buildAssistantSourceLedgerWithUsedNorms(
  sourceLedger: AssistantSourceLedger,
  usedNorms: AssistantSourceLedgerEntry[],
) {
  return {
    ...sourceLedger,
    used_norms: usedNorms,
  } satisfies AssistantSourceLedger;
}

function normalizeAssistantMatchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNormMentionedInAssistantSourcesSection(
  entry: AssistantSourceLedgerEntry,
  sourcesSection: string,
) {
  const normalizedSources = normalizeAssistantMatchText(sourcesSection);
  const normalizedLawName = normalizeAssistantMatchText(entry.law_name);

  if (normalizedLawName.length > 0 && normalizedSources.includes(normalizedLawName)) {
    return true;
  }

  if (!entry.article_number) {
    return false;
  }

  const escapedArticleNumber = escapeRegExp(entry.article_number);
  const articlePatterns = [
    new RegExp(`статья\\s+${escapedArticleNumber}`, "i"),
    new RegExp(`ст\\.\\s*${escapedArticleNumber}`, "i"),
    new RegExp(`статьи\\s+${escapedArticleNumber}`, "i"),
  ];

  return articlePatterns.some((pattern) => pattern.test(sourcesSection));
}

function inferAssistantUsedNorms(input: {
  sourceLedger: AssistantSourceLedger;
  sections: AssistantAnswerSections;
}) {
  return input.sourceLedger.context_norms.filter((entry) =>
    isNormMentionedInAssistantSourcesSection(entry, input.sections.sources ?? ""),
  );
}

function collectOutsideSnapshotLawVersionIds(input: {
  entries: AssistantSourceLedgerEntry[];
  currentLawVersionIds: string[];
}) {
  const currentLawVersionIdSet = new Set(input.currentLawVersionIds);

  return Array.from(
    new Set(
      input.entries
        .map((entry) => entry.law_version)
        .filter((lawVersion) => !currentLawVersionIdSet.has(lawVersion)),
    ),
  );
}

function buildAssistantLawVersionContract(input: {
  retrieval: RetrievalResult;
  sourceLedger: AssistantSourceLedger;
}) {
  const foundOutside = collectOutsideSnapshotLawVersionIds({
    entries: input.sourceLedger.found_norms,
    currentLawVersionIds: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
  });
  const contextOutside = collectOutsideSnapshotLawVersionIds({
    entries: input.sourceLedger.context_norms,
    currentLawVersionIds: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
  });
  const usedOutside = collectOutsideSnapshotLawVersionIds({
    entries: input.sourceLedger.used_norms,
    currentLawVersionIds: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
  });

  return {
    server_id: input.retrieval.serverId,
    law_corpus_snapshot_hash: input.retrieval.lawCorpusSnapshot.corpusSnapshotHash,
    law_version_ids: input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    contract_mode: "current_snapshot_only" as const,
    found_norms_outside_current_snapshot: foundOutside,
    context_norms_outside_current_snapshot: contextOutside,
    used_norms_outside_current_snapshot: usedOutside,
    is_current_snapshot_consistent:
      foundOutside.length === 0 && contextOutside.length === 0 && usedOutside.length === 0,
  } satisfies AssistantLawVersionContract;
}

function buildGroundedReferences(retrieval: RetrievalResult) {
  return retrieval.results.map((result) => {
    if (result.sourceKind === "law") {
      return {
        sourceKind: "law",
        serverId: result.serverId,
        lawId: result.lawId,
        lawKey: result.lawKey,
        lawTitle: result.lawTitle,
        lawVersionId: result.lawVersionId,
        lawVersionStatus: result.lawVersionStatus,
        lawBlockId: result.lawBlockId,
        blockType: result.blockType,
        blockOrder: result.blockOrder,
        articleNumberNormalized: result.articleNumberNormalized,
        snippet: result.snippet.slice(0, MAX_REFERENCE_SNIPPET_LENGTH),
        sourceTopicUrl: result.sourceTopicUrl,
        sourcePosts: result.sourcePosts,
      } satisfies GroundedLawReference;
    }

    return {
      sourceKind: "precedent",
      serverId: result.serverId,
      precedentId: result.precedentId,
      precedentKey: result.precedentKey,
      precedentTitle: result.precedentTitle,
      precedentVersionId: result.precedentVersionId,
      precedentVersionStatus: result.precedentVersionStatus,
      precedentBlockId: result.precedentBlockId,
      blockType: result.blockType,
      blockOrder: result.blockOrder,
      validityStatus: result.validityStatus,
      snippet: result.snippet.slice(0, MAX_REFERENCE_SNIPPET_LENGTH),
      sourceTopicUrl: result.sourceTopicUrl,
      sourceTopicTitle: result.sourceTopicTitle,
      sourcePosts: result.sourcePosts,
    } satisfies GroundedPrecedentReference;
  });
}

function buildLawsUsed(retrieval: RetrievalResult) {
  return Array.from(
    new Map(
      retrieval.lawRetrieval.results.map((result) => [
        `${result.lawId}:${result.lawVersionId}`,
        {
          lawId: result.lawId,
          lawKey: result.lawKey,
          lawTitle: result.lawTitle,
          lawVersionId: result.lawVersionId,
          lawBlockIds: [] as string[],
          articleNumbers: [] as string[],
          sourceTopicUrl: result.sourceTopicUrl,
        },
      ]),
    ).values(),
  ).map((entry) => {
    const matchingResults = retrieval.lawRetrieval.results.filter(
      (result) => result.lawId === entry.lawId && result.lawVersionId === entry.lawVersionId,
    );

    return {
      ...entry,
      lawBlockIds: matchingResults.map((result) => result.lawBlockId),
      articleNumbers: matchingResults
        .map((result) => result.articleNumberNormalized)
        .filter((value): value is string => Boolean(value)),
    };
  });
}

function buildPrecedentsUsed(retrieval: RetrievalResult) {
  return Array.from(
    new Map(
      retrieval.precedentRetrieval.results.map((result) => [
        `${result.precedentId}:${result.precedentVersionId}`,
        {
          precedentId: result.precedentId,
          precedentKey: result.precedentKey,
          precedentTitle: result.precedentTitle,
          precedentVersionId: result.precedentVersionId,
          precedentBlockIds: [] as string[],
          validityStatus: result.validityStatus,
          sourceTopicUrl: result.sourceTopicUrl,
          sourcePostIds: [] as string[],
        },
      ]),
    ).values(),
  ).map((entry) => {
    const matchingResults = retrieval.precedentRetrieval.results.filter(
      (result) =>
        result.precedentId === entry.precedentId &&
        result.precedentVersionId === entry.precedentVersionId,
    );

    return {
      ...entry,
      precedentBlockIds: matchingResults.map((result) => result.precedentBlockId),
      sourcePostIds: Array.from(
        new Set(
          matchingResults.flatMap((result) => result.sourcePosts.map((sourcePost) => sourcePost.postExternalId)),
        ),
      ),
    };
  });
}

function selectPromptContextResults(
  results: AssistantTypedRetrievalReference[],
  sourceKind: "law" | "precedent",
  limit: number,
) {
  const filteredResults = results.filter((result) => result.sourceKind === sourceKind);

  return [...filteredResults]
    .sort((left, right) => {
      return left.blockOrder - right.blockOrder;
    })
    .slice(0, limit);
}

function buildSourcesSectionText(retrieval: RetrievalResult) {
  const lawsUsed = buildLawsUsed(retrieval);
  const precedentsUsed = buildPrecedentsUsed(retrieval);

  const parts: string[] = [];

  if (lawsUsed.length > 0) {
    parts.push(
      [
        "Законы:",
        ...lawsUsed.map((law, index) => {
          const articleLabel =
            law.articleNumbers.length > 0
              ? `статьи: ${law.articleNumbers.join(", ")}`
              : "без номера статьи";

          return `${index + 1}. ${law.lawTitle} (${law.lawKey}) — ${articleLabel}; тема: ${law.sourceTopicUrl}`;
        }),
      ].join("\n"),
    );
  }

  if (precedentsUsed.length > 0) {
    parts.push(
      [
        "Судебные прецеденты:",
        ...precedentsUsed.map((precedent, index) => {
          return `${index + 1}. ${precedent.precedentTitle} (${precedent.precedentKey}) — validity: ${precedent.validityStatus}; тема: ${precedent.sourceTopicUrl}`;
        }),
      ].join("\n"),
    );
  }

  if (parts.length === 0) {
    return "Подтверждённые нормы и прямые ссылки на источники в этом ответе не использовались.";
  }

  return parts.join("\n\n");
}

function buildAssistantSystemPrompt() {
  return [
    "Ты — server legal assistant Lawyer5RP.",
    "Отвечай только по переданному confirmed corpus выбранного сервера.",
    "Используй только current primary laws и только confirmed judicial precedents со status=current и validity in (applicable, limited).",
    "Не используй supplements, obsolete precedents, draft/superseded versions, общие знания, догадки или ответы вне корпуса.",
    "Законы и судебные прецеденты — разные типы источников. Не выдавай precedent как будто это норма закона.",
    "Если законы есть, law-grounded часть ответа должна идти раньше precedent-grounded части.",
    "Если закон не найден, но найден подтверждённый precedent, прямо напиши, что ответ опирается на precedent-corpus, а не на норму закона.",
    "Если надёжной нормы или подходящего подтверждённого precedent мало, не выдумывай ответ и не делай категоричных выводов.",
    "Если что-то следует не прямо из источника, вынеси это только в секцию интерпретации.",
    "Не используй для пользователя формулировки: 'недостаточно данных', 'невозможно определить', 'я не нашёл норму', 'нельзя сделать вывод'.",
    "Если опоры недостаточно, используй аккуратные условные формулировки: 'оценка зависит от...', 'при наличии оснований...', 'при соблюдении порядка...', 'может свидетельствовать...', 'допустимо при условии...'.",
    "В секции 'Использованные нормы / источники' перечисли только те нормы и прецеденты, на которые ты реально опирался в ответе.",
    "Верни ответ строго на русском языке и строго с markdown-секциями второго уровня:",
    "## Краткий вывод",
    "## Что прямо следует из норм закона",
    "## Что подтверждается судебными прецедентами",
    "## Вывод / интерпретация",
    "## Использованные нормы / источники",
  ].join("\n");
}

function buildAssistantUserPrompt(input: {
  serverName: string;
  question: string;
  actorContext: LegalCoreActorContext;
  retrieval: RetrievalResult;
}) {
  const lawContext = selectPromptContextResults(input.retrieval.results, "law", MAX_PROMPT_LAW_BLOCKS)
    .map((result, index) => {
      if (result.sourceKind !== "law") {
        return null;
      }

      return [
        `Law source ${index + 1}`,
        `- law_key: ${result.lawKey}`,
        `- title: ${result.lawTitle}`,
        `- version_id: ${result.lawVersionId}`,
        `- block_id: ${result.lawBlockId}`,
        `- block_type: ${result.blockType}`,
        `- article_number_normalized: ${result.articleNumberNormalized ?? "n/a"}`,
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- text: ${normalizeSectionText(result.blockText).slice(0, MAX_PROMPT_BLOCK_TEXT_LENGTH)}`,
      ].join("\n");
    })
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  const precedentContext = selectPromptContextResults(
    input.retrieval.results,
    "precedent",
    MAX_PROMPT_PRECEDENT_BLOCKS,
  )
    .map((result, index) => {
      if (result.sourceKind !== "precedent") {
        return null;
      }

      return [
        `Precedent source ${index + 1}`,
        `- precedent_key: ${result.precedentKey}`,
        `- title: ${result.precedentTitle}`,
        `- version_id: ${result.precedentVersionId}`,
        `- block_id: ${result.precedentBlockId}`,
        `- block_type: ${result.blockType}`,
        `- validity_status: ${result.validityStatus}`,
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- text: ${normalizeSectionText(result.blockText).slice(0, MAX_PROMPT_BLOCK_TEXT_LENGTH)}`,
      ].join("\n");
    })
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  return [
    `Сервер: ${input.serverName}`,
    `Вопрос пользователя: ${input.question}`,
    `Actor context: ${input.actorContext}`,
    `Combined corpus snapshot hash: ${input.retrieval.combinedRetrievalRevision.combinedCorpusSnapshotHash}`,
    `Law version contract: current_snapshot_only (${input.retrieval.combinedRetrievalRevision.lawCurrentVersionIds.join(", ") || "none"})`,
    "Законы (используй только этот grounded layer, если он есть):",
    lawContext || "Подходящие current primary laws по запросу не найдены.",
    "Судебные прецеденты (используй только этот grounded layer, если он есть):",
    precedentContext || "Подходящие confirmed precedents по запросу не найдены.",
    "Если law layer пустой, но precedent layer есть, прямо обозначь это в выводе.",
    "Если ни один layer не даёт надёжной опоры, признай ограничение и не выдумывай ответ.",
  ].join("\n\n");
}

function buildNoNormsAnswer(retrieval: RetrievalResult) {
  const hasCurrentLaws = retrieval.hasCurrentLawCorpus;
  const hasUsablePrecedents = retrieval.hasUsablePrecedentCorpus;
  const sections = {
    summary:
      "Оценка по этому вопросу зависит от наличия в подтверждённом корпусе выбранного сервера прямой нормы или подтверждённого прецедента.",
    normativeAnalysis: hasCurrentLaws
      ? "В current primary laws выбранного сервера сейчас не сформировалась достаточная прямая нормативная опора по заданной формулировке вопроса."
      : "Для этого сервера прямая нормативная опора по заданной формулировке вопроса пока не сформирована в current primary laws.",
    precedentAnalysis: hasUsablePrecedents
      ? "Среди подтверждённых current precedents со статусом validity applicable или limited сейчас нет достаточной опоры для уверенного самостоятельного вывода."
      : "Подходящая precedent-опора по этому вопросу для выбранного сервера пока не сформирована.",
    interpretation:
      "При наличии более точной формулировки вопроса или дополнительной confirmed corpus-опоры вывод может быть уточнён без выхода за пределы законодательства выбранного сервера.",
  } satisfies AssistantAnswerSections;

  return {
    sections,
    answerMarkdown: composeAssistantAnswerMarkdown(sections),
  };
}

function buildUnavailableMessage() {
  return "Сервис юридического помощника сейчас недоступен. Попробуй задать вопрос позже.";
}

function buildAnswerPreview(value: string) {
  return normalizeSectionText(value).slice(0, MAX_ANSWER_PREVIEW_LENGTH);
}

export async function generateServerLegalAssistantAnswer(
  input: {
    serverId: string;
    serverCode: string;
    serverName: string;
    question: string;
    actorContext?: LegalCoreActorContext;
    accountId?: string | null;
    guestSessionId?: string | null;
  },
  dependencies: AnswerPipelineDependencies = defaultDependencies,
) {
  const retrieval = await dependencies.searchAssistantCorpus({
    serverId: input.serverId,
    query: input.question,
    lawLimit: 6,
    precedentLimit: 4,
  });
  const intent = classifyAssistantIntent(input.question);
  const responseMode = detectQuestionResponseMode(input.question);
  const actorContext = input.actorContext ?? "general_question";
  const sourceLedgerBase = buildAssistantSourceLedger(retrieval);
  const sourceLedger = buildAssistantSourceLedgerWithUsedNorms(sourceLedgerBase, []);
  const lawVersionContract = buildAssistantLawVersionContract({
    retrieval,
    sourceLedger,
  });
  const usedSources = buildAssistantUsedSources(retrieval);
  const metadataBase = {
    serverId: input.serverId,
    serverCode: input.serverCode,
    serverName: input.serverName,
    lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
    precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
    corpusSnapshot: retrieval.combinedRetrievalRevision,
    lawsUsed: buildLawsUsed(retrieval),
    precedentsUsed: buildPrecedentsUsed(retrieval),
    references: buildGroundedReferences(retrieval),
    intent,
    actor_context: actorContext,
    response_mode: responseMode,
    prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
    law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    law_version_contract: lawVersionContract,
    used_sources: usedSources,
    source_ledger: sourceLedger,
  };

  if (!retrieval.hasAnyUsableCorpus) {
    const selfAssessment = buildAssistantSelfAssessment({
      status: "no_corpus",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
    });
    const futureReviewMarker = buildAssistantFutureReviewMarker({
      selfAssessment,
      status: "no_corpus",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
    });
    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      status: "unavailable",
      requestPayloadJson: {
        branch: "no_corpus",
        serverId: input.serverId,
        serverCode: input.serverCode,
        question: input.question,
        intent,
        actor_context: actorContext,
        response_mode: responseMode,
        prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
        law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
        law_version_contract: lawVersionContract,
        used_sources: usedSources,
        source_ledger: sourceLedger,
      },
      responsePayloadJson: {
        branch: "no_corpus",
        lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
        precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
        combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
        latencyMs: 0,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        cost_usd: null,
        confidence: selfAssessment.answer_confidence,
        used_sources: usedSources,
        ...futureReviewMarker,
        self_assessment: selfAssessment,
      },
      errorMessage: "Для выбранного сервера нет confirmed current law или precedent corpus.",
    });

    return {
      status: "no_corpus" as const,
      message: "Для выбранного сервера пока нет подтверждённого usable corpus для юридического помощника.",
      metadata: {
        ...metadataBase,
        self_assessment: selfAssessment,
      },
    };
  }

  if (retrieval.resultCount === 0) {
    const fallbackAnswer = buildNoNormsAnswer(retrieval);
    const fallbackSections = {
      ...fallbackAnswer.sections,
      sources: buildSourcesSectionText(retrieval),
    };
    const fallbackAnswerMarkdown = composeAssistantAnswerMarkdown(fallbackSections);
    const selfAssessment = buildAssistantSelfAssessment({
      status: "no_norms",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
    });
    const futureReviewMarker = buildAssistantFutureReviewMarker({
      selfAssessment,
      status: "no_norms",
      lawResultCount: retrieval.lawRetrieval.resultCount,
      precedentResultCount: retrieval.precedentRetrieval.resultCount,
      lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
    });

    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      status: "success",
      requestPayloadJson: {
        branch: "no_norms",
        serverId: input.serverId,
        serverCode: input.serverCode,
        question: input.question,
        intent,
        actor_context: actorContext,
        response_mode: responseMode,
        prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
        law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
        law_version_contract: lawVersionContract,
        used_sources: usedSources,
        source_ledger: sourceLedger,
      },
      responsePayloadJson: {
        branch: "no_norms",
        lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
        precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
        combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
        resultCount: retrieval.resultCount,
        latencyMs: 0,
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        cost_usd: null,
        confidence: selfAssessment.answer_confidence,
        used_sources: usedSources,
        answer_markdown_preview: buildAnswerPreview(fallbackAnswerMarkdown),
        answer_sections: fallbackSections,
        ...futureReviewMarker,
        self_assessment: selfAssessment,
      },
      errorMessage: null,
    });

    return {
      status: "no_norms" as const,
      answerMarkdown: fallbackAnswerMarkdown,
      sections: fallbackSections,
      metadata: {
        ...metadataBase,
        self_assessment: selfAssessment,
      },
    };
  }

  const answeredSelfAssessment = buildAssistantSelfAssessment({
    status: "answered",
    lawResultCount: retrieval.lawRetrieval.resultCount,
    precedentResultCount: retrieval.precedentRetrieval.resultCount,
  });
  const answeredFutureReviewMarker = buildAssistantFutureReviewMarker({
    selfAssessment: answeredSelfAssessment,
    status: "answered",
    lawResultCount: retrieval.lawRetrieval.resultCount,
    precedentResultCount: retrieval.precedentRetrieval.resultCount,
    lawVersionContractConsistent: lawVersionContract.is_current_snapshot_consistent,
  });
  const proxyRequestPayload = {
    featureKey: "server_legal_assistant",
    serverId: input.serverId,
    serverCode: input.serverCode,
    question: input.question,
    intent,
    actor_context: actorContext,
    response_mode: responseMode,
    prompt_version: LEGAL_ASSISTANT_PROMPT_VERSION,
    law_version_ids: retrieval.combinedRetrievalRevision.lawCurrentVersionIds,
    law_version_contract: lawVersionContract,
    used_sources: usedSources,
    lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
    precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
    source_ledger: sourceLedger,
    retrievalResults: retrieval.results.map((result) => {
      if (result.sourceKind === "law") {
        return {
          sourceKind: "law",
          lawKey: result.lawKey,
          lawVersionId: result.lawVersionId,
          lawBlockId: result.lawBlockId,
          blockType: result.blockType,
          articleNumberNormalized: result.articleNumberNormalized,
          sourceTopicUrl: result.sourceTopicUrl,
        };
      }

      return {
        sourceKind: "precedent",
        precedentKey: result.precedentKey,
        precedentVersionId: result.precedentVersionId,
        precedentBlockId: result.precedentBlockId,
        blockType: result.blockType,
        validityStatus: result.validityStatus,
        sourceTopicUrl: result.sourceTopicUrl,
      };
    }),
  };
  const startedAt = dependencies.now();
  const proxyResponse = await dependencies.requestAssistantProxyCompletion({
    systemPrompt: buildAssistantSystemPrompt(),
    userPrompt: buildAssistantUserPrompt({
      serverName: input.serverName,
      question: input.question,
      actorContext,
      retrieval,
    }),
    requestMetadata: {
      ...proxyRequestPayload,
      retrievalResultsCount: proxyRequestPayload.retrievalResults.length,
      lawResultsCount: retrieval.lawRetrieval.resultCount,
      precedentResultsCount: retrieval.precedentRetrieval.resultCount,
    },
  });
  const finishedAt = dependencies.now();
  const latencyMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  const usageMetrics = extractProxyUsageMetrics(
    "responsePayloadJson" in proxyResponse ? proxyResponse.responsePayloadJson ?? null : null,
  );

  if (proxyResponse.status !== "success") {
    await dependencies.createAIRequest({
      accountId: input.accountId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      serverId: input.serverId,
      featureKey: "server_legal_assistant",
      providerKey: "providerKey" in proxyResponse ? proxyResponse.providerKey ?? null : null,
      proxyKey: "proxyKey" in proxyResponse ? proxyResponse.proxyKey ?? null : null,
      model: "model" in proxyResponse ? proxyResponse.model ?? null : null,
      requestPayloadJson: proxyRequestPayload,
      responsePayloadJson:
        "responsePayloadJson" in proxyResponse
          ? {
              ...(proxyResponse.responsePayloadJson ?? {}),
              latencyMs,
              prompt_tokens: usageMetrics.prompt_tokens,
              completion_tokens: usageMetrics.completion_tokens,
              total_tokens: usageMetrics.total_tokens,
              cost_usd: usageMetrics.cost_usd,
              confidence: answeredSelfAssessment.answer_confidence,
              used_sources: usedSources,
              ...answeredFutureReviewMarker,
              self_assessment: answeredSelfAssessment,
            }
          : {
              latencyMs,
              prompt_tokens: usageMetrics.prompt_tokens,
              completion_tokens: usageMetrics.completion_tokens,
              total_tokens: usageMetrics.total_tokens,
              cost_usd: usageMetrics.cost_usd,
              confidence: answeredSelfAssessment.answer_confidence,
              used_sources: usedSources,
              ...answeredFutureReviewMarker,
              self_assessment: answeredSelfAssessment,
            },
      status: proxyResponse.status === "failure" ? "failure" : "unavailable",
      errorMessage: proxyResponse.message,
    });

    return {
      status: "unavailable" as const,
      message: buildUnavailableMessage(),
      metadata: {
        ...metadataBase,
        self_assessment: buildAssistantSelfAssessment({
          status: "unavailable",
          lawResultCount: retrieval.lawRetrieval.resultCount,
          precedentResultCount: retrieval.precedentRetrieval.resultCount,
        }),
      },
    };
  }

  const parsedSections = parseAssistantAnswerSections(proxyResponse.content);
  const sections = {
    ...parsedSections,
    sources: proxyResponse.content.includes("## Использованные нормы / источники")
      ? parsedSections.sources
      : buildSourcesSectionText(retrieval),
  };
  const answerMarkdown = composeAssistantAnswerMarkdown(sections);
  const usedNorms = inferAssistantUsedNorms({
    sourceLedger,
    sections,
  });
  const answeredSourceLedger = buildAssistantSourceLedgerWithUsedNorms(sourceLedgerBase, usedNorms);
  const answeredLawVersionContract = buildAssistantLawVersionContract({
    retrieval,
    sourceLedger: answeredSourceLedger,
  });

  await dependencies.createAIRequest({
    accountId: input.accountId ?? null,
    guestSessionId: input.guestSessionId ?? null,
    serverId: input.serverId,
    featureKey: "server_legal_assistant",
    providerKey: proxyResponse.providerKey ?? null,
    proxyKey: proxyResponse.proxyKey ?? null,
    model: proxyResponse.model ?? null,
    requestPayloadJson: {
      ...proxyRequestPayload,
      law_version_contract: answeredLawVersionContract,
      source_ledger: answeredSourceLedger,
    },
    responsePayloadJson: {
      ...(proxyResponse.responsePayloadJson ?? {}),
      latencyMs,
      prompt_tokens: usageMetrics.prompt_tokens,
      completion_tokens: usageMetrics.completion_tokens,
      total_tokens: usageMetrics.total_tokens,
      cost_usd: usageMetrics.cost_usd,
      confidence: answeredSelfAssessment.answer_confidence,
      used_sources: usedSources,
      answer_markdown_preview: buildAnswerPreview(answerMarkdown),
      answer_sections: sections,
      ...answeredFutureReviewMarker,
      self_assessment: answeredSelfAssessment,
    },
    status: "success",
    errorMessage: null,
  });

  return {
    status: "answered" as const,
    answerMarkdown,
    sections,
    metadata: {
      ...metadataBase,
      law_version_contract: answeredLawVersionContract,
      source_ledger: answeredSourceLedger,
      self_assessment: answeredSelfAssessment,
    },
  };
}
