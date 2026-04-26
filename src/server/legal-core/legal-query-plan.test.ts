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
    expect(plan.required_law_families).toEqual([
      "procedural_code",
      "advocacy_law",
      "government_code",
      "department_specific",
      "administrative_code",
    ]);
    expect(plan.preferred_norm_roles).toEqual([
      "right_or_guarantee",
      "procedure",
      "primary_basis",
      "sanction",
      "remedy",
    ]);
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
    expect(
      plan.secondaryLegalIssueTypes.some((issueType) =>
        ["deadline_question", "duty_question"].includes(issueType),
      ),
    ).toBe(true);
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
    });
    expect(plan.legalIssueDiagnostics.legal_issue_signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "citation_explanation",
          source: "citation_hint",
        }),
      ]),
    );
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
});
