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

  it("поддерживает suite-oriented groups и наполняет их несколькими вариантами сценариев", () => {
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
      expect.arrayContaining([
        "general-mask-detention",
        "self-mask-detention-complaint",
        "alt-mask-formalize-person",
        "hallucination-mask-invent-article",
      ]),
    );
    expect(readScenarioVariants("mask_and_identity")).toEqual(
      expect.arrayContaining(["general_short", "self", "alt_phrasing", "hallucination_probe"]),
    );

    expect(readScenarioIds("bodycam_and_recording")).toEqual(
      expect.arrayContaining([
        "general-no-bodycam",
        "self-no-detention-recording",
        "trustor-no-bodycam-record",
        "alt-bodycam-recording-duty",
      ]),
    );
    expect(readScenarioVariants("bodycam_and_recording")).toEqual(
      expect.arrayContaining(["general_short", "self", "representative", "alt_phrasing"]),
    );

    expect(readScenarioIds("attorney_rights")).toEqual(
      expect.arrayContaining([
        "general-no-lawyer-on-detention",
        "self-no-lawyer-on-detention",
        "trustor-no-lawyer-on-detention",
        "alt-attorney-admit-defender-on-detention",
      ]),
    );
    expect(readScenarioVariants("attorney_rights")).toEqual(
      expect.arrayContaining(["general_short", "self", "representative", "alt_phrasing"]),
    );

    expect(readScenarioIds("attorney_request")).toEqual(
      expect.arrayContaining([
        "general-no-response-to-attorney-request",
        "trustor-attorney-request-no-response",
        "alt-attorney-request-deadline",
        "hallucination-attorney-request-crime",
      ]),
    );
    expect(readScenarioVariants("attorney_request")).toEqual(
      expect.arrayContaining([
        "general_short",
        "representative",
        "alt_phrasing",
        "hallucination_probe",
      ]),
    );

    expect(readScenarioIds("detention_procedure")).toEqual(
      expect.arrayContaining([
        "general-when-detention-allowed",
        "self-detained-without-reason",
        "alt-detention-state-reason",
        "self-just-locked-up",
      ]),
    );
    expect(readScenarioVariants("detention_procedure")).toEqual(
      expect.arrayContaining(["general_short", "self", "alt_phrasing", "incomplete_facts"]),
    );

    expect(readScenarioIds("bad_input_and_slang")).toEqual(
      expect.arrayContaining([
        "slang-took-me-for-nothing",
        "slang-trustor-no-bodycam",
        "slang-kpz",
      ]),
    );
    expect(readScenarioVariants("bad_input_and_slang")).toEqual(
      expect.arrayContaining(["slang"]),
    );

    expect(readScenarioIds("hallucination_pressure")).toEqual(
      expect.arrayContaining([
        "hallucination-invent-article",
        "hallucination-add-bodycam",
        "hallucination-definitely-guilty",
        "hallucination-add-violence",
      ]),
    );
    expect(readScenarioVariants("hallucination_pressure")).toEqual(
      expect.arrayContaining(["hallucination_probe"]),
    );

    expect(readScenarioIds("mask_and_identity")).toHaveLength(5);
    expect(readScenarioIds("bodycam_and_recording")).toHaveLength(4);
    expect(readScenarioIds("attorney_rights")).toHaveLength(5);
    expect(readScenarioIds("attorney_request")).toHaveLength(4);
    expect(readScenarioIds("detention_procedure")).toHaveLength(5);
    expect(readScenarioIds("bad_input_and_slang")).toHaveLength(5);
    expect(readScenarioIds("hallucination_pressure")).toHaveLength(4);
  });

  it("сохраняет expectationProfile для ключевых suite groups и не утверждает runtime NormBundle", () => {
    const maskScenario = getAILegalCoreTestScenarioById("general-mask-detention");
    const bodycamScenario = getAILegalCoreTestScenarioById("general-no-bodycam");
    const attorneyRightsScenario = getAILegalCoreTestScenarioById(
      "general-no-lawyer-on-detention",
    );
    const attorneyRequestScenario = getAILegalCoreTestScenarioById(
      "general-no-response-to-attorney-request",
    );
    const detentionScenario = getAILegalCoreTestScenarioById("general-when-detention-allowed");
    const slangScenario = getAILegalCoreTestScenarioById("slang-took-me-for-nothing");
    const otherServerScenario = getAILegalCoreTestScenarioById("general-attorney-request-other-server");

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
        forbiddenPrimaryBasis: expect.arrayContaining([
          expect.objectContaining({ lawFamily: "ethics_code" }),
          expect.objectContaining({ lawFamily: "government_code" }),
        ]),
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

    expect(maskScenario?.expectationProfile?.expectedNormBundle).toBeUndefined();
  });

  it("future companion fields могут присутствовать в expectation profile без обязательной runtime реализации", () => {
    const scenario = getAILegalCoreTestScenarioById("general-mask-detention");

    expect(scenario?.expectationProfile).toMatchObject({
      requiredCompanionRelations: ["procedure_companion"],
    });
  });
});
