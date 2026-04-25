import { describe, expect, it } from "vitest";

import { buildLegalGroundingDiagnostics } from "@/server/legal-core/legal-diagnostics";
import { buildLegalQueryPlan } from "@/server/legal-core/legal-query-plan";
import {
  classifyLawFamily,
  selectStructuredLegalContext,
} from "@/server/legal-core/legal-selection";

describe("ai legal core selection", () => {
  it("делает title-first family classification для advocacy и не относит ОГП к advocacy_law", () => {
    expect(
      classifyLawFamily({
        serverId: "server-1",
        lawId: "law-advocacy",
        lawKey: "advocacy_law",
        lawTitle: "Закон об адвокатуре и адвокатской деятельности",
        lawVersionId: "version-1",
        lawBlockId: "block-advocacy",
        blockType: "article",
        blockText: "Адвокатский запрос направляется в порядке, установленном законом.",
        articleNumberNormalized: "5",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
      }),
    ).toBe("advocacy_law");

    expect(
      classifyLawFamily({
        serverId: "server-1",
        lawId: "law-ogp",
        lawKey: "ogp_law",
        lawTitle: "Закон «О деятельности офиса Генерального прокурора»",
        lawVersionId: "version-1",
        lawBlockId: "block-ogp",
        blockType: "article",
        blockText: "ОГП вправе проводить переаттестацию адвокатов при наличии оснований.",
        articleNumberNormalized: "26",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/ogp",
      }),
    ).toBe("government_code");

    expect(
      classifyLawFamily({
        serverId: "server-1",
        lawId: "law-ethics",
        lawKey: "government_ethics_code",
        lawTitle: "Этический кодекс штата Сан-Андреас",
        lawVersionId: "version-1",
        lawBlockId: "block-ethics",
        blockType: "article",
        blockText: "Государственный служащий обязан соблюдать этические стандарты.",
        articleNumberNormalized: "12",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/ethics",
      }),
    ).toBe("ethics_code");

    expect(
      classifyLawFamily({
        serverId: "server-1",
        lawId: "law-prison",
        lawKey: "prison_department",
        lawTitle: "Закон «Об Управлении тюрем Штата Сан-Андреас»",
        lawVersionId: "version-1",
        lawBlockId: "block-prison",
        blockType: "article",
        blockText: "Сотрудники Управления тюрем исполняют ведомственные полномочия.",
        articleNumberNormalized: "17.1",
        sourceTopicUrl: "https://forum.gta5rp.com/threads/prison",
      }),
    ).toBe("department_specific");
  });

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
          blockText:
            "Использование масок и средств маскировки, затрудняющих установление личности, запрещено и влечёт штраф.",
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
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-admin"]);
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

  it("не даёт bodycam noise поднимать direct_basis_present без прямой нормы о записи", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "Если сотрудник не вел бодикам это нарушение",
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
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Государственный служащий обязан надлежаще исполнять служебные обязанности.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-guard",
          lawKey: "national_guard",
          lawTitle: "Закон о Национальной Гвардии штата Сан-Андреас",
          lawVersionId: "version-1",
          lawBlockId: "block-guard",
          blockType: "article",
          blockText: "Военнослужащий обязан соблюдать порядок применения силы и докладывать о действиях.",
          articleNumberNormalized: "25",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/guard",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "При задержании разъясняются права и фиксируется порядок действий.",
          articleNumberNormalized: "19",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
      ],
    });

    expect(selection.direct_basis_status).toBe("partial_basis_only");
    expect(selection.primary_basis_norms).toEqual([]);
  });

  it("не делает direct primary basis из общих primary норм, если plan требует attorney_request", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "Если руководство не ответило на адвокатский запрос",
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
          lawId: "law-ak",
          lawKey: "administrative_code",
          lawTitle: "Административный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-ak",
          blockType: "article",
          blockText: "Неисполнение служебных обязанностей влечёт штраф.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ak",
        },
        {
          serverId: "server-1",
          lawId: "law-ethics",
          lawKey: "government_ethics_code",
          lawTitle: "Этический кодекс штата Сан-Андреас",
          lawVersionId: "version-1",
          lawBlockId: "block-ethics",
          blockType: "article",
          blockText: "Государственный служащий обязан исполнять служебные обязанности надлежащим образом.",
          articleNumberNormalized: "12",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ethics",
        },
      ],
    });

    expect(selection.primary_basis_norms).toEqual([]);
    expect(selection.direct_basis_status).toBe("partial_basis_only");
  });

  it("не считает ОГП primary basis для вопроса про адвоката при задержании", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "Что делать если не дали адвоката при задержании",
      intent: "complaint_strategy",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-ogp",
          lawKey: "ogp_law",
          lawTitle: "Закон «О деятельности офиса Генерального прокурора»",
          lawVersionId: "version-1",
          lawBlockId: "block-ogp",
          blockType: "article",
          blockText: "ОГП проводит переаттестацию адвокатов при наличии оснований.",
          articleNumberNormalized: "26",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ogp",
        },
        {
          serverId: "server-1",
          lawId: "law-advocacy",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy",
          blockType: "article",
          blockText: "Задержанному обеспечивается право на защитника и допуск адвоката.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
      ],
    });

    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-advocacy"]);
    expect(selection.selected_norm_roles).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-ogp",
          law_family: "advocacy_law",
        }),
      ]),
    );
  });

  it("оставляет закон об адвокатуре primary basis для адвокатского запроса, а санкции — supporting", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "Если руководство не ответило на адвокатский запрос",
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
          lawId: "law-advocacy",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy",
          blockType: "article",
          blockText:
            "Официальный адвокатский запрос подлежит обязательному рассмотрению. Ответ даётся в установленный срок.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
        {
          serverId: "server-1",
          lawId: "law-ak",
          lawKey: "administrative_code",
          lawTitle: "Административный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-ak",
          blockType: "article",
          blockText: "Неисполнение служебных обязанностей влечёт штраф.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ak",
        },
        {
          serverId: "server-1",
          lawId: "law-ethics",
          lawKey: "ethics_code",
          lawTitle: "Этический кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-ethics",
          blockType: "article",
          blockText: "Государственный служащий обязан исполнять служебные обязанности надлежащим образом.",
          articleNumberNormalized: "12",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ethics",
        },
      ],
    });

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-advocacy"]);
    expect(selection.selected_norm_roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-ak",
          norm_role: "sanction",
        }),
      ]),
    );
  });
});
