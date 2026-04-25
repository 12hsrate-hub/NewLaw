import { describe, expect, it } from "vitest";

import { buildLegalGroundingDiagnostics } from "@/server/legal-core/legal-diagnostics";
import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import { selectStructuredLegalContext } from "@/server/legal-core/legal-selection";

describe("ai legal core selection", () => {
  it("строит LegalQueryPlan и retrieval anchors для вопроса про маску и задержание", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "Можно ли задержать человека за ношение маски?",
      intent: "situation_analysis",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    expect(plan.legal_anchors).toEqual(
      expect.arrayContaining(["administrative_offense", "detention_procedure", "sanction"]),
    );
    expect(plan.required_law_families).toEqual(
      expect.arrayContaining(["administrative_code", "procedural_code"]),
    );
    expect(plan.preferred_norm_roles).toEqual(
      expect.arrayContaining(["primary_basis", "procedure", "sanction"]),
    );
    expect(plan.expanded_query).toContain("административный кодекс");
  });

  it("делает structured selection и не выбирает off-topic norm как primary basis", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "Можно ли задержать человека за ношение маски?",
      intent: "situation_analysis",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-assembly",
          lawKey: "assembly",
          lawTitle: "Закон о публичных мероприятиях",
          lawVersionId: "version-1",
          lawBlockId: "block-assembly",
          blockType: "article",
          blockText: "Порядок проведения митингов и публичных мероприятий.",
          articleNumberNormalized: "12",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/assembly",
        },
        {
          serverId: "server-1",
          lawId: "law-admin",
          lawKey: "ak-18",
          lawTitle: "Административный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-admin",
          blockType: "article",
          blockText: "Использование масок запрещено в общественных местах и влечёт штраф.",
          articleNumberNormalized: "18",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/admin",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure",
          lawKey: "pk-23_1",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "При отказе оплатить штраф допускается задержание и идентификация личности.",
          articleNumberNormalized: "23.1",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
      ],
    });

    const diagnostics = buildLegalGroundingDiagnostics({
      plan,
      selection,
    });

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(
      expect.arrayContaining(["law-admin", "law-procedure"]),
    );
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).not.toContain("law-assembly");
    expect(selection.selected_norm_roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-admin",
          law_family: "administrative_code",
        }),
      ]),
    );
    expect(diagnostics.grounding_diagnostics.flags).not.toContain("missing_primary_basis_norm");
  });
});
