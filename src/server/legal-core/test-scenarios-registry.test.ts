import { describe, expect, it } from "vitest";

import {
  getAILegalCoreScenarioSuiteGroups,
  getAILegalCoreTestScenarioById,
  listActiveAILegalCoreTestScenariosByGroup,
  listActiveAILegalCoreTestScenariosBySuiteGroup,
} from "@/server/legal-core/test-scenarios-registry";

function readScenarioIds(suiteGroup: Parameters<typeof listActiveAILegalCoreTestScenariosBySuiteGroup>[0]) {
  return listActiveAILegalCoreTestScenariosBySuiteGroup(suiteGroup).map((scenario) => scenario.id);
}

function readScenarioVariants(
  suiteGroup: Parameters<typeof listActiveAILegalCoreTestScenariosBySuiteGroup>[0],
) {
  return listActiveAILegalCoreTestScenariosBySuiteGroup(suiteGroup).map(
    (scenario) => scenario.scenarioVariant,
  );
}

describe("ai legal core test scenarios registry", () => {
  it("сохраняет совместимость со старыми scenario groups", () => {
    const scenarios = listActiveAILegalCoreTestScenariosByGroup("general_legal_questions");

    expect(scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "general-mask-detention",
          scenarioGroup: "general_legal_questions",
        }),
        expect.objectContaining({
          id: "general-no-bodycam",
          scenarioGroup: "general_legal_questions",
        }),
      ]),
    );
  });

  it("поддерживает suite-oriented groups и наполняет active suites репрезентативными сценариями", () => {
    const suiteGroups = getAILegalCoreScenarioSuiteGroups();

    expect(suiteGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "mask_and_identity" }),
        expect.objectContaining({ key: "bodycam_and_recording" }),
        expect.objectContaining({ key: "attorney_rights" }),
        expect.objectContaining({ key: "attorney_request" }),
        expect.objectContaining({ key: "detention_procedure" }),
        expect.objectContaining({ key: "bad_input_and_slang" }),
        expect.objectContaining({ key: "hallucination_pressure" }),
        expect.objectContaining({ key: "multi_server_variance" }),
      ]),
    );

    expect(readScenarioIds("mask_and_identity")).toEqual(
      ["general-mask-detention", "self-mask-detention-complaint"],
    );
    expect(readScenarioVariants("mask_and_identity")).toEqual(
      expect.arrayContaining(["general_short", "self"]),
    );

    expect(readScenarioIds("bodycam_and_recording")).toEqual(
      expect.arrayContaining([
        "general-no-bodycam",
        "alt-bodycam-recording-duty",
        "attorney-requested-detention-record",
        "citizen-requested-detention-record",
      ]),
    );
    expect(readScenarioVariants("bodycam_and_recording")).toEqual(
      expect.arrayContaining(["general_short", "representative", "alt_phrasing"]),
    );

    expect(readScenarioIds("attorney_rights")).toEqual(
      [
        "alt-attorney-admit-defender-on-detention",
        "self-no-lawyer-on-detention",
        "trustor-no-call",
      ],
    );
    expect(readScenarioVariants("attorney_rights")).toEqual(
      expect.arrayContaining(["self", "representative", "alt_phrasing"]),
    );

    expect(readScenarioIds("attorney_request")).toEqual(
      [
        "general-no-response-to-attorney-request",
        "alt-attorney-request-deadline",
        "hallucination-attorney-request-crime",
      ],
    );
    expect(readScenarioVariants("attorney_request")).toEqual(
      expect.arrayContaining([
        "general_short",
        "alt_phrasing",
        "hallucination_probe",
      ]),
    );

    expect(readScenarioIds("detention_procedure")).toEqual(
      [
        "general-when-detention-allowed",
        "self-detained-without-reason",
        "insufficient-illegal-detention",
      ],
    );
    expect(readScenarioVariants("detention_procedure")).toEqual(
      expect.arrayContaining(["general_short", "self", "incomplete_facts"]),
    );

    expect(readScenarioIds("bad_input_and_slang")).toEqual(
      ["slang-took-me-for-nothing", "slang-trustor-no-bodycam"],
    );
    expect(readScenarioVariants("bad_input_and_slang")).toEqual(
      expect.arrayContaining(["slang"]),
    );

    expect(readScenarioIds("hallucination_pressure")).toEqual(
      ["hallucination-add-bodycam", "hallucination-add-violence"],
    );
    expect(readScenarioVariants("hallucination_pressure")).toEqual(
      expect.arrayContaining(["hallucination_probe"]),
    );

    expect(readScenarioIds("mask_and_identity")).toHaveLength(2);
    expect(readScenarioIds("bodycam_and_recording")).toHaveLength(4);
    expect(readScenarioIds("attorney_rights")).toHaveLength(3);
    expect(readScenarioIds("attorney_request")).toHaveLength(3);
    expect(readScenarioIds("detention_procedure")).toHaveLength(3);
    expect(readScenarioIds("bad_input_and_slang")).toHaveLength(2);
    expect(readScenarioIds("hallucination_pressure")).toHaveLength(2);
  });

  it("сохраняет expectationProfile для ключевых suite groups и не утверждает runtime NormBundle", () => {
    const maskScenario = getAILegalCoreTestScenarioById("general-mask-detention");
    const bodycamScenario = getAILegalCoreTestScenarioById("attorney-requested-detention-record");
    const attorneyRightsScenario = getAILegalCoreTestScenarioById("self-no-lawyer-on-detention");
    const attorneyRequestScenario = getAILegalCoreTestScenarioById(
      "general-no-response-to-attorney-request",
    );
    const attorneyRequestDeadlineScenario = getAILegalCoreTestScenarioById(
      "alt-attorney-request-deadline",
    );
    const attorneyRequestHallucinationScenario = getAILegalCoreTestScenarioById(
      "hallucination-attorney-request-crime",
    );
    const detentionScenario = getAILegalCoreTestScenarioById("general-when-detention-allowed");
    const slangScenario = getAILegalCoreTestScenarioById("slang-took-me-for-nothing");
    const otherServerScenario = getAILegalCoreTestScenarioById("general-attorney-request-other-server");
    const trustorNoCallScenario = getAILegalCoreTestScenarioById("trustor-no-call");

    expect(maskScenario).toMatchObject({
      suiteGroup: "mask_and_identity",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["administrative_code"],
        requiredNormRoles: ["primary_basis"],
        forbiddenLawFamilies: ["public_assembly_law"],
        expectedDirectBasisStatus: "direct_basis_present",
      }),
    });
    expect(maskScenario?.expectationProfile?.notesForReview).toEqual(
      expect.arrayContaining([
        expect.stringContaining("маск"),
        expect.stringContaining("Procedure"),
      ]),
    );

    expect(bodycamScenario).toMatchObject({
      suiteGroup: "bodycam_and_recording",
      expectationProfile: expect.objectContaining({
        forbiddenLawFamilies: ["department_specific"],
        expectedDirectBasisStatus: "partial_basis_only",
        forbiddenPrimaryBasis: [expect.objectContaining({ lawFamily: "government_code" })],
      }),
    });

    expect(attorneyRightsScenario).toMatchObject({
      suiteGroup: "attorney_rights",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["advocacy_law"],
        requiredNormRoles: ["primary_basis"],
        forbiddenPrimaryBasis: [
          expect.objectContaining({
            lawFamily: "government_code",
            lawTitleIncludes: ["прокурор", "огп"],
          }),
        ],
      }),
    });

    expect(attorneyRequestScenario).toMatchObject({
      suiteGroup: "attorney_request",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["advocacy_law"],
        requiredNormRoles: ["primary_basis"],
        activateCompanionChecks: true,
        requiredCompanionRelations: ["procedure_companion", "sanction_companion"],
        requiredCompanionTargets: expect.arrayContaining([
          expect.objectContaining({
            relationType: "procedure_companion",
            articleNumber: "5",
            partNumber: "2",
          }),
          expect.objectContaining({
            relationType: "sanction_companion",
            articleNumber: "5",
            partNumber: "5",
          }),
        ]),
        forbiddenPrimaryBasis: expect.arrayContaining([
          expect.objectContaining({ lawFamily: "ethics_code" }),
          expect.objectContaining({ lawFamily: "government_code" }),
        ]),
        forbiddenCompanionAsPrimary: ["sanction_companion", "exception"],
      }),
    });

    expect(attorneyRequestDeadlineScenario).toMatchObject({
      suiteGroup: "attorney_request",
      expectationProfile: expect.objectContaining({
        activateCompanionChecks: true,
        requiredCompanionRelations: ["procedure_companion"],
        requiredCompanionTargets: [
          expect.objectContaining({
            relationType: "procedure_companion",
            articleNumber: "5",
            partNumber: "2",
            allowCoveredByPrimaryExcerpt: true,
          }),
        ],
      }),
    });

    expect(attorneyRequestHallucinationScenario).toMatchObject({
      suiteGroup: "attorney_request",
      expectationProfile: expect.objectContaining({
        activateCompanionChecks: true,
        requiredCompanionRelations: ["procedure_companion", "sanction_companion"],
      }),
    });

    expect(detentionScenario).toMatchObject({
      suiteGroup: "detention_procedure",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["procedural_code"],
        requiredNormRoles: ["procedure"],
      }),
    });

    expect(slangScenario).toMatchObject({
      suiteGroup: "bad_input_and_slang",
      expectationProfile: expect.objectContaining({
        maxTokens: 1800,
      }),
    });

    expect(otherServerScenario).toMatchObject({
      suiteGroup: "multi_server_variance",
      scenarioVariant: "other_server",
      serverSelectionHint: "run_on_multiple_servers",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["advocacy_law"],
      }),
    });

    expect(trustorNoCallScenario).toMatchObject({
      suiteGroup: "attorney_rights",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["procedural_code"],
        forbiddenPrimaryBasis: [expect.objectContaining({ lawFamily: "advocacy_law" })],
      }),
    });

    expect(maskScenario?.expectationProfile?.expectedNormBundle).toBeUndefined();
  });

  it("companion expectation fields вне attorney_request могут оставаться future-oriented без активации checks", () => {
    const scenario = getAILegalCoreTestScenarioById("general-mask-detention");

    expect(scenario?.expectationProfile).toMatchObject({
      requiredCompanionRelations: ["procedure_companion"],
    });
    expect(scenario?.expectationProfile?.activateCompanionChecks).toBeUndefined();
  });

  it("деактивированные сценарии сохраняют compatibility по id, но не попадают в active suite selection", () => {
    const deactivatedScenarioIds = [
      "trustor-attorney-request-no-response",
      "self-no-detention-recording",
      "trustor-no-bodycam-record",
      "general-no-lawyer-on-detention",
      "trustor-no-lawyer-on-detention",
      "alt-detention-state-reason",
      "self-just-locked-up",
      "alt-mask-formalize-person",
      "trustor-mask-ogp",
      "hallucination-mask-invent-article",
      "slang-locked-me-up",
      "slang-trustor-article",
      "slang-kpz",
      "hallucination-invent-article",
      "hallucination-definitely-guilty",
    ];

    for (const scenarioId of deactivatedScenarioIds) {
      expect(getAILegalCoreTestScenarioById(scenarioId)).toMatchObject({
        id: scenarioId,
        isActive: false,
      });
    }

    expect(readScenarioIds("attorney_request")).not.toContain("trustor-attorney-request-no-response");
    expect(readScenarioIds("bodycam_and_recording")).not.toContain("self-no-detention-recording");
    expect(readScenarioIds("bodycam_and_recording")).not.toContain("trustor-no-bodycam-record");
    expect(readScenarioIds("attorney_rights")).not.toContain("general-no-lawyer-on-detention");
    expect(readScenarioIds("attorney_rights")).not.toContain("trustor-no-lawyer-on-detention");
    expect(readScenarioIds("detention_procedure")).not.toContain("alt-detention-state-reason");
    expect(readScenarioIds("detention_procedure")).not.toContain("self-just-locked-up");
    expect(readScenarioIds("mask_and_identity")).not.toContain("alt-mask-formalize-person");
    expect(readScenarioIds("mask_and_identity")).not.toContain("trustor-mask-ogp");
    expect(readScenarioIds("mask_and_identity")).not.toContain("hallucination-mask-invent-article");
    expect(readScenarioIds("bad_input_and_slang")).not.toContain("slang-locked-me-up");
    expect(readScenarioIds("bad_input_and_slang")).not.toContain("slang-trustor-article");
    expect(readScenarioIds("bad_input_and_slang")).not.toContain("slang-kpz");
    expect(readScenarioIds("hallucination_pressure")).not.toContain("hallucination-invent-article");
    expect(readScenarioIds("hallucination_pressure")).not.toContain("hallucination-definitely-guilty");
  });
});
