import { describe, expect, it } from "vitest";

import {
  buildAssistantPrecedentRetrievalQuery,
  buildAssistantRetrievalQuery,
} from "@/server/legal-core/assistant-retrieval-query";

describe("assistant retrieval query", () => {
  it("строит structured breakdown для вопроса про маску и задержание", () => {
    const query = buildAssistantRetrievalQuery({
      normalized_input: "Можно ли задержать человека за ношение маски?",
      intent: "situation_analysis",
      required_law_families: ["administrative_code", "procedural_code"],
      preferred_norm_roles: ["primary_basis", "procedure", "sanction"],
      legal_anchors: ["administrative_offense", "detention_procedure", "sanction"],
      question_scope: "general_question",
      forbidden_scope_markers: ["публичное мероприятие", "митинг"],
    });

    expect(query.expanded_query).toContain("административный кодекс");
    expect(query.expanded_query).toContain("процессуальный кодекс");
    expect(query.anchor_terms).toEqual(
      expect.arrayContaining(["административный кодекс", "маскировка", "задержание"]),
    );
    expect(query.family_terms).toEqual(
      expect.arrayContaining(["административное правонарушение", "процедура задержания"]),
    );
    expect(query.runtime_tags).toEqual(
      expect.arrayContaining(["material_offense", "detention"]),
    );
    expect(query.applied_biases).toEqual(
      expect.arrayContaining([
        "prefer_family:administrative_code",
        "prefer_family:procedural_code_secondary",
      ]),
    );
  });

  it("добавляет bodycam/evidence runtime tags и procedural hints для общего вопроса", () => {
    const query = buildAssistantRetrievalQuery({
      normalized_input: "если сотрудник не вел бодикам это нарушение",
      intent: "evidence_check",
      required_law_families: ["procedural_code"],
      preferred_norm_roles: ["procedure", "right_or_guarantee"],
      legal_anchors: ["video_recording", "official_duty", "evidence"],
      question_scope: "general_question",
      forbidden_scope_markers: ["национальная гвардия"],
    });

    expect(query.anchor_terms).toEqual(
      expect.arrayContaining(["видеофиксация", "видеозапись", "служебные обязанности"]),
    );
    expect(query.runtime_tags).toEqual(
      expect.arrayContaining(["bodycam", "evidence", "official_duty"]),
    );
    expect(query.applied_biases).toContain("demote_department_specific_for_general_question");
  });

  it("усиливает advocacy_law и attorney_request для вопроса про адвокатский запрос", () => {
    const query = buildAssistantRetrievalQuery({
      normalized_input: "какой срок ответа на адвокатский запрос",
      intent: "law_explanation",
      required_law_families: ["advocacy_law"],
      preferred_norm_roles: ["primary_basis", "remedy", "right_or_guarantee"],
      legal_anchors: ["attorney_request"],
      question_scope: "general_question",
      forbidden_scope_markers: [],
    });

    expect(query.expanded_query).toContain("официальный адвокатский запрос");
    expect(query.expanded_query).toContain("один календарный день");
    expect(query.expanded_query).toContain("отказ в предоставлении сведений");
    expect(query.family_terms).toContain("закон об адвокатуре");
    expect(query.runtime_tags).toEqual(expect.arrayContaining(["attorney", "attorney_request"]));
    expect(query.runtime_tags).not.toContain("official_duty");
    expect(query.applied_biases).toContain("prefer_family:advocacy_law");
    expect(query.applied_biases).not.toContain("prefer_family:administrative_code");
  });

  it("строит compact precedent query в пределах лимита длины", () => {
    const breakdown = buildAssistantRetrievalQuery({
      normalized_input: "если руководство не ответило на адвокатский запрос",
      intent: "law_explanation",
      required_law_families: ["advocacy_law"],
      preferred_norm_roles: ["primary_basis", "remedy", "right_or_guarantee"],
      legal_anchors: ["attorney_request"],
      question_scope: "general_question",
      forbidden_scope_markers: ["официальный адвокатский запрос"],
    });

    const precedentQuery = buildAssistantPrecedentRetrievalQuery({
      normalized_input: "если руководство не ответило на адвокатский запрос",
      breakdown,
    });

    expect(precedentQuery.length).toBeLessThanOrEqual(500);
    expect(precedentQuery).toContain("если руководство не ответило на адвокатский запрос");
    expect(precedentQuery).toContain("адвокатский запрос");
    expect(precedentQuery).toContain("обязанность ответить");
  });

  it("добавляет consequence companion terms для attorney_request с wording про неисполнение", () => {
    const query = buildAssistantRetrievalQuery({
      normalized_input: "официальный адвокатский запрос не исполнен",
      intent: "law_explanation",
      required_law_families: ["advocacy_law", "criminal_code"],
      preferred_norm_roles: ["primary_basis", "sanction", "remedy", "right_or_guarantee"],
      legal_anchors: ["attorney_request", "sanction"],
      question_scope: "general_question",
      forbidden_scope_markers: [],
    });

    expect(query.anchor_terms).toEqual(
      expect.arrayContaining([
        "адвокатский запрос",
        "срок ответа",
        "один календарный день",
        "отказ в предоставлении сведений",
        "наказание",
      ]),
    );
    expect(query.family_terms).toEqual(
      expect.arrayContaining(["закон об адвокатуре", "уголовный кодекс"]),
    );
  });
});
