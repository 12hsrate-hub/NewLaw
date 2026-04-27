import { describe, expect, it } from "vitest";

import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";

describe("legal query plan legal issue diagnostics", () => {
  it("классифицирует срок ответа на адвокатский запрос как deadline question", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("deadline_question");
    expect(plan.secondaryLegalIssueTypes).toContain("duty_question");
    expect(plan.legalIssueConfidence).toBe("high");
    expect(plan.legal_anchors).toContain("attorney_request");
    expect(plan.legal_anchors).not.toContain("attorney_rights");
    expect(plan.legal_anchors).not.toContain("sanction");
    expect(plan.required_law_families).toEqual(["advocacy_law"]);
    expect(plan.preferred_norm_roles).toEqual(["primary_basis", "remedy", "right_or_guarantee"]);
  });

  it("классифицирует неответ на адвокатский запрос как refusal question", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "руководство не ответило на адвокатский запрос",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("refusal_question");
    expect(plan.legal_anchors).toContain("attorney_request");
    expect(plan.required_law_families).toContain("advocacy_law");
    expect(plan.required_law_families).not.toContain("government_code");
    expect(plan.required_law_families).not.toContain("department_specific");
    expect(plan.legalIssueDiagnostics.legal_issue_signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "refusal_question",
          source: "normalized_input",
        }),
      ]),
    );
  });

  it("классифицирует bodycam duty question без изменения retrieval contract", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли сотрудники вести видеофиксацию",
      intent: "evidence_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("duty_question");
    expect(plan.secondaryLegalIssueTypes).toContain("evidence_question");
    expect(plan.required_law_families).toEqual([
      "procedural_code",
      "government_code",
      "department_specific",
    ]);
    expect(plan.preferred_norm_roles).toEqual([
      "procedure",
      "right_or_guarantee",
      "primary_basis",
    ]);
  });

  it("классифицирует непредоставление записи адвокату как refusal/evidence", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "адвокат запросил запись задержания, но её не предоставили",
      intent: "evidence_check",
      actorContext: "representative_for_trustor",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("refusal_question");
    expect(
      plan.secondaryLegalIssueTypes.some((issueType) =>
        ["evidence_question", "procedure_question"].includes(issueType),
      ),
    ).toBe(true);
  });

  it("классифицирует допуск защитника как right question", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли допустить защитника при задержании",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("right_question");
    expect(plan.secondaryLegalIssueTypes).toEqual(
      expect.arrayContaining(["duty_question", "procedure_question"]),
    );
  });

  it("классифицирует отказ в звонке как right question", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "доверителю не дали звонок",
      intent: "situation_analysis",
      actorContext: "representative_for_trustor",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("right_question");
    expect(
      plan.secondaryLegalIssueTypes.some((issueType) =>
        ["refusal_question", "procedure_question"].includes(issueType),
      ),
    ).toBe(true);
  });

  it("классифицирует citation explanation без runtime citation parser", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 84 УК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("citation_explanation");
    expect(plan.secondaryLegalIssueTypes).toContain("sanction_question");
    expect(plan.legalIssueConfidence).toBe("high");
    expect(plan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "УК",
        lawFamily: "criminal_code",
        articleNumber: "84",
        partNumber: null,
        pointNumber: null,
        resolutionStatus: "not_attempted",
      }),
    ]);
    expect(plan.citationConstraints).toEqual({
      restrictToExplicitLawFamily: true,
      restrictToExplicitArticle: true,
      restrictToExplicitPart: false,
      allowCompanionContext: true,
      semanticRetrievalAllowedAsCompanionOnly: false,
    });
    expect(plan.citationDiagnostics).toEqual({
      citation_resolved: false,
      citation_unresolved: false,
      citation_ambiguous: false,
      semantic_retrieval_overrode_explicit_citation: false,
      raw_citation_count: 0,
      normalized_citation_count: 1,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_merge_strategy: "raw_preferred",
      citation_normalization_drift_detected: false,
    });
    expect(plan.legalIssueDiagnostics.legal_issue_signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "citation_explanation",
          source: "citation_hint",
        }),
      ]),
    );
    expect(plan.citationBehaviorMode).toBe("explanation_only");
  });

  it("возвращает unclear для короткого ambiguous input", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "алло",
      intent: "situation_analysis",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("unclear");
    expect(plan.secondaryLegalIssueTypes).toEqual([]);
    expect(plan.legalIssueConfidence).toBe("low");
    expect(plan.explicitLegalCitations).toEqual([]);
    expect(plan.citationConstraints).toEqual({
      restrictToExplicitLawFamily: false,
      restrictToExplicitArticle: false,
      restrictToExplicitPart: false,
      allowCompanionContext: false,
      semanticRetrievalAllowedAsCompanionOnly: false,
    });
    expect(plan.legalIssueDiagnostics.legal_issue_unclear_reason).toBe(
      "no_clear_issue_signals",
    );
  });

  it("не смешивает decimal article и article plus part", () => {
    const decimalPlan = buildLegalQueryPlan({
      normalizedInput: "что значит 22.1 АК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const partPlan = buildLegalQueryPlan({
      normalizedInput: "что значит 22 ч.1 АК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(decimalPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        articleNumber: "22.1",
        partNumber: null,
      }),
    ]);
    expect(partPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);
  });

  it("прокидывает hardened parser forms в legal query plan", () => {
    const proceduralPlan = buildLegalQueryPlan({
      normalizedInput: "можно ли по 23.1 ПК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyPlan = buildLegalQueryPlan({
      normalizedInput: "какой срок по 5 ч.4 Закона об адвокатуре",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(proceduralPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "ПК",
        lawFamily: "procedural_code",
        articleNumber: "23.1",
        partNumber: null,
      }),
    ]);
    expect(advocacyPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);
  });

  it("делает attorney_request primary и добавляет criminal companion family только при sanction wording", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "официальный адвокатский запрос не исполнен",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("deadline_question");
    expect(plan.legal_anchors).toContain("attorney_request");
    expect(plan.legal_anchors).toContain("sanction");
    expect(plan.secondaryLegalIssueTypes).toContain("sanction_question");
    expect(plan.required_law_families).toEqual(
      expect.arrayContaining(["advocacy_law", "criminal_code"]),
    );
    expect(plan.required_law_families).not.toContain("government_code");
    expect(plan.required_law_families).not.toContain("department_specific");
    expect(plan.preferred_norm_roles).toEqual(
      expect.arrayContaining(["primary_basis", "sanction", "remedy"]),
    );
  });

  it("предпочитает raw explicit citations при normalization drift", () => {
    const administrativePlan = buildLegalQueryPlan({
      originalInput: "что значит 22 ч.1 АК",
      normalizedInput: "Что означает пункт 1 статьи 22 АК?",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const proceduralPlan = buildLegalQueryPlan({
      originalInput: "можно ли по 23.1 ПК",
      normalizedInput: "Можно ли по статье 23.1 НК РФ?",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyPlan = buildLegalQueryPlan({
      originalInput: "5 ч.4 Закона об адвокатуре",
      normalizedInput: "Статья 5, часть 4, Закона об адвокатуре.",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(administrativePlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        lawFamily: "administrative_code",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);
    expect(administrativePlan.citationDiagnostics).toMatchObject({
      raw_citation_count: 1,
      normalized_citation_count: 1,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_merge_strategy: "raw_preferred",
      citation_normalization_drift_detected: false,
    });

    expect(proceduralPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "ПК",
        lawFamily: "procedural_code",
        articleNumber: "23.1",
        partNumber: null,
      }),
    ]);
    expect(proceduralPlan.citationDiagnostics).toMatchObject({
      raw_citation_count: 1,
      normalized_citation_count: 0,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_merge_strategy: "raw_preferred",
      citation_normalization_drift_detected: true,
    });

    expect(advocacyPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);
    expect(advocacyPlan.citationDiagnostics).toMatchObject({
      raw_citation_count: 1,
      normalized_citation_count: 1,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_merge_strategy: "raw_preferred",
      citation_normalization_drift_detected: false,
    });
  });

  it("использует normalized citation, если raw citation отсутствует, и не дублирует одинаковый match", () => {
    const normalizedOnlyPlan = buildLegalQueryPlan({
      originalInput: "что это значит?",
      normalizedInput: "что значит 84 УК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const sameCitationPlan = buildLegalQueryPlan({
      originalInput: "что значит 84 УК",
      normalizedInput: "что значит 84 УК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(normalizedOnlyPlan.explicitLegalCitations).toEqual([
      expect.objectContaining({
        lawCode: "УК",
        lawFamily: "criminal_code",
        articleNumber: "84",
      }),
    ]);
    expect(normalizedOnlyPlan.citationDiagnostics).toMatchObject({
      raw_citation_count: 0,
      normalized_citation_count: 1,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_normalization_drift_detected: false,
    });

    expect(sameCitationPlan.explicitLegalCitations).toHaveLength(1);
    expect(sameCitationPlan.citationDiagnostics).toMatchObject({
      raw_citation_count: 1,
      normalized_citation_count: 1,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_normalization_drift_detected: false,
    });
  });

  it("классифицирует bare citation long-title input как citation_explanation", () => {
    const plan = buildLegalQueryPlan({
      originalInput: "5 ч.4 Закона об адвокатуре",
      normalizedInput: "5 ч.4 Закона об адвокатуре",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.explicitLegalCitations).toHaveLength(1);
    expect(plan.primaryLegalIssueType).toBe("citation_explanation");
    expect(plan.citationBehaviorMode).toBe("explanation_only");
  });

  it("классифицирует bare citation short alias input как citation_explanation", () => {
    const administrativePlan = buildLegalQueryPlan({
      originalInput: "22 ч.1 АК",
      normalizedInput: "22 ч.1 АК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const criminalPlan = buildLegalQueryPlan({
      originalInput: "84 УК",
      normalizedInput: "84 УК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const proceduralPlan = buildLegalQueryPlan({
      originalInput: "ст. 23 ч.1 п. «в» ПК",
      normalizedInput: "ст. 23 ч.1 п. «в» ПК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(administrativePlan.primaryLegalIssueType).toBe("citation_explanation");
    expect(administrativePlan.citationBehaviorMode).toBe("explanation_only");
    expect(criminalPlan.primaryLegalIssueType).toBe("citation_explanation");
    expect(criminalPlan.secondaryLegalIssueTypes).toContain("sanction_question");
    expect(criminalPlan.citationBehaviorMode).toBe("explanation_only");
    expect(proceduralPlan.primaryLegalIssueType).toBe("citation_explanation");
    expect(proceduralPlan.citationBehaviorMode).toBe("explanation_only");
  });

  it("сохраняет application wording как citation_application", () => {
    const proceduralPlan = buildLegalQueryPlan({
      originalInput: "можно ли по 23.1 ПК",
      normalizedInput: "можно ли по 23.1 ПК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const criminalPlan = buildLegalQueryPlan({
      originalInput: "привлечь по 84 УК",
      normalizedInput: "привлечь по 84 УК",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(proceduralPlan.primaryLegalIssueType).toBe("citation_application");
    expect(proceduralPlan.citationBehaviorMode).toBe("application_with_insufficient_facts");
    expect(criminalPlan.primaryLegalIssueType).toBe("citation_application");
    expect(criminalPlan.secondaryLegalIssueTypes).toContain("sanction_question");
    expect(criminalPlan.citationBehaviorMode).toBe("application_with_insufficient_facts");
  });

  it("даёт application mode при explicit citation и достаточном фактическом контуре", () => {
    const plan = buildLegalQueryPlan({
      originalInput: "можно ли по 22 ч.1 АК привлечь за танцы в больнице",
      normalizedInput: "можно ли по 22 ч.1 АК привлечь за танцы в больнице",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("citation_application");
    expect(plan.citationBehaviorMode).toBe("application");
  });

  it("сохраняет application mode для citation-сценария с отказом руководства", () => {
    const plan = buildLegalQueryPlan({
      originalInput: "что если руководство отказало по 5 ч.4 Закона об адвокатуре",
      normalizedInput: "что если руководство отказало по 5 ч.4 Закона об адвокатуре",
      intent: "situation_analysis",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.citationBehaviorMode).toBe("application");
  });

  it("делает mixed_or_unclear, если explicit citation одновременно просит explanation и application", () => {
    const plan = buildLegalQueryPlan({
      originalInput: "22 ч.1 АК, это вообще про что и можно ли по ней привлечь в такой ситуации",
      normalizedInput: "22 ч.1 АК, это вообще про что и можно ли по ней привлечь в такой ситуации",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.explicitLegalCitations).toHaveLength(1);
    expect(plan.citationBehaviorMode).toBe("mixed_or_unclear");
  });

  it("не переопределяет substantive issue bare citation override при полном фактическом контексте", () => {
    const plan = buildLegalQueryPlan({
      originalInput: "если руководство не ответило на адвокатский запрос по ст. 5 Закона об адвокатуре",
      normalizedInput: "если руководство не ответило на адвокатский запрос по ст. 5 Закона об адвокатуре",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.primaryLegalIssueType).toBe("refusal_question");
    expect(plan.primaryLegalIssueType).not.toBe("citation_explanation");
  });

  it("не меняет non-citation attorney_rights question", () => {
    const plan = buildLegalQueryPlan({
      originalInput: "обязаны ли допустить защитника при задержании",
      normalizedInput: "обязаны ли допустить защитника при задержании",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.explicitLegalCitations).toEqual([]);
    expect(plan.primaryLegalIssueType).toBe("right_question");
  });
});
