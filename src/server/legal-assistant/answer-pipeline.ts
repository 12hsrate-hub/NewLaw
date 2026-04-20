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
  ].join("\n");
}

export function parseAssistantAnswerSections(content: string): AssistantAnswerSections {
  const normalizedContent = content.trim();
  const sectionPattern =
    /##\s*(Краткий вывод|Что прямо следует из норм|Вывод \/ интерпретация)\s*([\s\S]*?)(?=##\s*(?:Краткий вывод|Что прямо следует из норм|Вывод \/ интерпретация)|$)/g;
  const sectionMap = new Map<string, string>();

  for (const match of normalizedContent.matchAll(sectionPattern)) {
    sectionMap.set(match[1], match[2].trim());
  }

  if (sectionMap.size === 0) {
    return {
      summary: normalizedContent,
      normativeAnalysis: "Модель не вернула отдельную нормативную секцию в ожидаемом формате.",
      interpretation: "Модель не выделила интерпретацию отдельно. Нужна ручная перепроверка по использованным нормам.",
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
  };
}

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
    snippet: result.snippet,
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

function buildAssistantSystemPrompt() {
  return [
    "Ты — юридический помощник Lawyer5RP по подтвержденной законодательной базе выбранного сервера.",
    "Отвечай только по переданному корпусу current primary laws выбранного сервера.",
    "Не используй supplements, судебные прецеденты, общие знания или догадки вне корпуса.",
    "Если из нормы что-то не следует прямо, вынеси это только в секцию интерпретации.",
    "Никогда не выдавай интерпретацию как будто она прямо написана в законе.",
    "Верни ответ строго на русском языке и строго с тремя секциями markdown второго уровня:",
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
  const groundedContext = input.retrieval.results
    .map((result, index) => {
      const sourcePosts = result.sourcePosts
        .map((sourcePost) => `post#${sourcePost.postOrder} ${sourcePost.postUrl}`)
        .join("; ");

      return [
        `Источник ${index + 1}:`,
        `- law_key: ${result.lawKey}`,
        `- law_title: ${result.lawTitle}`,
        `- law_version_id: ${result.lawVersionId}`,
        `- law_block_id: ${result.lawBlockId}`,
        `- block_type: ${result.blockType}`,
        `- article_number_normalized: ${result.articleNumberNormalized ?? "n/a"}`,
        `- source_topic_url: ${result.sourceTopicUrl}`,
        `- source_posts: ${sourcePosts || "n/a"}`,
        `- block_text:`,
        result.blockText,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `Сервер: ${input.serverName}`,
    `Вопрос пользователя: ${input.question}`,
    `Corpus snapshot hash: ${input.retrieval.corpusSnapshot.corpusSnapshotHash}`,
    "Используй только эти подтвержденные нормы:",
    groundedContext,
    "Отдельно и явно разделяй прямое содержание норм и собственную интерпретацию.",
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
    return {
      status: "no_corpus" as const,
      message: "Для выбранного сервера пока нет подтвержденного корпуса актуальных законов.",
      metadata: metadataBase,
    };
  }

  if (retrieval.resultCount === 0) {
    const fallbackAnswer = buildNoNormsAnswer();

    return {
      status: "no_norms" as const,
      answerMarkdown: fallbackAnswer.answerMarkdown,
      sections: fallbackAnswer.sections,
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
    requestMetadata: proxyRequestPayload,
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

  const sections = parseAssistantAnswerSections(proxyResponse.content);
  const answerMarkdown = composeAssistantAnswerMarkdown(sections);

  return {
    status: "answered" as const,
    answerMarkdown,
    sections,
    metadata: metadataBase,
  };
}
