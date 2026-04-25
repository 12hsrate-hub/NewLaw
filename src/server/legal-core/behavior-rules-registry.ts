export type AIBehaviorRule = {
  ruleId: string;
  title: string;
  status: "active";
  scope: string[];
  rootCauses: string[];
  summary: string;
  sourceOfTruth: string;
  acceptanceExpectation: string;
};

export type AIFixInstructionField = {
  fieldKey: string;
  label: string;
  description: string;
  required: boolean;
};

const AI_BEHAVIOR_RULES_REGISTRY: AIBehaviorRule[] = [
  {
    ruleId: "normalization_preserves_meaning_v1",
    title: "Нормализация не меняет смысл исходного ввода",
    status: "active",
    scope: ["server_legal_assistant", "document_text_improvement"],
    rootCauses: ["normalization_issue"],
    summary:
      "Нормализация может исправлять орфографию, пунктуацию и форму, но не имеет права добавлять факты, правовую оценку или смысловой сдвиг.",
    sourceOfTruth: "step_16_input_normalization + step_17_ai_quality_review",
    acceptanceExpectation:
      "Regression test должен подтверждать, что raw_input и normalized_input сохраняют один и тот же юридический смысл.",
  },
  {
    ruleId: "selected_server_law_only_v1",
    title: "AI опирается только на законодательство выбранного сервера",
    status: "active",
    scope: ["server_legal_assistant", "document_text_improvement", "grounded_document_rewrite"],
    rootCauses: ["law_basis_issue"],
    summary:
      "AI Legal Core и AI Quality Review не должны допускать смешения law_version и не должны переносить правовую базу между серверами.",
    sourceOfTruth: "step_16_ai_legal_core + step_17_ai_quality_review",
    acceptanceExpectation:
      "Regression test должен ловить law_version_contract_violation и использование источников вне current snapshot выбранного сервера.",
  },
  {
    ruleId: "descriptive_rewrite_never_adds_facts_v1",
    title: "AI-доработка описательной части не добавляет факты",
    status: "active",
    scope: ["document_text_improvement", "grounded_document_rewrite"],
    rootCauses: ["generation_issue", "normalization_issue"],
    summary:
      "AI может улучшать стиль, структуру и хронологию, но не добавляет новые факты, доказательства, организации, даты и категоричные выводы.",
    sourceOfTruth: "step_16_fact_ledger + step_17_ai_quality_review",
    acceptanceExpectation:
      "Regression test должен подтверждать, что fact ledger остаётся неизменным и AI не усиливает позицию автора.",
  },
];

const AI_FIX_INSTRUCTION_TEMPLATE: AIFixInstructionField[] = [
  {
    fieldKey: "what_ai_did_wrong",
    label: "Что AI сделал неправильно",
    description: "Кратко описать подтверждённую ошибку в ответе или AI-доработке.",
    required: true,
  },
  {
    fieldKey: "correct_future_behavior",
    label: "Как AI должен вести себя в будущем",
    description: "Зафиксировать ожидаемое поведение без двусмысленности.",
    required: true,
  },
  {
    fieldKey: "when_rule_applies",
    label: "Когда правило применяется",
    description: "Описать контекст, intent, actor_context или тип документа, где правило должно работать.",
    required: true,
  },
  {
    fieldKey: "forbidden_behavior",
    label: "Что запрещено",
    description: "Явно перечислить недопустимое поведение AI.",
    required: true,
  },
  {
    fieldKey: "bad_example",
    label: "Плохой пример",
    description: "Показать пример неправильного поведения или формулировки.",
    required: true,
  },
  {
    fieldKey: "good_example",
    label: "Хороший пример",
    description: "Показать пример корректного поведения или формулировки.",
    required: true,
  },
  {
    fieldKey: "acceptance_criteria",
    label: "Критерии приёмки",
    description: "Сформулировать, по каким признакам правка считается корректной.",
    required: true,
  },
  {
    fieldKey: "codex_instruction",
    label: "Инструкция для Codex",
    description: "Зафиксировать, что именно нужно изменить в коде, prompts или тестах.",
    required: true,
  },
  {
    fieldKey: "regression_test_expectation",
    label: "Ожидание для regression test",
    description: "Указать, какой тест должен появиться или почему тест не требуется.",
    required: true,
  },
  {
    fieldKey: "normalization_raw_meaning",
    label: "Какой смысл был в raw_input",
    description: "Заполняется дополнительно, если ошибка связана с нормализацией.",
    required: false,
  },
  {
    fieldKey: "normalization_wrong_change",
    label: "Что нормализация изменила неправильно",
    description: "Заполняется дополнительно для normalization-related проблемы.",
    required: false,
  },
  {
    fieldKey: "normalization_expected_behavior",
    label: "Как нормализация должна вести себя в будущем",
    description: "Заполняется дополнительно для normalization-related проблемы.",
    required: false,
  },
];

export function getAIBehaviorRulesRegistry() {
  return AI_BEHAVIOR_RULES_REGISTRY;
}

export function getAIFixInstructionTemplate() {
  return AI_FIX_INSTRUCTION_TEMPLATE;
}
