import { listAssistantServers } from "@/db/repositories/server.repository";
import {
  legalCoreActorContexts,
  legalCoreResponseModes,
} from "@/server/legal-core/metadata";
import {
  getAILegalCoreScenarioGroups,
  listActiveAILegalCoreTestScenariosByGroup,
} from "@/server/legal-core/test-scenarios-registry";

export type InternalAILegalCorePageContext = {
  servers: Array<{
    id: string;
    code: string;
    name: string;
    hasUsableAssistantCorpus: boolean;
    currentPrimaryLawCount: number;
    currentPrecedentCount: number;
  }>;
  lawVersionOptions: Array<{
    value: "current_snapshot_only";
    label: string;
    description: string;
  }>;
  actorContextOptions: Array<{
    value: (typeof legalCoreActorContexts)[number];
    label: string;
    description: string;
  }>;
  answerModeOptions: Array<{
    value: (typeof legalCoreResponseModes)[number];
    label: string;
    description: string;
  }>;
  scenarioGroups: Array<{
    key: ReturnType<typeof getAILegalCoreScenarioGroups>[number]["key"];
    title: string;
    description: string;
    scenarioCount: number;
    runMode: "available_now" | "planned_follow_up";
        scenarios: Array<{
          id: string;
          title: string;
          inputText: string;
          expectedBehavior: string;
          intent: string;
          actorContext: string;
          answerMode: string;
          targetFlow: string;
        }>;
      }>;
  implementationNotes: string[];
};

export async function getInternalAILegalCorePageContext(): Promise<InternalAILegalCorePageContext> {
  const servers = await listAssistantServers();

  return {
    servers: servers
      .filter((server) => server.hasUsableAssistantCorpus)
      .map((server) => ({
        id: server.id,
        code: server.code,
        name: server.name,
        hasUsableAssistantCorpus: server.hasUsableAssistantCorpus,
        currentPrimaryLawCount: server.currentPrimaryLawCount,
        currentPrecedentCount: server.currentPrecedentCount,
      })),
    lawVersionOptions: [
      {
        value: "current_snapshot_only",
        label: "Текущий current snapshot",
        description:
          "Первый implementation slice честно работает только по текущему подтверждённому срезу законодательства сервера.",
      },
    ],
    actorContextOptions: [
      {
        value: "general_question",
        label: "Общий вопрос",
        description: "Нейтральный вопрос без личной или представительской рамки.",
      },
      {
        value: "self",
        label: "От себя",
        description: "Пользователь действует от собственного имени.",
      },
      {
        value: "representative_for_trustor",
        label: "В интересах доверителя",
        description: "Пользователь действует как представитель доверителя.",
      },
    ],
    answerModeOptions: [
      {
        value: "short",
        label: "Short",
        description: "Сжатый ответ без лишнего расширения.",
      },
      {
        value: "normal",
        label: "Normal",
        description: "Обычная глубина ответа по умолчанию.",
      },
      {
        value: "detailed",
        label: "Detailed",
        description: "Более развёрнутый правовой разбор.",
      },
      {
        value: "document_ready",
        label: "Document ready",
        description: "С акцентом на готовые формулировки.",
      },
    ],
    scenarioGroups: getAILegalCoreScenarioGroups().map((group) => {
      return {
        key: group.key,
        title: group.title,
        description: group.description,
        scenarioCount:
          listActiveAILegalCoreTestScenariosByGroup(group.key).length,
        runMode:
          listActiveAILegalCoreTestScenariosByGroup(group.key).length > 0
            ? "available_now"
            : "planned_follow_up",
        scenarios: listActiveAILegalCoreTestScenariosByGroup(group.key).map((scenario) => ({
          id: scenario.id,
          title: scenario.title,
          inputText: scenario.inputText,
          expectedBehavior: scenario.expectedBehavior,
          intent: scenario.intent,
          actorContext: scenario.actorContext,
          answerMode: scenario.answerMode,
          targetFlow: scenario.targetFlow,
        })),
      };
    }),
    implementationNotes: [
      "Internal contour теперь поддерживает два полезных target flow: `server legal assistant` и `document_text_improvement`.",
      "Сценарии `document_text_improvement` идут через компактный internal rewrite runner без привязки к реальному document draft, но с теми же legal-core guardrails, self-assessment и hidden routing в шаг `17`.",
      "Повторный запуск того же сценария уже можно сравнивать в режиме `до/после` по последним сохранённым `AIRequest`, без отдельной БД для временной истории test runs.",
      "Поле law_version пока честно ограничено режимом `current_snapshot_only`, потому что retrieval уже работает по текущему подтверждённому snapshot сервера.",
    ],
  };
}
