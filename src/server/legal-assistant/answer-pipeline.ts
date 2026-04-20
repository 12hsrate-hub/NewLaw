import { createAIRequest } from "@/db/repositories/ai-request.repository";
import { searchCurrentLawCorpus } from "@/server/law-corpus/retrieval";
import { requestAssistantProxyCompletion } from "@/server/legal-assistant/ai-proxy";

type RetrievalResult = Awaited<ReturnType<typeof searchCurrentLawCorpus>>;

type AnswerPipelineDependencies = {
  searchCurrentLawCorpus: typeof searchCurrentLawCorpus;
  requestAssistantProxyCompletion: typeof requestAssistantProxyCompletion;
  createAIRequest: typeof createAIRequest;
  now: () => Date;
};

const defaultDependencies: AnswerPipelineDependencies = {
  searchCurrentLawCorpus,
  requestAssistantProxyCompletion,
  createAIRequest,
  now: () => new Date(),
};

export type AssistantAnswerSections = {
  summary: string;
  normativeAnalysis: string;
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
    "## Что прямо следует из норм",
    normalizeSectionText(sections.normativeAnalysis),
    "",
    "## Вывод / интерпретация",
    normalizeSectionText(sections.interpretation),
    "",
    "## Использованные нормы / источники",
    normalizeSectionText(
      sections.sources ??
        "Подтверждённые нормы и источники перечислены в grounded metadata ответа.",
    ),
  ].join("\n");
}

export function parseAssistantAnswerSections(content: string): AssistantAnswerSections {
  const normalizedContent = content.trim();
  const sectionPattern =
    /##\s*(Краткий вывод|Что прямо следует из норм|Вывод \/ интерпретация|Использованные нормы \/ источники)\s*([\s\S]*?)(?=##\s*(?:Краткий вывод|Что прямо следует из норм|Вывод \/ интерпретация|Использованные нормы \/ источники)|$)/g;
  const sectionMap = new Map<string, string>();

  for (const match of normalizedContent.matchAll(sectionPattern)) {
    sectionMap.set(match[1], match[2].trim());
  }

  if (sectionMap.size === 0) {
    return {
      summary: normalizedContent,
      normativeAnalysis: "Модель не вернула отдельную нормативную секцию в ожидаемом формате.",
      interpretation: "Модель не выделила интерпретацию отдельно. Нужна ручная перепроверка по использованным нормам.",
      sources: "Использованные нормы и источники нужно брать только из grounded metadata ответа.",
    };
  }

  return {
    summary: sectionMap.get("Краткий вывод") ?? "Краткий вывод модель не вернула отдельно.",
    normativeAnalysis:
      sectionMap.get("Что прямо следует из норм") ??
      "Модель не вернула отдельный список того, что прямо следует из норм.",
    interpretation:
      sectionMap.get("Вывод / интерпретация") ??
      "Модель не вернула отдельную секцию интерпретации.",
    sources:
      sectionMap.get("Использованные нормы / источники") ??
      "Использованные нормы и источники нужно брать только из grounded metadata ответа.",
  };
}

const MAX_PROMPT_BLOCKS = 4;
const MAX_PROMPT_BLOCK_TEXT_LENGTH = 1200;
const MAX_REFERENCE_SNIPPET_LENGTH = 280;

function buildGroundedReferences(retrieval: RetrievalResult) {
  return retrieval.results.map((result) => ({
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
  }));
}

function buildLawsUsed(retrieval: RetrievalResult) {
  return Array.from(
    new Map(
      retrieval.results.map((result) => [
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
    const matchingResults = retrieval.results.filter(
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

function selectPromptContextResults(retrieval: RetrievalResult) {
  return [...retrieval.results]
    .sort((left, right) => {
      if (left.blockType === "article" && right.blockType !== "article") {
        return -1;
      }

      if (left.blockType !== "article" && right.blockType === "article") {
        return 1;
      }

      return left.blockOrder - right.blockOrder;
    })
    .slice(0, MAX_PROMPT_BLOCKS);
}

function buildSourcesSectionText(retrieval: RetrievalResult) {
  const lawsUsed = buildLawsUsed(retrieval);

  if (lawsUsed.length === 0) {
    return "Подтверждённые нормы и прямые ссылки на источники в этом ответе не использовались.";
  }

  return lawsUsed
    .map((law, index) => {
      const articleLabel =
        law.articleNumbers.length > 0 ? `статьи: ${law.articleNumbers.join(", ")}` : "без номера статьи";

      return `${index + 1}. ${law.lawTitle} (${law.lawKey}) — ${articleLabel}; тема: ${law.sourceTopicUrl}`;
    })
    .join("\n");
}

function buildAssistantSystemPrompt() {
  return [
    "Ты — server legal assistant Lawyer5RP.",
    "Отвечай только по переданному confirmed corpus current primary laws выбранного сервера.",
    "Не используй supplements, precedents, общие знания, догадки или ответы вне корпуса.",
    "Если надёжной нормы нет, не выдумывай ответ.",
    "Если что-то следует не прямо из нормы, вынеси это только в секцию интерпретации.",
    "Не выдавай интерпретацию как будто она прямо написана в законе.",
    "Верни ответ строго на русском языке и строго с markdown-секциями второго уровня:",
    "## Краткий вывод",
    "## Что прямо следует из норм",
    "## Вывод / интерпретация",
  ].join("\n");
}

function buildAssistantUserPrompt(input: {
  serverName: string;
  question: string;
  retrieval: RetrievalResult;
}) {
  const groundedContext = selectPromptContextResults(input.retrieval)
    .map((result, index) => {
      return [
        `Источник ${index + 1}`,
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
    .join("\n\n");

  return [
    `Сервер: ${input.serverName}`,
    `Вопрос пользователя: ${input.question}`,
    `Corpus snapshot hash: ${input.retrieval.corpusSnapshot.corpusSnapshotHash}`,
    "Используй только этот компактный grounded context:",
    groundedContext,
    "Если прямой нормы недостаточно, честно скажи об ограничении в секции интерпретации.",
  ].join("\n\n");
}

function buildNoNormsAnswer() {
  const sections = {
    summary:
      "В текущей подтвержденной законодательной базе выбранного сервера релевантная норма по этому вопросу не найдена.",
    normativeAnalysis:
      "В текущем наборе подтвержденных primary laws выбранного сервера retrieval не нашел подходящих статей или иных блоков, на которые можно надежно опереться.",
    interpretation:
      "Я не могу добросовестно выводить ответ вне подтвержденного корпуса. Нужна либо более точная формулировка вопроса, либо подтверждение отсутствующей нормы в законодательной базе сервера.",
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
  const retrieval = await dependencies.searchCurrentLawCorpus({
    serverId: input.serverId,
    query: input.question,
    limit: 6,
  });
  const metadataBase = {
    serverId: input.serverId,
    serverCode: input.serverCode,
    serverName: input.serverName,
    corpusSnapshot: retrieval.corpusSnapshot,
    lawsUsed: buildLawsUsed(retrieval),
    references: buildGroundedReferences(retrieval),
  };

  if (retrieval.corpusSnapshot.currentVersionIds.length === 0) {
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
        corpusSnapshot: retrieval.corpusSnapshot,
      },
      errorMessage: "Для выбранного сервера нет confirmed current corpus.",
    });

    return {
      status: "no_corpus" as const,
      message: "Для выбранного сервера пока нет подтвержденного корпуса актуальных законов.",
      metadata: metadataBase,
    };
  }

  if (retrieval.resultCount === 0) {
    const fallbackAnswer = buildNoNormsAnswer();

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
        corpusSnapshot: retrieval.corpusSnapshot,
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
    corpusSnapshot: retrieval.corpusSnapshot,
    retrievalResults: retrieval.results.map((result) => ({
      lawKey: result.lawKey,
      lawVersionId: result.lawVersionId,
      lawBlockId: result.lawBlockId,
      blockType: result.blockType,
      articleNumberNormalized: result.articleNumberNormalized,
      sourceTopicUrl: result.sourceTopicUrl,
    })),
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
