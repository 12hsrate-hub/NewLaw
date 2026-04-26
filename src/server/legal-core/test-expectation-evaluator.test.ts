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

  it("возвращает future_reserved для companion-related expectation fields", () => {
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
          key: "expectedNormBundle",
          status: "future_reserved",
        }),
        expect.objectContaining({
          key: "forbiddenCompanionAsPrimary",
          status: "future_reserved",
        }),
        expect.objectContaining({
          key: "missingCompanionWarning",
          status: "future_reserved",
        }),
      ]),
    );
  });
});
