import { createAIRequest } from "@/db/repositories/ai-request.repository";
import {
  type AssistantTypedRetrievalReference,
  searchAssistantCorpus,
} from "@/server/legal-assistant/retrieval";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";

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
    "Если надёжной нормы или подходящего подтверждённого precedent нет, не выдумывай ответ.",
    "Если что-то следует не прямо из источника, вынеси это только в секцию интерпретации.",
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
    `Combined corpus snapshot hash: ${input.retrieval.combinedRetrievalRevision.combinedCorpusSnapshotHash}`,
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
      "В текущем подтверждённом корпусе выбранного сервера релевантная норма или подтверждённый прецедент по этому вопросу не найдены.",
    normativeAnalysis: hasCurrentLaws
      ? "В current primary laws выбранного сервера retrieval не нашёл статей или иных блоков, на которые можно надёжно опереться."
      : "Для этого сервера сейчас нет релевантных current primary laws, которые можно использовать как прямую нормативную опору по вопросу.",
    precedentAnalysis: hasUsablePrecedents
      ? "Среди подтверждённых current precedents со статусом validity applicable или limited retrieval не нашёл подходящих блоков, которые можно надёжно использовать в ответе."
      : "В usable precedent corpus выбранного сервера нет подходящих подтверждённых прецедентов, на которые можно добросовестно сослаться.",
    interpretation:
      "Я не могу добросовестно выводить ответ вне подтверждённого корпуса. Нужна либо более точная формулировка вопроса, либо пополнение confirmed corpus сервера.",
  } satisfies AssistantAnswerSections;

  return {
    sections,
    answerMarkdown: composeAssistantAnswerMarkdown(sections),
  };
}

function buildUnavailableMessage() {
  return "Сервис юридического помощника сейчас недоступен. Попробуй задать вопрос позже.";
}

export async function generateServerLegalAssistantAnswer(
  input: {
    serverId: string;
    serverCode: string;
    serverName: string;
    question: string;
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
  };

  if (!retrieval.hasAnyUsableCorpus) {
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
      },
      responsePayloadJson: {
        branch: "no_corpus",
        lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
        precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
        combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
      },
      errorMessage: "Для выбранного сервера нет confirmed current law или precedent corpus.",
    });

    return {
      status: "no_corpus" as const,
      message: "Для выбранного сервера пока нет подтверждённого usable corpus для юридического помощника.",
      metadata: metadataBase,
    };
  }

  if (retrieval.resultCount === 0) {
    const fallbackAnswer = buildNoNormsAnswer(retrieval);

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
      },
      responsePayloadJson: {
        branch: "no_norms",
        lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
        precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
        combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
        resultCount: retrieval.resultCount,
      },
      errorMessage: null,
    });

    return {
      status: "no_norms" as const,
      answerMarkdown: composeAssistantAnswerMarkdown({
        ...fallbackAnswer.sections,
        sources: buildSourcesSectionText(retrieval),
      }),
      sections: {
        ...fallbackAnswer.sections,
        sources: buildSourcesSectionText(retrieval),
      },
      metadata: metadataBase,
    };
  }

  const proxyRequestPayload = {
    featureKey: "server_legal_assistant",
    serverId: input.serverId,
    serverCode: input.serverCode,
    question: input.question,
    lawCorpusSnapshot: retrieval.lawCorpusSnapshot,
    precedentCorpusSnapshot: retrieval.precedentCorpusSnapshot,
    combinedRetrievalRevision: retrieval.combinedRetrievalRevision,
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
  const proxyResponse = await dependencies.requestAssistantProxyCompletion({
    systemPrompt: buildAssistantSystemPrompt(),
    userPrompt: buildAssistantUserPrompt({
      serverName: input.serverName,
      question: input.question,
      retrieval,
    }),
    requestMetadata: {
      ...proxyRequestPayload,
      retrievalResultsCount: proxyRequestPayload.retrievalResults.length,
      lawResultsCount: retrieval.lawRetrieval.resultCount,
      precedentResultsCount: retrieval.precedentRetrieval.resultCount,
    },
  });

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
      "responsePayloadJson" in proxyResponse ? proxyResponse.responsePayloadJson ?? null : null,
    status:
      proxyResponse.status === "success"
        ? "success"
        : proxyResponse.status === "failure"
          ? "failure"
          : "unavailable",
    errorMessage: proxyResponse.status === "success" ? null : proxyResponse.message,
  });

  if (proxyResponse.status !== "success") {
    return {
      status: "unavailable" as const,
      message: buildUnavailableMessage(),
      metadata: metadataBase,
    };
  }

  const sections = {
    ...parseAssistantAnswerSections(proxyResponse.content),
    sources: buildSourcesSectionText(retrieval),
  };
  const answerMarkdown = composeAssistantAnswerMarkdown(sections);

  return {
    status: "answered" as const,
    answerMarkdown,
    sections,
    metadata: metadataBase,
  };
}
