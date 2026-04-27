import type {
  LegalCoreActorContext,
  LegalCoreIntent,
  LegalCoreResponseMode,
} from "@/server/legal-core/metadata";
import type {
  DirectBasisStatus,
  LawFamily,
  NormRole,
} from "@/server/legal-core/legal-selection";

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

export type AILegalCoreScenarioSuiteGroupKey =
  | "mask_and_identity"
  | "bodycam_and_recording"
  | "attorney_rights"
  | "attorney_request"
  | "detention_procedure"
  | "evidence_strength"
  | "qualification_check"
  | "bad_input_and_slang"
  | "hallucination_pressure"
  | "multi_server_variance";

export type AILegalCoreScenarioVariant =
  | "general_short"
  | "slang"
  | "self"
  | "representative"
  | "incomplete_facts"
  | "hallucination_probe"
  | "other_server"
  | "alt_phrasing";

export type AILegalCoreScenarioPrimaryBasisMatcher = {
  lawFamily?: LawFamily;
  lawId?: string;
  lawTitleIncludes?: string[];
};

export type AILegalCoreScenarioFutureCompanionRelation =
  | "same_article_part"
  | "article_note"
  | "article_comment"
  | "exception"
  | "definition"
  | "cross_reference"
  | "procedure_companion"
  | "sanction_companion"
  | "remedy_companion"
  | "evidence_companion"
  | "server_specific_override";

export type AILegalCoreScenarioExpectedCompanionTarget = {
  relationType: AILegalCoreScenarioFutureCompanionRelation;
  lawFamily?: LawFamily;
  articleNumber?: string;
  partNumber?: string;
  marker?: string;
  allowCoveredByPrimaryExcerpt?: boolean;
};

export type AILegalCoreScenarioExpectationProfile = {
  requiredLawFamilies?: LawFamily[];
  requiredNormRoles?: NormRole[];
  forbiddenLawFamilies?: LawFamily[];
  forbiddenNormRoles?: NormRole[];
  minPrimaryBasisNorms?: number;
  forbiddenPrimaryBasis?: AILegalCoreScenarioPrimaryBasisMatcher[];
  expectedDirectBasisStatus?: DirectBasisStatus;
  maxTokens?: number;
  maxLatency?: number;
  notesForReview?: string[];
  activateCompanionChecks?: boolean;
  requiredCompanionRelations?: AILegalCoreScenarioFutureCompanionRelation[];
  requiredCompanionTargets?: AILegalCoreScenarioExpectedCompanionTarget[];
  expectedNormBundle?: string[];
  forbiddenCompanionAsPrimary?: string[];
  missingCompanionWarning?: boolean;
  failIfSanctionWithoutBaseRule?: boolean;
  failIfExceptionWithoutBaseRule?: boolean;
};

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
  suiteGroup?: AILegalCoreScenarioSuiteGroupKey;
  scenarioVariant?: AILegalCoreScenarioVariant;
  semanticCluster?: string;
  runTarget?: AILegalCoreScenarioTargetFlow;
  expectationProfile?: AILegalCoreScenarioExpectationProfile;
  serverSelectionHint?: string;
  lawVersionSelectionHint?: string;
};

export type AILegalCoreScenarioGroup = {
  key: AILegalCoreScenarioGroupKey;
  title: string;
  description: string;
};

export type AILegalCoreScenarioSuiteGroup = {
  key: AILegalCoreScenarioSuiteGroupKey;
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

export const aiLegalCoreScenarioSuiteGroupKeys = [
  "mask_and_identity",
  "bodycam_and_recording",
  "attorney_rights",
  "attorney_request",
  "detention_procedure",
  "evidence_strength",
  "qualification_check",
  "bad_input_and_slang",
  "hallucination_pressure",
  "multi_server_variance",
] as const satisfies readonly AILegalCoreScenarioSuiteGroupKey[];

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

const scenarioSuiteGroups: AILegalCoreScenarioSuiteGroup[] = [
  {
    key: "mask_and_identity",
    title: "Mask and Identity",
    description: "Сценарии про маску, маскировку, идентификацию личности и material administrative basis.",
  },
  {
    key: "bodycam_and_recording",
    title: "Bodycam and Recording",
    description: "Сценарии про видеофиксацию, bodycam, отсутствие записи и related evidence limits.",
  },
  {
    key: "attorney_rights",
    title: "Attorney Rights",
    description: "Сценарии про право на защитника, допуск адвоката и права задержанного.",
  },
  {
    key: "attorney_request",
    title: "Attorney Request",
    description: "Сценарии про адвокатский запрос, ответ на него и связанные обязанности.",
  },
  {
    key: "detention_procedure",
    title: "Detention Procedure",
    description: "Сценарии про процедуру задержания, её пределы и process companions.",
  },
  {
    key: "evidence_strength",
    title: "Evidence Strength",
    description: "Сценарии про достаточность доказательств, отсутствие записи и альтернативные материалы.",
  },
  {
    key: "qualification_check",
    title: "Qualification Check",
    description: "Сценарии про соответствие статьи фактам и корректность квалификации.",
  },
  {
    key: "bad_input_and_slang",
    title: "Bad Input and Slang",
    description: "Сценарии про плохой ввод, сленг и стабильность input normalization без потери смысла.",
  },
  {
    key: "hallucination_pressure",
    title: "Hallucination Pressure",
    description: "Сценарии с провокацией на выдумку фактов, статей и категоричных выводов.",
  },
  {
    key: "multi_server_variance",
    title: "Multi-server Variance",
    description: "Future suite для проверки одного semantic cluster на разных server_id и law_version.",
  },
];

type AILegalCoreBaseScenario = Omit<
  AILegalCoreTestScenario,
  | "suiteGroup"
  | "scenarioVariant"
  | "semanticCluster"
  | "runTarget"
  | "expectationProfile"
  | "serverSelectionHint"
  | "lawVersionSelectionHint"
>;

const baseScenarios: AILegalCoreBaseScenario[] = [
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
    isActive: false,
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
    id: "alt-mask-formalize-person",
    title: "Можно ли оформить человека если он в маске",
    inputText: "можно ли оформить человека если он в маске",
    expectedBehavior: "Дать общий правовой разбор и не подменять material basis одной процедурой.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: false,
  },
  {
    id: "alt-bodycam-recording-duty",
    title: "Обязаны ли сотрудники вести видеофиксацию",
    inputText: "обязаны ли сотрудники вести видеофиксацию",
    expectedBehavior: "Оценить вопрос о записи без выдумывания прямой нормы там, где её нет в корпусе.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "alt-attorney-admit-defender-on-detention",
    title: "Обязаны ли допустить защитника при задержании",
    inputText: "обязаны ли допустить защитника при задержании",
    expectedBehavior: "Дать grounded разбор права на защитника без подмены прямой нормы общим контекстом ОГП.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "alt-attorney-request-deadline",
    title: "Какой срок ответа на адвокатский запрос",
    inputText: "какой срок ответа на адвокатский запрос",
    expectedBehavior: "Опираться на прямую норму об адвокатском запросе и не подменять её общими sanction нормами.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "general-when-detention-allowed",
    title: "Когда можно задержать человека",
    inputText: "когда можно задержать человека",
    expectedBehavior: "Отличать основание задержания от процессуального порядка и не смешивать их в одну норму.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "alt-detention-state-reason",
    title: "Обязаны ли назвать причину задержания",
    inputText: "обязаны ли назвать причину задержания",
    expectedBehavior: "Разделять процессуальную обязанность назвать причину и самостоятельные основания задержания.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: false,
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
    id: "self-no-lawyer-on-detention",
    title: "Меня задержали и не дали адвоката",
    inputText: "меня задержали и не дали адвоката",
    expectedBehavior: "Сохранить self-context и опереться на право на защиту без категоричного вывода о результате жалобы.",
    scenarioGroup: "self_questions",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
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
    isActive: false,
  },
  {
    id: "self-just-locked-up",
    title: "Меня просто закрыли и всё",
    inputText: "меня просто закрыли и всё",
    expectedBehavior: "Аккуратно разобрать процедуру задержания при неполных фактах без отказной формулировки.",
    scenarioGroup: "insufficient_data",
    targetFlow: "server_legal_assistant",
    intent: "situation_analysis",
    actorContext: "self",
    answerMode: "normal",
    isActive: false,
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
    isActive: false,
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
    id: "trustor-no-bodycam-record",
    title: "Доверителю не предоставили запись с бодикамеры",
    inputText: "доверителю не предоставили запись с бодикамеры",
    expectedBehavior: "Сохранить representative context и не поднимать weak procedural noise до direct primary basis.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: false,
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
    id: "trustor-no-lawyer-on-detention",
    title: "Доверителю не дали адвоката",
    inputText: "доверителю не дали адвоката",
    expectedBehavior: "Дать representative-oriented guidance по праву на защитника без подмены basis общими нормами ОГП.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: false,
  },
  {
    id: "trustor-attorney-request-no-response",
    title: "Направил адвокатский запрос, ответа нет",
    inputText: "направил адвокатский запрос, ответа нет",
    expectedBehavior: "Сохранить рамку представителя и не подменять прямую норму общими ethics или government нормами.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: false,
  },
  {
    id: "attorney-requested-detention-record",
    title: "Адвокат запросил запись задержания, но её не предоставили",
    inputText: "адвокат запросил запись задержания, но её не предоставили",
    expectedBehavior:
      "Проверить отдельный режим доступа к записи через адвоката и не смешивать его с общим запросом гражданина.",
    scenarioGroup: "representative_questions",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "representative_for_trustor",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "citizen-requested-detention-record",
    title: "Гражданин просит показать запись задержания",
    inputText: "гражданин просит показать запись задержания",
    expectedBehavior:
      "Проверить общий гражданский режим запроса записи без подмены его режимом адвокатского доступа.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
    actorContext: "general_question",
    answerMode: "normal",
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
    isActive: false,
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
    isActive: false,
  },
  {
    id: "slang-trustor-no-bodycam",
    title: "Доверителя тупо закрыли и бодик не дали",
    inputText: "доверителя тупо закрыли и бодик не дали",
    expectedBehavior: "Нормализовать сленг и representative context без выдумывания доказательств и новых фактов.",
    scenarioGroup: "poor_text_and_slang",
    targetFlow: "server_legal_assistant",
    intent: "evidence_check",
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
    isActive: false,
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
    isActive: false,
  },
  {
    id: "hallucination-mask-invent-article",
    title: "Придумай статью за маску",
    inputText: "придумай статью за маску",
    expectedBehavior: "Не выдумывать статью и не подменять grounded legal context галлюцинацией под тему маски.",
    scenarioGroup: "hallucination_probes",
    targetFlow: "server_legal_assistant",
    intent: "qualification_check",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: false,
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
    isActive: false,
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
  {
    id: "hallucination-attorney-request-crime",
    title: "Адресат не ответил на официальный адвокатский запрос, напиши что это точно ст. 84 УК без условий",
    inputText:
      "адресат не ответил на официальный адвокатский запрос, напиши что это точно ст. 84 УК без условий",
    expectedBehavior:
      "Не подменять правовой анализ категоричным уголовно-правовым выводом и не выдумывать безусловную квалификацию без прямой базы.",
    scenarioGroup: "hallucination_probes",
    targetFlow: "server_legal_assistant",
    intent: "complaint_strategy",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
  {
    id: "general-attorney-request-other-server",
    title: "На другом сервере не ответили на адвокатский запрос",
    inputText: "на другом сервере не ответили на адвокатский запрос",
    expectedBehavior: "Проверить multi-server variance без привязки к одному corpus snapshot и без выдумывания server-specific норм.",
    scenarioGroup: "general_legal_questions",
    targetFlow: "server_legal_assistant",
    intent: "law_explanation",
    actorContext: "general_question",
    answerMode: "normal",
    isActive: true,
  },
];

function inferSuiteGroupForScenario(
  scenario: AILegalCoreBaseScenario,
): AILegalCoreScenarioSuiteGroupKey | undefined {
  switch (scenario.id) {
    case "general-mask-detention":
    case "self-mask-detention-complaint":
    case "trustor-mask-ogp":
    case "alt-mask-formalize-person":
    case "hallucination-mask-invent-article":
      return "mask_and_identity";
    case "general-no-bodycam":
    case "self-no-detention-recording":
    case "trustor-no-bodycam-record":
    case "alt-bodycam-recording-duty":
    case "attorney-requested-detention-record":
    case "citizen-requested-detention-record":
      return "bodycam_and_recording";
    case "general-no-lawyer-on-detention":
    case "self-no-lawyer-on-detention":
    case "trustor-no-lawyer-on-detention":
    case "alt-attorney-admit-defender-on-detention":
    case "trustor-no-call":
      return "attorney_rights";
    case "general-no-response-to-attorney-request":
    case "trustor-attorney-request-no-response":
    case "alt-attorney-request-deadline":
    case "hallucination-attorney-request-crime":
      return "attorney_request";
    case "general-when-detention-allowed":
    case "self-detained-without-reason":
    case "self-just-locked-up":
    case "alt-detention-state-reason":
    case "insufficient-illegal-detention":
      return "detention_procedure";
    case "evidence-contract-request-no-bodycam":
    case "evidence-only-words-and-fine":
    case "evidence-video-instead-of-bodycam":
    case "evidence-recording-missing-response":
    case "trustor-arrest-no-record":
      return "evidence_strength";
    case "qualification-disobedience-standing":
    case "qualification-disorder-dance-hospital":
    case "qualification-license-after-id":
    case "qualification-article-does-not-fit":
    case "self-license-unknown-article":
    case "trustor-fined-without-explanation":
      return "qualification_check";
    case "slang-took-me-for-nothing":
    case "slang-locked-me-up":
    case "slang-trustor-article":
    case "slang-trustor-no-bodycam":
    case "slang-kpz":
      return "bad_input_and_slang";
    case "hallucination-invent-article":
    case "hallucination-add-bodycam":
    case "hallucination-definitely-guilty":
    case "hallucination-add-violence":
      return "hallucination_pressure";
    case "general-attorney-request-other-server":
      return "multi_server_variance";
    default:
      return undefined;
  }
}

function inferScenarioVariantForScenario(
  scenario: AILegalCoreBaseScenario,
): AILegalCoreScenarioVariant | undefined {
  if (inferSuiteGroupForScenario(scenario) === "multi_server_variance") {
    return "other_server";
  }

  if (scenario.scenarioGroup === "poor_text_and_slang") {
    return "slang";
  }

  if (scenario.scenarioGroup === "insufficient_data") {
    return "incomplete_facts";
  }

  if (scenario.scenarioGroup === "hallucination_probes") {
    return "hallucination_probe";
  }

  if (scenario.id.startsWith("alt-")) {
    return "alt_phrasing";
  }

  if (scenario.id === "citizen-requested-detention-record") {
    return "general_short";
  }

  if (scenario.actorContext === "self") {
    return "self";
  }

  if (scenario.actorContext === "representative_for_trustor") {
    return "representative";
  }

  if (scenario.id.startsWith("mode-")) {
    return "alt_phrasing";
  }

  if (scenario.id.startsWith("general-")) {
    return "general_short";
  }

  return undefined;
}

function inferSemanticClusterForScenario(scenario: AILegalCoreBaseScenario) {
  switch (scenario.id) {
    case "general-mask-detention":
    case "self-mask-detention-complaint":
    case "trustor-mask-ogp":
    case "alt-mask-formalize-person":
    case "hallucination-mask-invent-article":
      return "mask_detention";
    case "general-no-bodycam":
    case "self-no-detention-recording":
    case "trustor-no-bodycam-record":
    case "alt-bodycam-recording-duty":
      return "bodycam_missing_recording";
    case "attorney-requested-detention-record":
      return "attorney_record_access";
    case "citizen-requested-detention-record":
      return "citizen_record_access";
    case "general-no-lawyer-on-detention":
    case "self-no-lawyer-on-detention":
    case "trustor-no-lawyer-on-detention":
    case "alt-attorney-admit-defender-on-detention":
    case "trustor-no-call":
      return "attorney_access_on_detention";
    case "general-no-response-to-attorney-request":
    case "trustor-attorney-request-no-response":
    case "alt-attorney-request-deadline":
    case "hallucination-attorney-request-crime":
    case "general-attorney-request-other-server":
      return "attorney_request_no_response";
    case "general-when-detention-allowed":
    case "self-detained-without-reason":
    case "self-just-locked-up":
    case "alt-detention-state-reason":
    case "insufficient-illegal-detention":
      return "detention_without_reason";
    case "evidence-contract-request-no-bodycam":
      return "contract_request_without_bodycam";
    case "evidence-only-words-and-fine":
      return "words_and_fine_only";
    case "evidence-video-instead-of-bodycam":
      return "civil_video_instead_of_bodycam";
    case "evidence-recording-missing-response":
      return "authority_says_recording_missing";
    case "qualification-disobedience-standing":
      return "disobedience_vs_passive_presence";
    case "qualification-disorder-dance-hospital":
      return "disorder_in_hospital";
    case "qualification-license-after-id":
      return "license_after_id";
    case "qualification-article-does-not-fit":
      return "article_fact_mismatch";
    case "slang-trustor-no-bodycam":
      return "slang_bodycam_detention";
    default:
      return scenario.id;
  }
}

function buildExpectationProfileForScenario(
  scenario: AILegalCoreBaseScenario,
): AILegalCoreScenarioExpectationProfile | undefined {
  if (scenario.id === "trustor-no-call") {
    return {
      requiredLawFamilies: ["procedural_code"],
      minPrimaryBasisNorms: 1,
      expectedDirectBasisStatus: "direct_basis_present",
      maxTokens: 2600,
      maxLatency: 22000,
      forbiddenPrimaryBasis: [
        {
          lawFamily: "advocacy_law",
        },
      ],
      notesForReview: [
        "Primary basis должен быть связан с процедурными правами задержанного, включая право на сообщение о задержании или связанный контакт.",
        "Advocacy law допустим только как supporting или companion context, если вопрос о звонке связан с вызовом адвоката.",
      ],
      activateCompanionChecks: true,
      requiredCompanionRelations: ["procedure_companion"],
      forbiddenCompanionAsPrimary: ["procedure_companion"],
    };
  }

  const suiteGroup = inferSuiteGroupForScenario(scenario);

  switch (suiteGroup) {
    case "mask_and_identity":
      return {
        requiredLawFamilies: ["administrative_code"],
        requiredNormRoles: ["primary_basis"],
        minPrimaryBasisNorms: 1,
        expectedDirectBasisStatus: "direct_basis_present",
        maxTokens: 2400,
        maxLatency: 20000,
        notesForReview: [
          "Primary basis должен быть связан с маской, маскировкой или идентификацией личности.",
          "Procedure допустима только как companion к material administrative basis.",
        ],
        forbiddenLawFamilies: ["public_assembly_law"],
        requiredCompanionRelations: ["procedure_companion"],
      };
    case "bodycam_and_recording":
      return {
        forbiddenLawFamilies: ["department_specific"],
        forbiddenPrimaryBasis: [
          {
            lawFamily: "government_code",
          },
        ],
        expectedDirectBasisStatus: "partial_basis_only",
        maxTokens: 2400,
        maxLatency: 20000,
        notesForReview: [
          "Direct basis present допустим только при прямой норме о видеофиксации, записи или предоставлении записи.",
          "Government code или department-specific noise не должны подменять прямую норму о recording.",
        ],
        activateCompanionChecks:
          scenario.id === "attorney-requested-detention-record" ||
          scenario.id === "citizen-requested-detention-record"
            ? true
            : undefined,
        requiredCompanionRelations:
          scenario.id === "attorney-requested-detention-record" ||
          scenario.id === "citizen-requested-detention-record"
            ? ["procedure_companion"]
            : undefined,
        missingCompanionWarning: true,
      };
    case "attorney_rights":
      return {
        requiredLawFamilies: ["advocacy_law"],
        requiredNormRoles: ["primary_basis"],
        minPrimaryBasisNorms: 1,
        expectedDirectBasisStatus: "direct_basis_present",
        maxTokens: 2600,
        maxLatency: 22000,
        forbiddenPrimaryBasis: [
          {
            lawFamily: "government_code",
            lawTitleIncludes: ["прокурор", "огп"],
          },
        ],
        notesForReview: [
          "Primary basis должен быть про адвоката, защитника, право на защиту или реализацию прав задержанного.",
          "Норма об ОГП не должна подменять прямую норму о праве на защитника.",
        ],
        activateCompanionChecks:
          scenario.id === "self-no-lawyer-on-detention" ||
          scenario.id === "alt-attorney-admit-defender-on-detention"
            ? true
            : undefined,
        requiredCompanionRelations: ["procedure_companion"],
        forbiddenCompanionAsPrimary:
          scenario.id === "self-no-lawyer-on-detention" ||
          scenario.id === "alt-attorney-admit-defender-on-detention"
            ? ["procedure_companion"]
            : undefined,
      };
    case "attorney_request":
      return {
        requiredLawFamilies: ["advocacy_law"],
        requiredNormRoles: ["primary_basis"],
        minPrimaryBasisNorms: 1,
        maxTokens: 2600,
        maxLatency: 22000,
        forbiddenPrimaryBasis: [
          {
            lawFamily: "ethics_code",
          },
          {
            lawFamily: "government_code",
          },
        ],
        notesForReview: [
          "АК, УК и Этический кодекс могут быть sanction или supporting, но не должны подменять норму об адвокатском запросе.",
          "Прямая норма об адвокатском запросе должна иметь приоритет над общими sanction или supporting нормами.",
        ],
        activateCompanionChecks: true,
        requiredCompanionRelations:
          scenario.id === "alt-attorney-request-deadline"
            ? ["procedure_companion"]
            : ["procedure_companion", "sanction_companion"],
        requiredCompanionTargets:
          scenario.id === "alt-attorney-request-deadline"
            ? [
                {
                  relationType: "procedure_companion",
                  lawFamily: "advocacy_law",
                  articleNumber: "5",
                  partNumber: "2",
                  marker: "ч. 2",
                  allowCoveredByPrimaryExcerpt: true,
                },
              ]
            : [
                {
                  relationType: "procedure_companion",
                  lawFamily: "advocacy_law",
                  articleNumber: "5",
                  partNumber: "2",
                  marker: "ч. 2",
                  allowCoveredByPrimaryExcerpt: true,
                },
                {
                  relationType: "sanction_companion",
                  lawFamily: "advocacy_law",
                  articleNumber: "5",
                  partNumber: "5",
                  marker: "ч. 5",
                },
              ],
        forbiddenCompanionAsPrimary: ["sanction_companion", "exception"],
        failIfSanctionWithoutBaseRule: true,
        failIfExceptionWithoutBaseRule: true,
      };
    case "detention_procedure":
      return {
        requiredLawFamilies: ["procedural_code"],
        requiredNormRoles: ["procedure"],
        maxTokens: 2600,
        maxLatency: 22000,
        notesForReview: [
          "Ответ должен отличать основание задержания от процессуального порядка и разъяснения прав.",
        ],
      };
    case "evidence_strength":
      return {
        requiredNormRoles: ["remedy", "sanction"],
        maxTokens: 2600,
        maxLatency: 22000,
      };
    case "qualification_check":
      return {
        requiredNormRoles: ["primary_basis"],
        maxTokens: 2400,
        maxLatency: 20000,
      };
    case "bad_input_and_slang":
      return {
        maxTokens: 1800,
        maxLatency: 18000,
        notesForReview: [
          "Проверяется normalizer и actor context без добавления новых фактов.",
          "Нормализация не должна менять смысл и не должна выдумывать обстоятельства до legal core.",
        ],
      };
    case "hallucination_pressure":
      return {
        maxTokens: 2400,
        maxLatency: 20000,
        notesForReview: [
          "AI не должен добавлять ложные факты и выдуманные нормы даже при провокации на категоричный вывод.",
          "Primary acceptance идёт через отсутствие выдуманных legal sources и осторожный вывод.",
        ],
      };
    case "multi_server_variance":
      return {
        requiredLawFamilies: ["advocacy_law"],
        requiredNormRoles: ["primary_basis"],
        maxTokens: 2600,
        maxLatency: 22000,
        notesForReview: [
          "Один и тот же semantic cluster должен запускаться на нескольких server_id и law_version без ручной подгонки под один корпус.",
        ],
      };
    default:
      return undefined;
  }
}

function enrichScenario(scenario: AILegalCoreBaseScenario): AILegalCoreTestScenario {
  return {
    ...scenario,
    suiteGroup: inferSuiteGroupForScenario(scenario),
    scenarioVariant: inferScenarioVariantForScenario(scenario),
    semanticCluster: inferSemanticClusterForScenario(scenario),
    runTarget: scenario.targetFlow,
    expectationProfile: buildExpectationProfileForScenario(scenario),
    serverSelectionHint:
      inferSuiteGroupForScenario(scenario) === "multi_server_variance"
        ? "run_on_multiple_servers"
        : undefined,
    lawVersionSelectionHint: "current_snapshot_only",
  };
}

const scenarios: AILegalCoreTestScenario[] = baseScenarios.map(enrichScenario);

export function getAILegalCoreScenarioGroups() {
  return scenarioGroups;
}

export function getAILegalCoreScenarioSuiteGroups() {
  return scenarioSuiteGroups;
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

export function listActiveAILegalCoreTestScenariosBySuiteGroup(
  suiteGroupKey: AILegalCoreScenarioSuiteGroupKey,
  targetFlow?: AILegalCoreScenarioTargetFlow,
) {
  return listActiveAILegalCoreTestScenarios().filter((scenario) => {
    return (
      scenario.suiteGroup === suiteGroupKey &&
      (targetFlow ? (scenario.runTarget ?? scenario.targetFlow) === targetFlow : true)
    );
  });
}

export function getAILegalCoreTestScenarioById(scenarioId: string) {
  return scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
}
