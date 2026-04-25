export type AIConfirmedIssueStatus =
  | "confirmed_followup_required"
  | "fix_in_progress"
  | "regression_ready"
  | "closed";

export type AIConfirmedIssueLifecycleEntry = {
  status: AIConfirmedIssueStatus;
  rationale: string;
};

export type AIConfirmedIssueTransition = {
  toStatus: AIConfirmedIssueStatus;
  label: string;
  blockedBy: string[];
};

export type AIConfirmedIssue = {
  issueId: string;
  title: string;
  status: AIConfirmedIssueStatus;
  featureScope: string[];
  rootCause: string;
  fixTarget: string | null;
  linkedRuleIds: string[];
  issueFingerprintExample: string;
  issueClusterKeyExample: string;
  sourceOfTruth: string;
  summary: string;
  lifecycle: {
    statusHistory: AIConfirmedIssueLifecycleEntry[];
    allowedTransitions: AIConfirmedIssueTransition[];
    closureGuards: string[];
  };
  closureDecision: {
    state: "not_ready" | "ready_for_manual_close" | "closed";
    summary: string;
    requiredArtifacts: string[];
    reopenPolicy: string;
  };
  fixInstructionSnapshot: {
    whatAIDidWrong: string;
    correctFutureBehavior: string;
    badExample: string;
    goodExample: string;
    codexInstruction: string;
    regressionExpectation: string;
  };
  regressionFollowUp: {
    status: "test_required" | "test_not_required_with_justification" | "test_implemented";
    artifact: string;
    justification: string | null;
  };
};

const AI_CONFIRMED_ISSUES_REGISTRY: AIConfirmedIssue[] = [
  {
    issueId: "confirmed-normalization-meaning-shift-v1",
    title: "Нормализация не должна усиливать юридический смысл исходного ввода",
    status: "fix_in_progress",
    featureScope: ["server_legal_assistant", "document_text_improvement"],
    rootCause: "normalization_issue",
    fixTarget: "normalization_guardrail",
    linkedRuleIds: ["normalization_preserves_meaning_v1"],
    issueFingerprintExample:
      "8f2e4a2fd0872f6cf1e556904ad3b5705d10f2a8651eb4b65ca5ef0a2d29ee10",
    issueClusterKeyExample: "3e0f8d6f6acfe1bc5c87",
    sourceOfTruth: "step_17_ai_quality_review",
    summary:
      "Подтверждён класс ошибок, где normalization превращает бытовую или неуверенную формулировку в более сильное правовое утверждение.",
    lifecycle: {
      statusHistory: [
        {
          status: "confirmed_followup_required",
          rationale: "Кейс подтверждён review-контуром и требует инженерного follow-up.",
        },
        {
          status: "fix_in_progress",
          rationale: "Для класса ошибок уже зафиксирован fix_instruction, но regression gate ещё не закрыт.",
        },
      ],
      allowedTransitions: [
        {
          toStatus: "regression_ready",
          label: "Перевести в regression_ready",
          blockedBy: [
            "Нужен regression test или явное обоснование, почему тест не требуется.",
            "Нужна привязка к rule и готовый инженерный follow-up.",
          ],
        },
      ],
      closureGuards: [
        "Кейс не может перейти в closed напрямую из fix_in_progress.",
        "Нужен пройденный regression gate.",
      ],
    },
    closureDecision: {
      state: "not_ready",
      summary:
        "До закрытия кейс должен пройти через regression_ready и получить явное review decision после обновления guardrails и tests.",
      requiredArtifacts: [
        "fix_instruction",
        "linked behavior rule",
        "regression test или обоснование отсутствия теста",
      ],
      reopenPolicy:
        "Если normalization снова меняет смысл, issue не редактируется задним числом, а переводится в новый review cycle отдельным коммитом и review update.",
    },
    fixInstructionSnapshot: {
      whatAIDidWrong:
        "Нормализация добавляет правовой оттенок или смысловой сдвиг, которого не было в raw_input.",
      correctFutureBehavior:
        "Нормализация исправляет только форму: орфографию, пунктуацию и шумовые элементы без усиления позиции пользователя.",
      badExample:
        "raw_input: \"меня вроде незаконно уволили\" -> normalized_input: \"Меня незаконно уволили.\"",
      goodExample:
        "raw_input: \"меня вроде незаконно уволили\" -> normalized_input: \"Меня, возможно, уволили незаконно.\"",
      codexInstruction:
        "Усилить normalization guardrails и regression checks на meaning-preservation до intent detection и generation.",
      regressionExpectation:
        "Regression test должен ловить случаи, где normalized_input усиливает raw_input без новых фактов.",
    },
    regressionFollowUp: {
      status: "test_required",
      artifact: "src/server/legal-core/input-normalization.test.ts",
      justification: null,
    },
  },
  {
    issueId: "confirmed-law-version-boundary-v1",
    title: "AI не должен выходить за current snapshot выбранного сервера",
    status: "regression_ready",
    featureScope: [
      "server_legal_assistant",
      "document_text_improvement",
      "grounded_document_rewrite",
    ],
    rootCause: "law_basis_issue",
    fixTarget: null,
    linkedRuleIds: ["selected_server_law_only_v1"],
    issueFingerprintExample:
      "6c9f0c8f1d3f4fa4ee8f28e6b26cf4d1ba4fa4d4aa5c1c8d03b87f39d12a66f3",
    issueClusterKeyExample: "0f92d734d3d6d38dcb0e",
    sourceOfTruth: "step_16_ai_legal_core + step_17_ai_quality_review",
    summary:
      "Подтверждён класс проблем, где retrieval или final answer пытается опереться на law_version вне current snapshot выбранного сервера.",
    lifecycle: {
      statusHistory: [
        {
          status: "confirmed_followup_required",
          rationale: "Класс проблемы подтверждён как отдельный review issue.",
        },
        {
          status: "fix_in_progress",
          rationale: "Legal core усилен и кейс переведён в инженерную доработку.",
        },
        {
          status: "regression_ready",
          rationale: "Regression tests уже покрывают класс нарушения, остаётся только ручное closure decision.",
        },
      ],
      allowedTransitions: [
        {
          toStatus: "closed",
          label: "Перевести в closed",
          blockedBy: [
            "Нужно убедиться, что regression coverage остаётся актуальным после следующих prompt/code changes.",
          ],
        },
      ],
      closureGuards: [
        "Закрытие допустимо только после regression-ready состояния.",
        "Rule linkage и regression artifact должны оставаться актуальными.",
      ],
    },
    closureDecision: {
      state: "ready_for_manual_close",
      summary:
        "Кейс может быть закрыт вручную, потому что regression coverage уже есть и rule linkage подтверждён.",
      requiredArtifacts: [
        "актуальный regression artifact",
        "подтверждённый rule linkage",
        "manual closure decision в review workflow",
      ],
      reopenPolicy:
        "Если появится новый mixed-version случай, issue должен быть reopened новым review решением и новым engineering follow-up.",
    },
    fixInstructionSnapshot: {
      whatAIDidWrong:
        "AI использует или ссылается на источник вне current snapshot, даже если legal core зафиксировал ограничение по server_id + law_version.",
      correctFutureBehavior:
        "Любая AI-выдача должна оставаться внутри confirmed current corpus выбранного сервера и помечать нарушение как review case.",
      badExample:
        "Ответ ссылается на legacy law_version, которого нет в current snapshot выбранного сервера.",
      goodExample:
        "Ответ использует только sources из current snapshot и при проблеме уходит в review queue без авто-исправления.",
      codexInstruction:
        "Сохранять и проверять law_version_contract во всех AI-flow и не ослаблять future-review markers на mixed-version случаях.",
      regressionExpectation:
        "Regression test должен подтверждать, что law_version_contract_violation не проходит незамеченным.",
    },
    regressionFollowUp: {
      status: "test_implemented",
      artifact:
        "src/server/legal-assistant/answer-pipeline.test.ts + src/server/document-ai/*.test.ts",
      justification: null,
    },
  },
  {
    issueId: "confirmed-descriptive-rewrite-fact-drift-v1",
    title: "AI-доработка описательной части не должна смещать фактологический каркас",
    status: "closed",
    featureScope: ["document_text_improvement", "grounded_document_rewrite"],
    rootCause: "generation_issue",
    fixTarget: null,
    linkedRuleIds: ["descriptive_rewrite_never_adds_facts_v1"],
    issueFingerprintExample:
      "35b7db7f0cd4afdadad3d56253eabce3db7f53258d09d5fa4c2914c85816e449",
    issueClusterKeyExample: "4e0fc7f619a0af8bf6c0",
    sourceOfTruth: "step_16_fact_ledger + step_17_ai_quality_review",
    summary:
      "Класс проблем с фактическим дрейфом в descriptive rewrite уже закреплён в правилах и regression coverage, поэтому может считаться закрытым на текущем repo-state.",
    lifecycle: {
      statusHistory: [
        {
          status: "confirmed_followup_required",
          rationale: "Фактологический дрейф был выделен как отдельный confirmed issue.",
        },
        {
          status: "fix_in_progress",
          rationale: "В rewrite flows введены fact ledger и запреты на добавление фактов.",
        },
        {
          status: "regression_ready",
          rationale: "Regression coverage и prompt guardrails подтверждены.",
        },
        {
          status: "closed",
          rationale: "Кейс закрыт как baseline rule и остаётся под наблюдением через review queue.",
        },
      ],
      allowedTransitions: [],
      closureGuards: [
        "При новой регрессии issue должен быть reopened новым коммитом и review update, а не правкой истории.",
      ],
    },
    closureDecision: {
      state: "closed",
      summary:
        "Кейс закрыт как baseline protected behavior и не требует отдельного follow-up, пока не появится новая регрессия.",
      requiredArtifacts: [
        "исторический fix_instruction snapshot",
        "актуальный regression artifact",
      ],
      reopenPolicy:
        "Любая новая регрессия по fact drift открывает новый review cycle и не должна стирать историю закрытого baseline issue.",
    },
    fixInstructionSnapshot: {
      whatAIDidWrong:
        "Rewrite менял хронологию и формулировки так, что появлялся новый фактический оттенок, которого не было в исходных данных.",
      correctFutureBehavior:
        "Rewrite улучшает стиль и структуру, но не меняет участников, даты, организации, доказательства и выводы.",
      badExample:
        "AI переписывает нейтральное описание как более уверенное утверждение о виновности или наличии доказательства.",
      goodExample:
        "AI сохраняет тот же фактологический каркас и только делает текст яснее и спокойнее по стилю.",
      codexInstruction:
        "Не ослаблять fact_ledger guardrails и regression checks при дальнейшем развитии rewrite flows.",
      regressionExpectation:
        "Regression tests должны продолжать ловить добавление фактов, доказательств и категоричных выводов.",
    },
    regressionFollowUp: {
      status: "test_implemented",
      artifact: "src/server/document-ai/rewrite.test.ts + src/server/document-ai/grounded-rewrite.test.ts",
      justification: null,
    },
  },
];

export function getAIConfirmedIssuesRegistry() {
  return AI_CONFIRMED_ISSUES_REGISTRY;
}
