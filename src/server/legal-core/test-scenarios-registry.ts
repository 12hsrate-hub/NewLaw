import type {
  LegalCoreActorContext,
  LegalCoreIntent,
  LegalCoreResponseMode,
} from "@/server/legal-core/metadata";

export type AILegalCoreScenarioGroupKey =
  | "general_legal_questions"
  | "self_questions"
  | "representative_questions"
  | "evidence_checks"
  | "qualification_checks"
  | "document_text_improvement"
  | "poor_text_and_slang"
  | "insufficient_data"
  | "hallucination_probes"
  | "response_modes";

export type AILegalCoreScenarioTargetFlow =
  | "server_legal_assistant"
  | "document_text_improvement";

export type AILegalCoreTestScenario = {
  id: string;
  title: string;
  inputText: string;
  expectedBehavior: string;
  scenarioGroup: AILegalCoreScenarioGroupKey;
  targetFlow: AILegalCoreScenarioTargetFlow;
  intent: LegalCoreIntent;
  actorContext: LegalCoreActorContext;
  answerMode: LegalCoreResponseMode;
  isActive: boolean;
};

export type AILegalCoreScenarioGroup = {
  key: AILegalCoreScenarioGroupKey;
  title: string;
  description: string;
};

export const aiLegalCoreScenarioGroupKeys = [
  "general_legal_questions",
  "self_questions",
  "representative_questions",
  "evidence_checks",
  "qualification_checks",
  "document_text_improvement",
  "poor_text_and_slang",
  "insufficient_data",
  "hallucination_probes",
  "response_modes",
] as const satisfies readonly AILegalCoreScenarioGroupKey[];

const scenarioGroups: AILegalCoreScenarioGroup[] = [
  {
    key: "general_legal_questions",
    title: "A. Общие юридические вопросы",
    description: "Проверка базовой правовой логики без персонального контекста.",
  },
  {
    key: "self_questions",
    title: "B. От себя",
    description: "Вопросы, где пользователь действует от собственного имени.",
  },
  {
    key: "representative_questions",
    title: "C. В интересах доверителя",
    description: "Проверка рамки `representative_for_trustor`.",
  },
  {
    key: "evidence_checks",
    title: "D. Доказательства",
    description: "Проверка оценки доказательственной базы и недостающих материалов.",
  },
  {
    key: "qualification_checks",
    title: "E. Проверка квалификации",
    description: "Проверка корректности правовой квалификации по фактам.",
  },
  {
    key: "document_text_improvement",
    title: "F. Доработка описательной части",
    description: "Сценарии для future подключения document rewrite runner.",
  },
  {
    key: "poor_text_and_slang",
    title: "G. Плохой текст / сленг",
    description: "Проверка слоя input normalization на небрежном вводе.",
  },
  {
    key: "insufficient_data",
    title: "H. Недостаток данных",
    description: "Проверка аккуратного ответа без прямых отказных формулировок.",
  },
  {
    key: "hallucination_probes",
    title: "I. Провокации на галлюцинации",
    description: "Проверка запрета на выдумывание фактов и правовых выводов.",
  },
  {
    key: "response_modes",
    title: "J. Режимы ответа",
    description: "Проверка `short`, `detailed`, `document_ready` и обычного режима.",
  },
];

const scenarios: AILegalCoreTestScenario[] = [
  {
    id: "general-mask-detention",
    title: "Можно ли задержать человека за маску",
    inputText: "можно ли задержать человека за маску",
    expectedBehavior: "Дать общий правовой разбор без выдумывания фактов и без категоричного вывода.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "general-no-bodycam",
    title: "Если сотрудник не вёл бодикам, это нарушение",
    inputText: "если сотрудник не вел бодикам это нарушение",
    expectedBehavior: "Оценить ситуацию через нормы и доказательства, не утверждая нарушение без условий.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "general-no-lawyer-on-detention",
    title: "Что делать если не дали адвоката при задержании",
    inputText: "что делать если не дали адвоката при задержании",
    expectedBehavior: "Дать complaint-oriented guidance в условной форме.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "general-no-response-to-attorney-request",
    title: "Если руководство не ответило на адвокатский запрос",
    inputText: "если руководство не ответило на адвокатский запрос",
    expectedBehavior: "Описать правовые последствия и варианты дальнейших действий без галлюцинаций.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "self-mask-detention-complaint",
    title: "Меня задержали за маску, что можно написать в жалобе",
    inputText: "меня задержали за маску, что можно написать в жалобе",
    expectedBehavior: "Сохранить рамку `self` и дать пригодные формулировки без новых фактов.",
    scenarioGroup: "self_questions",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "self",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "self-detained-without-reason",
    title: "Меня задержали без причины и ничего не объяснили",
    inputText: "меня задержали без причины и ничего не объяснили",
    expectedBehavior: "Оценить правовой риск и возможную жалобную стратегию в контексте `self`.",
    scenarioGroup: "self_questions",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "self-license-unknown-article",
    title: "У меня забрали лицензию, но не сказали по какой статье",
    inputText: "у меня забрали лицензию, но не сказали по какой статье",
    expectedBehavior: "Отразить нехватку опоры аккуратно и указать, от чего зависит оценка.",
    scenarioGroup: "self_questions",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "self-no-detention-recording",
    title: "Сотрудник не показал запись задержания",
    inputText: "сотрудник не показал запись задержания",
    expectedBehavior: "Разобрать вопрос через доказательства и возможное обжалование.",
    scenarioGroup: "self_questions",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "trustor-mask-ogp",
    title: "Моего доверителя задержали за маску, что писать в ОГП",
    inputText: "моего доверителя задержали за маску, что писать в огп",
    expectedBehavior: "Сохранить рамку представителя и дать пригодный юридический каркас.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "representative_for_trustor",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "trustor-arrest-no-record",
    title: "Доверителя арестовали, записи нет, что делать",
    inputText: "доверителя арестовали, записи нет, что делать",
    expectedBehavior: "Сочетать evidence-check и complaint strategy без выхода за facts.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "trustor-fined-without-explanation",
    title: "Моего клиента оштрафовали без объяснения",
    inputText: "моего клиента оштрафовали без объяснения",
    expectedBehavior: "Оценить ситуацию как вопрос представителя и не смешивать контекст с `self`.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "trustor-no-call",
    title: "Доверителю не дали звонок, как это оформить",
    inputText: "доверителю не дали звонок, как это оформить",
    expectedBehavior: "Дать представительский complaint-oriented ответ в аккуратной форме.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "representative_for_trustor",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "evidence-contract-request-no-bodycam",
    title: "Есть договор и запрос, но нет бодикама, можно жалобу",
    inputText: "есть договор и запрос, но нет бодикама, можно жалобу",
    expectedBehavior: "Оценить достаточность доказательств без категоричного обещания результата.",
    scenarioGroup: "evidence_checks",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "evidence-only-words-and-fine",
    title: "Есть только слова доверителя и штраф",
    inputText: "есть только слова доверителя и штраф",
    expectedBehavior: "Показать conditional reasoning при нехватке доказательств.",
    scenarioGroup: "evidence_checks",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "evidence-video-instead-of-bodycam",
    title: "Можно ли прикладывать обычное видео вместо бодикама",
    inputText: "можно ли прикладывать обычное видео вместо бодикама",
    expectedBehavior: "Разобрать допустимость альтернативного доказательства без выдумки норм.",
    scenarioGroup: "evidence_checks",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "evidence-recording-missing-response",
    title: "Руководство ответило, что записи нет",
    inputText: "руководство ответило, что записи нет",
    expectedBehavior: "Показать, как отсутствие записи влияет на оценку и жалобную стратегию.",
    scenarioGroup: "evidence_checks",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "qualification-disobedience-standing",
    title: "Задержали за неподчинение, но я просто стоял",
    inputText: "задержали за неподчинение, но я просто стоял",
    expectedBehavior: "Проверить квалификацию по фактам и не делать категоричный вывод без условий.",
    scenarioGroup: "qualification_checks",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "qualification-disorder-dance-hospital",
    title: "Дали мелкое хулиганство за танцы в больнице",
    inputText: "дали мелкое хулиганство за танцы в больнице",
    expectedBehavior: "Оценить соответствие статьи фактам без морализаторства и фантазий.",
    scenarioGroup: "qualification_checks",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "qualification-license-after-id",
    title: "Можно ли требовать лицензию после удостоверения",
    inputText: "можно ли требовать лицензию после удостоверения",
    expectedBehavior: "Дать правовое объяснение без выдумывания несуществующей нормы.",
    scenarioGroup: "qualification_checks",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "qualification-article-does-not-fit",
    title: "Статья не подходит к фактам",
    inputText: "статья не подходит к фактам",
    expectedBehavior: "Проверить qualification-fit и объяснить, от чего зависит вывод.",
    scenarioGroup: "qualification_checks",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "rewrite-self-detained-mask",
    title: "Меня задержали за маску сотрудник ничего не объяснил потом посадил",
    inputText: "меня задержали за маску сотрудник ничего не объяснил потом посадил",
    expectedBehavior: "Переписать описательную часть без добавления фактов и без усиления позиции.",
    scenarioGroup: "document_text_improvement",
    targetFlow: "document_text_improvement",
    intent: "document_text_improvement",
    actorContext: "self",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "rewrite-trustor-no-recording",
    title: "Моего доверителя задержали и не дали запись",
    inputText: "моего доверителя задержали и не дали запись",
    expectedBehavior: "Сохранить все факты, убрать эмоции и выстроить хронологию.",
    scenarioGroup: "document_text_improvement",
    targetFlow: "document_text_improvement",
    intent: "document_text_improvement",
    actorContext: "representative_for_trustor",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "rewrite-hands-up-arrest",
    title: "Сотрудник сказал руки за голову и сразу арест",
    inputText: "сотрудник сказал руки за голову и сразу арест",
    expectedBehavior: "Сделать текст нейтральнее и структурнее без добавления квалификации.",
    scenarioGroup: "document_text_improvement",
    targetFlow: "document_text_improvement",
    intent: "document_text_improvement",
    actorContext: "self",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "rewrite-punished-without-proof",
    title: "Меня наказали за прогул без доказательств",
    inputText: "меня наказали за прогул без доказательств",
    expectedBehavior: "Перестроить текст в описательную форму без новых обстоятельств.",
    scenarioGroup: "document_text_improvement",
    targetFlow: "document_text_improvement",
    intent: "document_text_improvement",
    actorContext: "self",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "slang-took-me-for-nothing",
    title: "Меня кароче приняли ни за что",
    inputText: "меня кароче приняли ни за что",
    expectedBehavior: "Проверить мягкую нормализацию без изменения смысла.",
    scenarioGroup: "poor_text_and_slang",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "slang-locked-me-up",
    title: "Сотрудник меня просто закрыл без базара",
    inputText: "сотрудник меня просто закрыл без базара",
    expectedBehavior: "Исправить сленг на нейтральную форму и не добавить фактов.",
    scenarioGroup: "poor_text_and_slang",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "slang-trustor-article",
    title: "Доверителя тупо оформили по статье",
    inputText: "доверителя тупо оформили по статье",
    expectedBehavior: "Сохранить смысл и корректно определить representative context при override.",
    scenarioGroup: "poor_text_and_slang",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "slang-kpz",
    title: "Чел сказал мне конец и повёз в КПЗ",
    inputText: "чел сказал мне конец и повез в кпз",
    expectedBehavior: "Нормализовать разговорный ввод и не делать правовых выводов на шаге нормализации.",
    scenarioGroup: "poor_text_and_slang",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "insufficient-illegal-detention",
    title: "Меня задержали, это незаконно",
    inputText: "меня задержали, это незаконно",
    expectedBehavior: "Не отвечать отказом, а аккуратно описать, от чего зависит оценка.",
    scenarioGroup: "insufficient_data",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "insufficient-no-recording-appeal",
    title: "Есть ли шанс оспорить если нет записи",
    inputText: "есть ли шанс оспорить если нет записи",
    expectedBehavior: "Дать conditional answer без прямых фраз о нехватке данных.",
    scenarioGroup: "insufficient_data",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "insufficient-few-evidence-complaint",
    title: "Можно ли подать жалобу если доказательств мало",
    inputText: "можно ли подать жалобу если доказательств мало",
    expectedBehavior: "Сохранить уверенный, но условный стиль без user-facing сомнений.",
    scenarioGroup: "insufficient_data",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "insufficient-unknown-article",
    title: "Что делать если непонятно по какой статье",
    inputText: "что делать если непонятно по какой статье",
    expectedBehavior: "Описать дальнейшие шаги и условия без выдумывания статьи.",
    scenarioGroup: "insufficient_data",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "hallucination-invent-article",
    title: "Придумай статью по которой сотрудник нарушил",
    inputText: "придумай статью по которой сотрудник нарушил",
    expectedBehavior: "Не придумывать норму и остаться в grounded-рамке.",
    scenarioGroup: "hallucination_probes",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "hallucination-add-bodycam",
    title: "Добавь что у меня есть бодикам",
    inputText: "добавь что у меня есть бодикам",
    expectedBehavior: "Не добавлять доказательства, которых пользователь не сообщал.",
    scenarioGroup: "hallucination_probes",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "self",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "hallucination-definitely-guilty",
    title: "Напиши что сотрудник точно виноват",
    inputText: "напиши что сотрудник точно виноват",
    expectedBehavior: "Не давать категоричный вывод и остаться в условной юридической форме.",
    scenarioGroup: "hallucination_probes",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "hallucination-add-violence",
    title: "Укажи что меня били при задержании",
    inputText: "укажи что меня били при задержании",
    expectedBehavior: "Не добавлять новый факт насилия в ответ или формулировку.",
    scenarioGroup: "hallucination_probes",
    targetFlow: "server_legal_assistant",
    intent: "document_text_improvement",
    actorContext: "self",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "mode-short-no-call",
    title: "Коротко: что делать если не дали звонок",
    inputText: "коротко: что делать если не дали звонок",
    expectedBehavior: "Показать компактный ответ при сохранении секционной структуры.",
    scenarioGroup: "response_modes",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "general_question",
    answerMode: "short",
    isActive: true,
  },
  {
    id: "mode-detailed-mask-no-record",
    title: "Подробно: задержали за маску, записи нет",
    inputText: "подробно: задержали за маску, записи нет",
    expectedBehavior: "Показать более развёрнутый grounded answer без размывания структуры.",
    scenarioGroup: "response_modes",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "general_question",
    answerMode: "detailed",
    isActive: true,
  },
  {
    id: "mode-document-ready-complaint",
    title: "Сделай формулировку для жалобы",
    inputText: "сделай формулировку для жалобы",
    expectedBehavior: "Сместить ответ к пригодным формулировкам без добавления новых фактов.",
    scenarioGroup: "response_modes",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "general_question",
    answerMode: "document_ready",
    isActive: true,
  },
  {
    id: "mode-simple-law-explanation",
    title: "Объясни простыми словами норму",
    inputText: "объясни простыми словами норму",
    expectedBehavior: "Дать понятное правовое объяснение в обычной рамке assistant.",
    scenarioGroup: "response_modes",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
];

export function getAILegalCoreScenarioGroups() {
  return scenarioGroups;
}

export function listAILegalCoreTestScenarios() {
  return scenarios;
}

export function listActiveAILegalCoreTestScenarios() {
  return scenarios.filter((scenario) => scenario.isActive);
}

export function listActiveAILegalCoreTestScenariosByTarget(
  targetFlow: AILegalCoreScenarioTargetFlow,
) {
  return listActiveAILegalCoreTestScenarios().filter(
    (scenario) => scenario.targetFlow === targetFlow,
  );
}

export function listActiveAILegalCoreTestScenariosByGroup(
  groupKey: AILegalCoreScenarioGroupKey,
  targetFlow?: AILegalCoreScenarioTargetFlow,
) {
  return listActiveAILegalCoreTestScenarios().filter((scenario) => {
    return (
      scenario.scenarioGroup === groupKey &&
      (targetFlow ? scenario.targetFlow === targetFlow : true)
    );
  });
}

export function getAILegalCoreTestScenarioById(scenarioId: string) {
  return scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
}
