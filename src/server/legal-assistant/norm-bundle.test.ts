import { describe, expect, it } from "vitest";

import { buildNormBundle } from "@/server/legal-assistant/norm-bundle";
import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import type {
  LegalSelectionCandidate,
  ScoredLegalCandidate,
  StructuredSelectionResult,
} from "@/server/legal-core/legal-selection";

function createCandidate(
  overrides: Partial<LegalSelectionCandidate & { blockOrder?: number | null }> = {},
) {
  return {
    serverId: "server-1",
    lawId: "law-1",
    lawKey: "law_key",
    lawTitle: "Закон",
    lawVersionId: "version-1",
    lawBlockId: "block-1",
    blockType: "article",
    blockText: "Статья. Базовый текст нормы.",
    articleNumberNormalized: "1",
    sourceTopicUrl: "https://forum.gta5rp.com/threads/law",
    blockOrder: 1,
    sourceChannel: "semantic" as const,
    citationResolutionStatus: null,
    ...overrides,
  };
}

function createScoredCandidate(
  candidate: ReturnType<typeof createCandidate>,
  overrides: Partial<ScoredLegalCandidate<typeof candidate>> = {},
) {
  return {
    candidate,
    law_family: "other",
    norm_role: "background_only",
    applicability_score: 1,
    primary_basis_eligibility: "ineligible",
    primary_basis_eligibility_reason: null,
    ineligible_primary_basis_reasons: [],
    weak_primary_basis_reasons: [],
    matched_anchors: [],
    matched_required_law_family: true,
    matched_preferred_norm_role: false,
    off_topic: false,
    penalties: [],
    specificity_rank: 0,
    specificity_reasons: [],
    specificity_penalties: [],
    source_channel: candidate.sourceChannel ?? "semantic",
    citation_resolution_status: candidate.citationResolutionStatus ?? null,
    ...overrides,
  } satisfies ScoredLegalCandidate<typeof candidate>;
}

function createSelection(
  input: Partial<StructuredSelectionResult<ReturnType<typeof createCandidate>>> = {},
) {
  return {
    scored_candidates: [],
    primary_basis_norms: [],
    procedure_norms: [],
    exception_norms: [],
    supporting_norms: [],
    selected_norms: [],
    selected_norm_roles: [],
    direct_basis_status: "no_direct_basis",
    ...input,
  } satisfies StructuredSelectionResult<ReturnType<typeof createCandidate>>;
}

describe("norm bundle", () => {
  it("для deadline_question оставляет advocacy primary и добавляет ч. 2 как extracted companion без blind inclusion всех частей", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyCandidate = createCandidate({
      lawId: "law-advocacy",
      lawKey: "advocacy_law",
      lawTitle: "Закон об адвокатуре и адвокатской деятельности",
      lawBlockId: "block-advocacy",
      blockText: [
        "Статья 5. Адвокатский запрос",
        "ч. 1 Адвокат вправе направлять официальный адвокатский запрос (далее - адвокатский запрос).",
        "Примечание: Перед направлением запроса необходимо соблюсти установленный порядок публикации.",
        "ч. 2 Органы и организации должны дать на него ответ в течение одного календарного дня.",
        "ч. 4 В предоставлении сведений может быть отказано, если адресат не располагает сведениями.",
        "ч. 5 Неправомерный отказ и нарушение сроков влекут ответственность.",
      ].join("\n"),
      articleNumberNormalized: "5",
      blockOrder: 5,
    });
    const criminalCandidate = createCandidate({
      lawId: "law-criminal",
      lawKey: "criminal_code",
      lawTitle: "Уголовный кодекс",
      lawBlockId: "block-criminal",
      blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
      articleNumberNormalized: "84",
      blockOrder: 84,
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(advocacyCandidate, {
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 10,
          primary_basis_eligibility: "eligible",
          primary_basis_eligibility_reason: "eligible_due_to_attorney_request_primary_rule",
          matched_anchors: ["attorney_request"],
          specificity_rank: 5,
        }),
        createScoredCandidate(criminalCandidate, {
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 3,
          primary_basis_eligibility: "ineligible",
          primary_basis_eligibility_reason: "ineligible_due_to_sanction_only",
          matched_anchors: ["sanction"],
          specificity_rank: 1,
        }),
      ],
      primary_basis_norms: [advocacyCandidate],
      supporting_norms: [criminalCandidate],
      selected_norms: [advocacyCandidate, criminalCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-advocacy",
          law_version: "version-1",
          law_block_id: "block-advocacy",
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 10,
        },
        {
          server_id: "server-1",
          law_id: "law-criminal",
          law_version: "version-1",
          law_block_id: "block-criminal",
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 3,
        },
      ],
      direct_basis_status: "direct_basis_present",
    });

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [advocacyCandidate, criminalCandidate],
    });

    expect(bundle.primary_basis_norms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-advocacy",
          relation_type: "primary",
        }),
      ]),
    );
    expect(bundle.sanction_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-criminal",
          relation_type: "sanction_companion",
        }),
      ]),
    );
    expect(bundle.procedure_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-advocacy",
          marker: "ч. 2",
          relation_type: "procedure_companion",
        }),
      ]),
    );
    expect(bundle.bundle_diagnostics.included_article_segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marker: "ч. 2",
          relation_type: "procedure_companion",
        }),
      ]),
    );
    expect(bundle.bundle_diagnostics.included_article_segments).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ marker: "ч. 4" })]),
    );
    expect(bundle.primary_basis_norms).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ law_id: "law-criminal" })]),
    );
    expect(selection.direct_basis_status).toBe("direct_basis_present");
  });

  it("оставляет citation_target primary, citation_companion — companion, а unresolved citation переводит в warning", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 84 УК",
      originalInput: "что значит 84 УК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const citationTargetCandidate = createCandidate({
      lawId: "law-citation-target",
      lawKey: "criminal_code",
      lawTitle: "Уголовный кодекс",
      lawBlockId: "block-citation-target",
      blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
      articleNumberNormalized: "84",
      blockOrder: 84,
      sourceChannel: "citation_target",
      citationResolutionStatus: "resolved",
    });
    const citationCompanionCandidate = createCandidate({
      lawId: "law-citation-companion",
      lawKey: "criminal_code",
      lawTitle: "Уголовный кодекс",
      lawBlockId: "block-citation-companion",
      blockText: "Примечание к статье 84 применяется с учётом других положений кодекса.",
      articleNumberNormalized: "84",
      blockOrder: 85,
      sourceChannel: "citation_companion",
      citationResolutionStatus: "resolved",
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(citationTargetCandidate, {
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 11,
          primary_basis_eligibility: "eligible",
          primary_basis_eligibility_reason: "eligible_due_to_resolved_citation_target",
          source_channel: "citation_target",
          citation_resolution_status: "resolved",
        }),
        createScoredCandidate(citationCompanionCandidate, {
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 7,
          primary_basis_eligibility: "ineligible",
          primary_basis_eligibility_reason: "ineligible_due_to_sanction_only",
          source_channel: "citation_companion",
          citation_resolution_status: "resolved",
        }),
      ],
      primary_basis_norms: [citationTargetCandidate],
      supporting_norms: [citationCompanionCandidate],
      selected_norms: [citationTargetCandidate, citationCompanionCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-citation-target",
          law_version: "version-1",
          law_block_id: "block-citation-target",
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 11,
        },
        {
          server_id: "server-1",
          law_id: "law-citation-companion",
          law_version: "version-1",
          law_block_id: "block-citation-companion",
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 7,
        },
      ],
      direct_basis_status: "direct_basis_present",
    });

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [citationTargetCandidate, citationCompanionCandidate],
      citationDiagnostics: [
        {
          raw_citation: "999 УК",
          resolution_status: "unresolved",
          resolution_reason: "no_article",
          resolved_block_id: null,
        },
      ],
    });

    expect(bundle.primary_basis_norms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-citation-target",
          relation_type: "primary",
        }),
      ]),
    );
    expect(bundle.citation_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-citation-companion",
          relation_type: "citation_companion",
        }),
      ]),
    );
    expect(bundle.unresolved_companion_warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          warning_code: "citation_unresolved_reference",
          relation_type: "unresolved_reference",
        }),
      ]),
    );
  });

  it("для refusal_question включает ч. 4, ч. 2 и ч. 5 как same-article companions без promotion в primary", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "если руководство не ответило на адвокатский запрос",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyCandidate = createCandidate({
      lawId: "law-advocacy",
      lawKey: "advocacy_law",
      lawTitle: "Закон об адвокатуре и адвокатской деятельности",
      lawBlockId: "block-advocacy",
      blockText: [
        "Статья 5. Адвокатский запрос",
        "ч. 1 Адвокат вправе направлять официальный адвокатский запрос (далее - адвокатский запрос).",
        "ч. 2 Органы и организации должны дать на него ответ в течение одного календарного дня.",
        "ч. 4 В предоставлении сведений может быть отказано, если адресат не располагает сведениями или информация покрывается тайной.",
        "ч. 5 Неправомерный отказ и нарушение сроков влекут ответственность.",
      ].join("\n"),
      articleNumberNormalized: "5",
      blockOrder: 5,
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(advocacyCandidate, {
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 10,
          primary_basis_eligibility: "eligible",
          primary_basis_eligibility_reason: "eligible_due_to_attorney_request_primary_rule",
          matched_anchors: ["attorney_request"],
          specificity_rank: 5,
        }),
      ],
      primary_basis_norms: [advocacyCandidate],
      selected_norms: [advocacyCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-advocacy",
          law_version: "version-1",
          law_block_id: "block-advocacy",
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 10,
        },
      ],
      direct_basis_status: "direct_basis_present",
    });

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [advocacyCandidate],
    });

    expect(bundle.primary_basis_norms).toHaveLength(1);
    expect(bundle.exceptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ marker: "ч. 4", relation_type: "exception" })]),
    );
    expect(bundle.procedure_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker: "ч. 2", relation_type: "procedure_companion" }),
      ]),
    );
    expect(bundle.sanction_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker: "ч. 5", relation_type: "sanction_companion" }),
      ]),
    );
  });

  it("для sanction_question включает ч. 5 как sanction_companion и не повышает сегменты до primary", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что грозит за неисполнение адвокатского запроса",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyCandidate = createCandidate({
      lawId: "law-advocacy",
      lawKey: "advocacy_law",
      lawTitle: "Закон об адвокатуре и адвокатской деятельности",
      lawBlockId: "block-advocacy",
      blockText: [
        "Статья 5. Адвокатский запрос",
        "ч. 1 Адвокат вправе направлять официальный адвокатский запрос.",
        "ч. 5 Неправомерный отказ и нарушение сроков влекут ответственность.",
      ].join("\n"),
      articleNumberNormalized: "5",
      blockOrder: 5,
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(advocacyCandidate, {
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 10,
          primary_basis_eligibility: "eligible",
          primary_basis_eligibility_reason: "eligible_due_to_attorney_request_primary_rule",
          matched_anchors: ["attorney_request", "sanction"],
          specificity_rank: 5,
        }),
      ],
      primary_basis_norms: [advocacyCandidate],
      selected_norms: [advocacyCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-advocacy",
          law_version: "version-1",
          law_block_id: "block-advocacy",
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 10,
        },
      ],
      direct_basis_status: "direct_basis_present",
    });

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [advocacyCandidate],
    });

    expect(bundle.sanction_companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker: "ч. 5", relation_type: "sanction_companion" }),
      ]),
    );
    expect(bundle.primary_basis_norms).toEqual([
      expect.objectContaining({
        law_id: "law-advocacy",
        relation_type: "primary",
      }),
    ]);
  });

  it("кладёт Примечание в article_notes и увеличивает diagnostics count", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "как направить адвокатский запрос",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyCandidate = createCandidate({
      lawId: "law-advocacy",
      lawKey: "advocacy_law",
      lawTitle: "Закон об адвокатуре и адвокатской деятельности",
      lawBlockId: "block-advocacy",
      blockText: [
        "Статья 5. Адвокатский запрос",
        "Примечание: Перед тем как направить адвокатский запрос, необходимо опубликовать его в установленном порядке.",
        "ч. 2 Органы должны дать ответ в течение одного календарного дня.",
      ].join("\n"),
      articleNumberNormalized: "5",
      blockOrder: 5,
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(advocacyCandidate, {
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 9,
          primary_basis_eligibility: "eligible",
          primary_basis_eligibility_reason: "eligible_due_to_attorney_request_primary_rule",
          matched_anchors: ["attorney_request"],
        }),
      ],
      primary_basis_norms: [advocacyCandidate],
      selected_norms: [advocacyCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-advocacy",
          law_version: "version-1",
          law_block_id: "block-advocacy",
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 9,
        },
      ],
      direct_basis_status: "direct_basis_present",
    });

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [advocacyCandidate],
    });

    expect(bundle.article_notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker: "Примечание", relation_type: "article_note" }),
      ]),
    );
    expect(bundle.bundle_diagnostics.article_note_count).toBe(1);
  });

  it("не создаёт primary_basis_norms из companion-only или exception-only context и не мутирует selection", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что грозит за нарушение",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const sanctionOnlyCandidate = createCandidate({
      lawId: "law-sanction-only",
      lawKey: "criminal_code",
      lawTitle: "Уголовный кодекс",
      lawBlockId: "block-sanction-only",
      blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
      articleNumberNormalized: "84",
      blockOrder: 84,
    });
    const exceptionOnlyCandidate = createCandidate({
      lawId: "law-exception-only",
      lawKey: "procedural_code",
      lawTitle: "Процессуальный кодекс",
      lawBlockId: "block-exception-only",
      blockText: "За исключением случаев, прямо предусмотренных законом.",
      articleNumberNormalized: "15",
      blockOrder: 15,
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(sanctionOnlyCandidate, {
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 7,
          primary_basis_eligibility: "ineligible",
          primary_basis_eligibility_reason: "ineligible_due_to_sanction_only",
        }),
        createScoredCandidate(exceptionOnlyCandidate, {
          law_family: "procedural_code",
          norm_role: "exception",
          applicability_score: 4,
          primary_basis_eligibility: "ineligible",
          primary_basis_eligibility_reason: "ineligible_due_to_exception_without_base",
        }),
      ],
      exception_norms: [exceptionOnlyCandidate],
      supporting_norms: [sanctionOnlyCandidate],
      selected_norms: [sanctionOnlyCandidate, exceptionOnlyCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-sanction-only",
          law_version: "version-1",
          law_block_id: "block-sanction-only",
          law_family: "criminal_code",
          norm_role: "sanction",
          applicability_score: 7,
        },
        {
          server_id: "server-1",
          law_id: "law-exception-only",
          law_version: "version-1",
          law_block_id: "block-exception-only",
          law_family: "procedural_code",
          norm_role: "exception",
          applicability_score: 4,
        },
      ],
      direct_basis_status: "partial_basis_only",
    });
    const originalSelectedNormRoles = JSON.parse(JSON.stringify(selection.selected_norm_roles));
    const originalDirectBasisStatus = selection.direct_basis_status;

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [sanctionOnlyCandidate, exceptionOnlyCandidate],
    });

    expect(bundle.primary_basis_norms).toEqual([]);
    expect(bundle.sanction_companions).toHaveLength(1);
    expect(bundle.exceptions).toHaveLength(1);
    expect(selection.selected_norm_roles).toEqual(originalSelectedNormRoles);
    expect(selection.direct_basis_status).toBe(originalDirectBasisStatus);
  });

  it("держит diagnostics компактными и не тащит full blockText в diagnostics", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
      intent: "law_explanation",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });
    const advocacyCandidate = createCandidate({
      lawId: "law-advocacy",
      lawKey: "advocacy_law",
      lawTitle: "Закон об адвокатуре и адвокатской деятельности",
      lawBlockId: "block-advocacy",
      blockText:
        "Статья 5. Адвокатский запрос. Официальный адвокатский запрос направляется адресату. Ответ должен быть дан в течение одного календарного дня с момента получения.",
      articleNumberNormalized: "5",
      blockOrder: 5,
    });
    const selection = createSelection({
      scored_candidates: [
        createScoredCandidate(advocacyCandidate, {
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 9,
          primary_basis_eligibility: "eligible",
          primary_basis_eligibility_reason: "eligible_due_to_attorney_request_primary_rule",
        }),
      ],
      primary_basis_norms: [advocacyCandidate],
      selected_norms: [advocacyCandidate],
      selected_norm_roles: [
        {
          server_id: "server-1",
          law_id: "law-advocacy",
          law_version: "version-1",
          law_block_id: "block-advocacy",
          law_family: "advocacy_law",
          norm_role: "primary_basis",
          applicability_score: 9,
        },
      ],
      direct_basis_status: "direct_basis_present",
    });

    const bundle = buildNormBundle({
      plan,
      selection,
      retrievalResults: [advocacyCandidate],
    });

    expect(bundle.bundle_diagnostics.norm_bundle_present).toBe(true);
    expect(bundle.bundle_diagnostics.bundle_primary_count).toBe(1);
    expect(bundle.bundle_diagnostics.bundle_companion_count).toBe(0);
    expect(bundle.bundle_diagnostics.companion_relation_types).toEqual([]);
    expect(bundle.bundle_diagnostics.included_companions).toEqual([]);
    expect(bundle.bundle_diagnostics.included_article_segments).toEqual([]);
    expect(JSON.stringify(bundle.bundle_diagnostics)).not.toContain("Официальный адвокатский запрос направляется");
  });
});
