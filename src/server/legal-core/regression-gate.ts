export type AIRegressionGateItem = {
  itemKey: string;
  label: string;
  description: string;
  required: boolean;
};

export type AIRegressionGateRule = {
  ruleKey: string;
  title: string;
  summary: string;
};

const AI_REGRESSION_GATE_ITEMS: AIRegressionGateItem[] = [
  {
    itemKey: "issue_scope_confirmed",
    label: "Подтверждён реальный scope проблемы",
    description:
      "Перед фиксом нужно явно зафиксировать, где именно находится ошибка: normalization, retrieval, generation или law basis.",
    required: true,
  },
  {
    itemKey: "fix_instruction_completed",
    label: "Заполнен fix_instruction",
    description:
      "Кейс не закрывается, пока не заполнен шаблон fix_instruction с ожидаемым будущим поведением AI.",
    required: true,
  },
  {
    itemKey: "test_added_or_updated",
    label: "Добавлен или обновлён regression test",
    description:
      "Предпочтительный путь закрытия: новый тест, который воспроизводит подтверждённую проблему и фиксирует ожидаемое поведение после правки.",
    required: false,
  },
  {
    itemKey: "test_not_required_justified",
    label: "Есть явное обоснование, почему тест не требуется",
    description:
      "Если тест не добавляется, это должно быть зафиксировано как осознанное исключение, а не как молчаливый пропуск.",
    required: false,
  },
  {
    itemKey: "behavior_rule_linked",
    label: "Кейс привязан к AI Behavior Rule",
    description:
      "Подтверждённая проблема должна быть привязана к существующему правилу или привести к созданию нового repo-managed правила.",
    required: true,
  },
  {
    itemKey: "pr_or_commit_ready",
    label: "Подготовлен инженерный follow-up",
    description:
      "Результат review должен переходить в PR или commit, а не оставаться только в internal заметке.",
    required: true,
  },
];

const AI_REGRESSION_GATE_RULES: AIRegressionGateRule[] = [
  {
    ruleKey: "close_requires_test_or_justification",
    title: "Проблема не закрывается без теста или обоснования",
    summary:
      "Confirmed issue не считается исправленным, пока не появился regression test или не зафиксировано явное объяснение, почему тест не требуется.",
  },
  {
    ruleKey: "review_stays_human_controlled",
    title: "Regression gate не меняет production автоматически",
    summary:
      "Даже при high-risk кейсе слой review не вносит auto-fix в prompts, код или правила без человека и обычного инженерного цикла.",
  },
  {
    ruleKey: "normalization_cases_need_chain_check",
    title: "Normalization-related кейс проверяется по всей цепочке",
    summary:
      "Для normalization_issue нужно отдельно сверять raw_input, normalized_input, retrieved sources и final output перед закрытием кейса.",
  },
];

export function getAIRegressionGateItems() {
  return AI_REGRESSION_GATE_ITEMS;
}

export function getAIRegressionGateRules() {
  return AI_REGRESSION_GATE_RULES;
}
