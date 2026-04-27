import { describe, expect, it } from "vitest";

import { evaluateScenarioExpectations } from "@/server/legal-core/test-expectation-evaluator";

describe("ai legal core expectation evaluator", () => {
  it("проходит requiredLawFamilies и requiredNormRoles, когда selected legal context совпадает с expectation", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        requiredLawFamilies: ["administrative_code"],
        requiredNormRoles: ["primary_basis"],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-1",
            law_version: "version-1",
            law_block_id: "block-1",
            law_family: "administrative_code",
            norm_role: "primary_basis",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-1",
            law_version: "version-1",
            law_block_id: "block-1",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
      },
    });

    expect(result.passed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredLawFamilies",
          status: "passed",
        }),
        expect.objectContaining({
          key: "requiredNormRoles",
          status: "passed",
        }),
      ]),
    );
  });

  it("проваливает requiredLawFamilies и forbidden checks при несоответствии", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        requiredLawFamilies: ["advocacy_law"],
        forbiddenLawFamilies: ["government_code"],
        forbiddenNormRoles: ["background_only"],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-2",
            law_version: "version-2",
            law_block_id: "block-2",
            law_family: "government_code",
            norm_role: "background_only",
          },
        ],
        primary_basis_eligibility: [],
        direct_basis_status: "partial_basis_only",
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredLawFamilies",
          status: "failed",
        }),
        expect.objectContaining({
          key: "forbiddenLawFamilies",
          status: "failed",
        }),
        expect.objectContaining({
          key: "forbiddenNormRoles",
          status: "failed",
        }),
      ]),
    );
  });

  it("проверяет expectedDirectBasisStatus и minPrimaryBasisNorms через selected_norm_roles и primary_basis_eligibility", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        minPrimaryBasisNorms: 1,
        expectedDirectBasisStatus: "direct_basis_present",
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-1",
            law_version: "version-1",
            law_block_id: "block-1",
            law_family: "administrative_code",
            norm_role: "primary_basis",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-1",
            law_version: "version-1",
            law_block_id: "block-1",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
      },
    });

    expect(result.passed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "minPrimaryBasisNorms",
          status: "passed",
        }),
        expect.objectContaining({
          key: "expectedDirectBasisStatus",
          status: "passed",
        }),
      ]),
    );
  });

  it("проверяет forbiddenPrimaryBasis по доступному primary basis metadata", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        forbiddenPrimaryBasis: [
          {
            lawFamily: "government_code",
            lawId: "law-gov-1",
          },
        ],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-gov-1",
            law_version: "version-1",
            law_block_id: "block-1",
            law_family: "government_code",
            norm_role: "primary_basis",
          },
        ],
        primary_basis_eligibility: [],
        direct_basis_status: "partial_basis_only",
        used_sources: [
          {
            source_kind: "law",
            law_id: "law-gov-1",
            law_name: "Закон о деятельности ОГП",
          },
        ],
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "forbiddenPrimaryBasis",
          status: "failed",
        }),
      ]),
    );
  });

  it("возвращает not_evaluable для maxTokens и maxLatency при отсутствии metrics", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        maxTokens: 200,
        maxLatency: 1000,
      },
      snapshot: {
        selected_norm_roles: [],
        primary_basis_eligibility: [],
        direct_basis_status: "no_direct_basis",
        technical: {
          tokens: null,
          latencyMs: null,
        },
      },
    });

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "maxTokens",
          status: "not_evaluable",
        }),
        expect.objectContaining({
          key: "maxLatency",
          status: "not_evaluable",
        }),
      ]),
    );
  });

  it("возвращает future_reserved для companion-related expectation fields без явной активации checks", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        requiredCompanionRelations: ["procedure_companion"],
        expectedNormBundle: ["primary_basis_norms"],
        forbiddenCompanionAsPrimary: ["sanction_companion"],
        missingCompanionWarning: true,
      },
      snapshot: {
        selected_norm_roles: [],
        primary_basis_eligibility: [],
        direct_basis_status: "partial_basis_only",
      },
    });

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredCompanionRelations",
          status: "future_reserved",
        }),
        expect.objectContaining({
          key: "forbiddenCompanionAsPrimary",
          status: "future_reserved",
        }),
        expect.objectContaining({
          key: "expectedNormBundle",
          status: "future_reserved",
        }),
        expect.objectContaining({
          key: "missingCompanionWarning",
          status: "future_reserved",
        }),
      ]),
    );
  });

  it("проверяет attorney_request companion expectations по bundle diagnostics и duplicate coverage", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        activateCompanionChecks: true,
        requiredCompanionRelations: ["procedure_companion", "sanction_companion"],
        requiredCompanionTargets: [
          {
            relationType: "procedure_companion",
            lawFamily: "advocacy_law",
            articleNumber: "5",
            partNumber: "2",
            allowCoveredByPrimaryExcerpt: true,
          },
          {
            relationType: "sanction_companion",
            lawFamily: "advocacy_law",
            articleNumber: "5",
            partNumber: "5",
          },
        ],
        forbiddenCompanionAsPrimary: ["sanction_companion", "exception"],
        failIfSanctionWithoutBaseRule: true,
        failIfExceptionWithoutBaseRule: true,
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            law_family: "advocacy_law",
            norm_role: "primary_basis",
          },
          {
            law_id: "law-criminal",
            law_version: "version-1",
            law_block_id: "block-criminal",
            law_family: "criminal_code",
            norm_role: "sanction",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
        norm_bundle_diagnostics: {
          companion_relation_types: ["procedure_companion", "exception", "sanction_companion"],
          missing_expected_companion: [],
          included_article_segments: [
            {
              law_id: "law-adv",
              law_family: "advocacy_law",
              article_number: "5",
              marker: "ч. 2",
              part_number: "2",
              relation_type: "procedure_companion",
              reason_code: "article_segment_relevant_to_no_response",
            },
            {
              law_id: "law-adv",
              law_family: "advocacy_law",
              article_number: "5",
              marker: "ч. 5",
              part_number: "5",
              relation_type: "sanction_companion",
              reason_code: "article_segment_consequence_signal",
            },
          ],
          excluded_article_segments: [],
          bundle_projection_excluded_items: [
            {
              law_id: "law-adv",
              law_family: "advocacy_law",
              article_number: "5",
              marker: "ч. 4",
              part_number: "4",
              relation_type: "exception",
              reason_code: "duplicate_of_primary_excerpt",
            },
          ],
        },
      },
    });

    expect(result.passed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredCompanionRelations",
          status: "passed",
        }),
        expect.objectContaining({
          key: "requiredCompanionTargets",
          status: "passed",
        }),
        expect.objectContaining({
          key: "forbiddenCompanionAsPrimary",
          status: "passed",
        }),
        expect.objectContaining({
          key: "failIfSanctionWithoutBaseRule",
          status: "passed",
        }),
        expect.objectContaining({
          key: "failIfExceptionWithoutBaseRule",
          status: "passed",
        }),
      ]),
    );
  });

  it("проваливает expectation, если required companion отсутствует", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        activateCompanionChecks: true,
        requiredCompanionTargets: [
          {
            relationType: "procedure_companion",
            lawFamily: "advocacy_law",
            articleNumber: "5",
            partNumber: "2",
          },
          {
            relationType: "sanction_companion",
            lawFamily: "advocacy_law",
            articleNumber: "5",
            partNumber: "5",
          },
        ],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            law_family: "advocacy_law",
            norm_role: "primary_basis",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
        norm_bundle_diagnostics: {
          companion_relation_types: ["procedure_companion"],
          missing_expected_companion: ["sanction_companion:5:5"],
          included_article_segments: [
            {
              law_id: "law-adv",
              law_family: "advocacy_law",
              article_number: "5",
              marker: "ч. 2",
              part_number: "2",
              relation_type: "procedure_companion",
              reason_code: "article_segment_relevant_to_no_response",
            },
          ],
          excluded_article_segments: [],
          bundle_projection_excluded_items: [],
        },
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredCompanionTargets",
          status: "failed",
        }),
      ]),
    );
  });

  it("проваливает negative cases для sanction или exception без base rule", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        activateCompanionChecks: true,
        forbiddenCompanionAsPrimary: ["sanction_companion", "exception"],
        failIfSanctionWithoutBaseRule: true,
        failIfExceptionWithoutBaseRule: true,
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-criminal",
            law_version: "version-1",
            law_block_id: "block-criminal",
            law_family: "criminal_code",
            norm_role: "sanction",
          },
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            law_family: "advocacy_law",
            norm_role: "exception",
          },
        ],
        primary_basis_eligibility: [],
        direct_basis_status: "partial_basis_only",
        norm_bundle_diagnostics: {
          companion_relation_types: ["sanction_companion", "exception"],
          missing_expected_companion: [],
          included_article_segments: [
            {
              law_id: "law-criminal",
              law_family: "criminal_code",
              article_number: "84",
              marker: "ч. 1",
              part_number: "1",
              relation_type: "sanction_companion",
              reason_code: "selected_sanction_role",
            },
            {
              law_id: "law-adv",
              law_family: "advocacy_law",
              article_number: "5",
              marker: "ч. 4",
              part_number: "4",
              relation_type: "exception",
              reason_code: "article_segment_refusal_ground_signal",
            },
          ],
          excluded_article_segments: [],
          bundle_projection_excluded_items: [],
        },
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "forbiddenCompanionAsPrimary",
          status: "failed",
        }),
        expect.objectContaining({
          key: "failIfSanctionWithoutBaseRule",
          status: "failed",
        }),
        expect.objectContaining({
          key: "failIfExceptionWithoutBaseRule",
          status: "failed",
        }),
      ]),
    );
  });

  it("проверяет attorney_rights companion expectations через procedure_companion без exact article target", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        requiredLawFamilies: ["advocacy_law"],
        requiredNormRoles: ["primary_basis"],
        minPrimaryBasisNorms: 1,
        expectedDirectBasisStatus: "direct_basis_present",
        activateCompanionChecks: true,
        requiredCompanionRelations: ["procedure_companion"],
        forbiddenCompanionAsPrimary: ["procedure_companion"],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            law_family: "advocacy_law",
            norm_role: "primary_basis",
          },
          {
            law_id: "law-proc",
            law_version: "version-1",
            law_block_id: "block-proc",
            law_family: "procedural_code",
            norm_role: "procedure",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
        norm_bundle_diagnostics: {
          companion_relation_types: ["procedure_companion"],
          missing_expected_companion: [],
          included_article_segments: [
            {
              law_id: "law-proc",
              law_family: "procedural_code",
              article_number: "23.1",
              marker: "ч. 1",
              part_number: "1",
              relation_type: "procedure_companion",
              reason_code: "selected_procedure_role",
            },
          ],
          excluded_article_segments: [],
          bundle_projection_excluded_items: [],
        },
      },
    });

    expect(result.passed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredCompanionRelations",
          status: "passed",
        }),
        expect.objectContaining({
          key: "forbiddenCompanionAsPrimary",
          status: "passed",
        }),
      ]),
    );
  });

  it("проваливает attorney_rights expectation при отсутствии обязательного procedure_companion", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        activateCompanionChecks: true,
        requiredCompanionRelations: ["procedure_companion"],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            law_family: "advocacy_law",
            norm_role: "primary_basis",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-adv",
            law_version: "version-1",
            law_block_id: "block-adv",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
        norm_bundle_diagnostics: {
          companion_relation_types: [],
          missing_expected_companion: ["procedure_companion"],
          included_article_segments: [],
          excluded_article_segments: [],
          bundle_projection_excluded_items: [],
        },
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredCompanionRelations",
          status: "failed",
        }),
      ]),
    );
  });

  it("проваливает attorney_rights negative case, если procedure_companion подменяет base rule", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        activateCompanionChecks: true,
        forbiddenCompanionAsPrimary: ["procedure_companion"],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-proc",
            law_version: "version-1",
            law_block_id: "block-proc",
            law_family: "procedural_code",
            norm_role: "procedure",
          },
        ],
        primary_basis_eligibility: [],
        direct_basis_status: "partial_basis_only",
        norm_bundle_diagnostics: {
          companion_relation_types: ["procedure_companion"],
          missing_expected_companion: [],
          included_article_segments: [
            {
              law_id: "law-proc",
              law_family: "procedural_code",
              article_number: "23.1",
              marker: "ч. 1",
              part_number: "1",
              relation_type: "procedure_companion",
              reason_code: "selected_procedure_role",
            },
          ],
          excluded_article_segments: [],
          bundle_projection_excluded_items: [],
        },
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "forbiddenCompanionAsPrimary",
          status: "failed",
        }),
      ]),
    );
  });

  it("использует существующие checks против wrong family primary для attorney_rights", () => {
    const result = evaluateScenarioExpectations({
      expectationProfile: {
        requiredLawFamilies: ["advocacy_law"],
        minPrimaryBasisNorms: 1,
        forbiddenPrimaryBasis: [
          {
            lawFamily: "government_code",
            lawTitleIncludes: ["прокурор", "огп"],
          },
        ],
      },
      snapshot: {
        selected_norm_roles: [
          {
            law_id: "law-ogp",
            law_version: "version-1",
            law_block_id: "block-ogp",
            law_family: "government_code",
            norm_role: "primary_basis",
          },
        ],
        primary_basis_eligibility: [
          {
            law_id: "law-ogp",
            law_version: "version-1",
            law_block_id: "block-ogp",
            primary_basis_eligibility: "eligible",
          },
        ],
        direct_basis_status: "direct_basis_present",
        used_sources: [
          {
            source_kind: "law",
            law_id: "law-ogp",
            law_name: "Закон об ОГП",
            article_number: "17",
          },
        ],
      },
    });

    expect(result.failed_expectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "requiredLawFamilies",
          status: "failed",
        }),
        expect.objectContaining({
          key: "forbiddenPrimaryBasis",
          status: "failed",
        }),
      ]),
    );
  });
});
