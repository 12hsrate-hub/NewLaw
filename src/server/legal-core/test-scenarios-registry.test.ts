import { describe, expect, it } from "vitest";

import {
  getAILegalCoreScenarioSuiteGroups,
  getAILegalCoreTestScenarioById,
  listActiveAILegalCoreTestScenariosByGroup,
  listActiveAILegalCoreTestScenariosBySuiteGroup,
} from "@/server/legal-core/test-scenarios-registry";

describe("ai legal core test scenarios registry", () => {
  it("сохраняет совместимость со старыми scenario groups", () => {
    const scenarios = listActiveAILegalCoreTestScenariosByGroup("general_legal_questions");

    expect(scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "general-mask-detention",
          scenarioGroup: "general_legal_questions",
        }),
      ]),
    );
  });

  it("поддерживает suite-oriented groups и новые registry fields", () => {
    const suiteGroups = getAILegalCoreScenarioSuiteGroups();
    const scenario = getAILegalCoreTestScenarioById("general-mask-detention");
    const suiteScenarios = listActiveAILegalCoreTestScenariosBySuiteGroup("mask_and_identity");

    expect(suiteGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "mask_and_identity",
        }),
        expect.objectContaining({
          key: "bodycam_and_recording",
        }),
      ]),
    );
    expect(scenario).toMatchObject({
      id: "general-mask-detention",
      suiteGroup: "mask_and_identity",
      scenarioVariant: "general_short",
      semanticCluster: "mask_detention",
      runTarget: "server_legal_assistant",
      lawVersionSelectionHint: "current_snapshot_only",
      expectationProfile: expect.objectContaining({
        requiredLawFamilies: ["administrative_code"],
        requiredNormRoles: ["primary_basis"],
        expectedDirectBasisStatus: "direct_basis_present",
      }),
    });
    expect(suiteScenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "general-mask-detention",
        }),
      ]),
    );
  });

  it("future companion fields могут присутствовать в expectation profile без обязательной runtime реализации", () => {
    const scenario = getAILegalCoreTestScenarioById("general-mask-detention");

    expect(scenario?.expectationProfile).toMatchObject({
      requiredCompanionRelations: ["procedure_companion"],
    });
  });
});
