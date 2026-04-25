export type AIConfirmedIssueStatus =
  | "confirmed_followup_required"
  | "fix_in_progress"
  | "regression_ready";

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
];

export function getAIConfirmedIssuesRegistry() {
  return AI_CONFIRMED_ISSUES_REGISTRY;
}
