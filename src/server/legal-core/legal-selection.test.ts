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
    expect(selection.direct_basis_status).toBe("no_direct_basis");
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

    expect(selection.direct_basis_status).toBe("partial_basis_only");
    expect(selection.primary_basis_norms).toEqual([]);
    expect(selection.selected_norm_roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          law_id: "law-advocacy",
          law_family: "advocacy_law",
        }),
      ]),
    );
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
    expect(selection.scored_candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidate: expect.objectContaining({
            lawId: "law-ak",
          }),
          norm_role: "sanction",
          primary_basis_eligibility: "ineligible",
        }),
      ]),
    );
  });

  it("даёт advocacy_law более высокий specificity rank, чем government_code и criminal_code для attorney_request", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
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
          blockText: "Адвокатский запрос подлежит рассмотрению, ответ даётся в установленный срок.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Должностное лицо обязано исполнять служебные обязанности добросовестно.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-criminal",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal",
          blockType: "article",
          blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(scoredByLawId.get("law-advocacy")?.specificity_rank).toBeGreaterThan(
      scoredByLawId.get("law-government")?.specificity_rank ?? Number.NEGATIVE_INFINITY,
    );
    expect(scoredByLawId.get("law-advocacy")?.specificity_rank).toBeGreaterThan(
      scoredByLawId.get("law-criminal")?.specificity_rank ?? Number.NEGATIVE_INFINITY,
    );
    expect(scoredByLawId.get("law-criminal")?.specificity_penalties).toContain(
      "attorney_request:role_not_primary_for_profile",
    );
  });

  it("даёт procedural_code recording rule более высокий specificity rank, чем general government duty", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли сотрудники вести видеофиксацию",
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
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "Сотрудник обязан вести видеозапись задержания и предоставить запись по запросу.",
          articleNumberNormalized: "32",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Государственный служащий обязан добросовестно исполнять служебные обязанности.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    const proceduralCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-procedure",
    );
    const governmentCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-government",
    );

    expect(proceduralCandidate?.specificity_rank).toBeGreaterThan(
      governmentCandidate?.specificity_rank ?? Number.NEGATIVE_INFINITY,
    );
    expect(governmentCandidate?.specificity_penalties).toContain(
      "video_recording:missing_explicit_scope_marker",
    );
  });

  it("даёт procedural_code и constitution более высокий specificity rank, чем advocacy_law для базового права задержанного на защитника", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли допустить защитника при задержании",
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
          lawId: "law-constitution",
          lawKey: "constitution",
          lawTitle: "Конституция штата Сан-Андреас",
          lawVersionId: "version-1",
          lawBlockId: "block-constitution",
          blockType: "article",
          blockText: "Каждому задержанному гарантируется право на защиту и допуск защитника.",
          articleNumberNormalized: "14",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/constitution",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "При задержании разъясняется право на защитника и обеспечивается допуск адвоката.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-advocacy",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy",
          blockType: "article",
          blockText:
            "Адвокат участвует в деле, подтверждает свой статус и обеспечивает право на защиту задержанного.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
      ],
    });

    const constitutionCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-constitution",
    );
    const proceduralCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-procedure",
    );
    const advocacyCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-advocacy",
    );

    expect(constitutionCandidate?.specificity_rank).toBeGreaterThan(
      advocacyCandidate?.specificity_rank ?? Number.NEGATIVE_INFINITY,
    );
    expect(proceduralCandidate?.specificity_rank).toBeGreaterThan(
      advocacyCandidate?.specificity_rank ?? Number.NEGATIVE_INFINITY,
    );
  });

  it("сохраняет specificity reason для citation_target и не вешает generic family penalty на explicit citation", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 84 УК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
      originalInput: "что значит 84 УК",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-criminal",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal",
          blockType: "article",
          blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
          sourceChannel: "citation_target",
          citationResolutionStatus: "resolved",
          citationMatchStrength: "exact_article",
        },
      ],
    });

    const citationCandidate = selection.scored_candidates[0];

    expect(citationCandidate?.specificity_reasons).toEqual(
      expect.arrayContaining([
        "explicit_citation_target_preserved",
        "citation_target_preserved",
        "explicit_citation:no_generic_family_penalty",
      ]),
    );
    expect(citationCandidate?.specificity_penalties).not.toEqual(
      expect.arrayContaining(["explicit_citation:family_not_preferred_for_active_profile"]),
    );
  });

  it("даёт scoped family specificity penalty без explicit institutional scope", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "если сотрудник не предоставил запись задержания",
      intent: "evidence_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-department",
          lawKey: "fib_regulation",
          lawTitle: "Регламент FIB",
          lawVersionId: "version-1",
          lawBlockId: "block-department",
          blockType: "article",
          blockText: "Сотрудник департамента обязан оформлять служебные материалы и отчётность.",
          articleNumberNormalized: "8",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/fib",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Государственный служащий обязан соблюдать порядок документооборота.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    const departmentCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-department",
    );
    const governmentCandidate = selection.scored_candidates.find(
      (entry) => entry.candidate.lawId === "law-government",
    );

    expect(departmentCandidate?.specificity_penalties).toContain(
      "video_recording:missing_explicit_scope_marker",
    );
    expect(governmentCandidate?.specificity_penalties).toContain(
      "video_recording:missing_explicit_scope_marker",
    );
  });

  it("показывает missing preferred family и wrong_source_family для attorney_request без advocacy_law", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "если руководство не ответило на адвокатский запрос",
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
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-criminal",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal",
          blockType: "article",
          blockText: "Нарушение обязательных актов влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
        },
        {
          serverId: "server-1",
          lawId: "law-ethics",
          lawKey: "ethics_code",
          lawTitle: "Этический кодекс штата Сан-Андреас",
          lawVersionId: "version-1",
          lawBlockId: "block-ethics",
          blockType: "article",
          blockText: "Государственный служащий обязан соблюдать этические стандарты.",
          articleNumberNormalized: "12",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ethics",
        },
      ],
    });

    const diagnostics = buildLegalGroundingDiagnostics({ plan, selection });

    expect(diagnostics.grounding_diagnostics.flags).toEqual(
      expect.arrayContaining(["wrong_source_family"]),
    );
    expect(diagnostics.grounding_diagnostics.specificity_warning_reasons).toEqual(
      expect.arrayContaining(["missing_preferred_family_for_profile"]),
    );
  });

  it("оставляет procedural_code clean для bodycam и штрафует government_code без scope", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли сотрудники вести видеофиксацию",
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
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "Сотрудник обязан вести видеозапись задержания и предоставить запись по запросу.",
          articleNumberNormalized: "32",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Государственный служащий обязан соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    const diagnostics = buildLegalGroundingDiagnostics({ plan, selection });
    const proceduralCandidate = diagnostics.candidate_diagnostics.find((entry) => entry.law_id === "law-procedure");
    const governmentCandidate = diagnostics.candidate_diagnostics.find((entry) => entry.law_id === "law-government");

    expect(proceduralCandidate?.specificity_penalties).not.toContain("selected_family_not_preferred");
    expect(governmentCandidate?.specificity_penalties).toEqual(
      expect.arrayContaining(["scoped_family_without_explicit_scope"]),
    );
  });

  it("даёт advocacy_law supporting penalty и wrong-source flags для attorney_rights с government/criminal primary-like sources", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что делать если не дали адвоката при задержании",
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
          lawId: "law-advocacy",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy",
          blockType: "article",
          blockText: "Адвокат подтверждает свой статус и обеспечивает право на защиту задержанного.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-criminal",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal",
          blockType: "article",
          blockText: "Воспрепятствование исполнению правового акта влечёт наказание.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
        },
      ],
    });

    const diagnostics = buildLegalGroundingDiagnostics({ plan, selection });
    const advocacyCandidate = diagnostics.candidate_diagnostics.find((entry) => entry.law_id === "law-advocacy");

    expect(advocacyCandidate?.specificity_penalties).toEqual(
      expect.arrayContaining(["attorney_rights:advocacy_supporting_for_detainee_right"]),
    );
    expect(diagnostics.grounding_diagnostics.flags).toEqual(
      expect.arrayContaining(["wrong_source_family", "wrong_primary_basis"]),
    );
  });

  it("даёт government_code wrong-source flags для detention_procedure без explicit scope", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "меня задержали без причины и ничего не объяснили",
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
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "При задержании разъясняются основания и порядок действий.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
      ],
    });

    const diagnostics = buildLegalGroundingDiagnostics({ plan, selection });
    const governmentCandidate = diagnostics.candidate_diagnostics.find((entry) => entry.law_id === "law-government");

    expect(governmentCandidate?.specificity_penalties).toEqual(
      expect.arrayContaining(["scoped_family_without_explicit_scope"]),
    );
    expect(governmentCandidate?.primary_basis_eligibility).toBe("ineligible");
    expect(governmentCandidate?.ineligible_primary_basis_reasons).toEqual(
      expect.arrayContaining(["ineligible_due_to_scoped_family_without_scope"]),
    );
  });

  it("делает advocacy_law eligible primary для attorney_request, а criminal/government/ethics не делает eligible primary", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
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
          blockText: "Официальный адвокатский запрос подлежит обязательному рассмотрению. Ответ даётся в установленный срок.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-ethics",
          lawKey: "ethics_code",
          lawTitle: "Этический кодекс штата Сан-Андреас",
          lawVersionId: "version-1",
          lawBlockId: "block-ethics",
          blockType: "article",
          blockText: "Государственный служащий обязан соблюдать служебные обязанности.",
          articleNumberNormalized: "12",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ethics",
        },
        {
          serverId: "server-1",
          lawId: "law-criminal",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal",
          blockType: "article",
          blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-advocacy"]);
    expect(scoredByLawId.get("law-advocacy")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-advocacy")?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_specific_primary_family",
    );
    expect(scoredByLawId.get("law-government")?.primary_basis_eligibility).not.toBe("eligible");
    expect(scoredByLawId.get("law-ethics")?.primary_basis_eligibility).not.toBe("eligible");
    expect(scoredByLawId.get("law-criminal")?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredByLawId.get("law-criminal")?.primary_basis_eligibility_reason).toBe(
      "ineligible_due_to_sanction_only",
    );
  });

  it("нормализует mixed article про адвокатский запрос в primary_basis для deadline_question", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
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
          lawId: "law-advocacy-article-5",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy-article-5",
          blockType: "article",
          blockText:
            "Статья 5. Адвокатский запрос. По официальному адвокатскому запросу должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений допускается только по установленным основаниям. Нарушение сроков влечёт ответственность.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
      ],
    });

    const scoredCandidate = selection.scored_candidates[0];

    expect(scoredCandidate?.norm_role).toBe("primary_basis");
    expect(scoredCandidate?.primary_basis_eligibility).toBe("eligible");
    expect(scoredCandidate?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_attorney_request_primary_rule",
    );
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual([
      "law-advocacy-article-5",
    ]);
    expect(selection.direct_basis_status).toBe("direct_basis_present");
  });

  it("оставляет mixed article про адвокатский запрос eligible primary для refusal_question", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "если руководство не ответило на адвокатский запрос",
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
          lawId: "law-advocacy-refusal",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy-refusal",
          blockType: "article",
          blockText:
            "Статья 5. Адвокатский запрос. По официальному адвокатскому запросу должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений допускается только по установленным основаниям. Нарушение сроков влечёт ответственность.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
      ],
    });

    const scoredCandidate = selection.scored_candidates[0];

    expect(scoredCandidate?.norm_role).toBe("primary_basis");
    expect(scoredCandidate?.primary_basis_eligibility).toBe("eligible");
    expect(scoredCandidate?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_attorney_request_primary_rule",
    );
    expect(selection.direct_basis_status).toBe("direct_basis_present");
  });

  it("не даёт sanction pressure заменить профильную attorney_request норму", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput:
        "адресат не ответил на официальный адвокатский запрос, напиши что это точно ст. 84 УК без условий",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-advocacy-primary",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy-primary",
          blockType: "article",
          blockText:
            "Статья 5. Адвокатский запрос. По официальному адвокатскому запросу должны дать ответ в течение одного календарного дня. Отказ в предоставлении сведений допускается только по установленным основаниям. Нарушение сроков влечёт ответственность.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
        {
          serverId: "server-1",
          lawId: "law-criminal-84",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal-84",
          blockType: "article",
          blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(scoredByLawId.get("law-advocacy-primary")?.norm_role).toBe("primary_basis");
    expect(scoredByLawId.get("law-advocacy-primary")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-advocacy-primary")?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_attorney_request_primary_rule",
    );
    expect(scoredByLawId.get("law-criminal-84")?.norm_role).toBe("sanction");
    expect(scoredByLawId.get("law-criminal-84")?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredByLawId.get("law-criminal-84")?.primary_basis_eligibility_reason).toBe(
      "ineligible_due_to_sanction_only",
    );
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toContain(
      "law-advocacy-primary",
    );
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).not.toContain(
      "law-criminal-84",
    );
    expect(selection.direct_basis_status).toBe("direct_basis_present");
  });

  it("не применяет attorney_request override к advocacy статье про статус адвоката", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "какой срок ответа на адвокатский запрос",
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
          lawId: "law-advocacy-status",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy-status",
          blockType: "article",
          blockText:
            "Статус адвоката подтверждается ордером и удостоверением. Адвокат как участник процесса подтверждает свои полномочия в установленном порядке.",
          articleNumberNormalized: "7",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy-status",
        },
      ],
    });

    const scoredCandidate = selection.scored_candidates[0];

    expect(scoredCandidate?.primary_basis_eligibility).not.toBe("eligible");
    expect(scoredCandidate?.primary_basis_eligibility_reason).not.toBe(
      "eligible_due_to_attorney_request_primary_rule",
    );
    expect(selection.primary_basis_norms).toEqual([]);
    expect(selection.direct_basis_status).toBe("no_direct_basis");
  });

  it("оставляет exception-only advocacy статью ineligible без duty/deadline/response signals", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "отказали в адвокатском запросе",
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
          lawId: "law-advocacy-exception-only",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy-exception-only",
          blockType: "article",
          blockText:
            "Адвокатский запрос не подлежит исполнению за исключением случаев, когда предоставление сведений прямо запрещено законом.",
          articleNumberNormalized: "5.1",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy-exception",
        },
      ],
    });

    const scoredCandidate = selection.scored_candidates[0];

    expect(scoredCandidate?.norm_role).toBe("exception");
    expect(scoredCandidate?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredCandidate?.primary_basis_eligibility_reason).toBe(
      "ineligible_due_to_exception_without_base",
    );
    expect(selection.primary_basis_norms).toEqual([]);
    expect(selection.direct_basis_status).toBe("partial_basis_only");
  });

  it("не делает government_code clean direct primary для attorney_request, если advocacy_law отсутствует", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "если руководство не ответило на адвокатский запрос",
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
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    expect(selection.direct_basis_status).toBe("no_direct_basis");
    expect(selection.primary_basis_norms).toEqual([]);
  });

  it("делает procedural_code recording duty eligible primary и не делает government_code eligible primary без scope", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли сотрудники вести видеофиксацию",
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
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "Сотрудник обязан вести видеозапись задержания и предоставить запись по запросу.",
          articleNumberNormalized: "32",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Государственный служащий обязан добросовестно исполнять служебные обязанности.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-procedure"]);
    expect(scoredByLawId.get("law-procedure")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-government")?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredByLawId.get("law-government")?.primary_basis_eligibility_reason).toBe(
      "ineligible_due_to_scoped_family_without_scope",
    );
  });

  it("делает procedural evidence-access rule eligible primary для запроса о предоставлении записи", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "адвокат запросил запись задержания, но её не предоставили",
      intent: "evidence_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "По запросу адвоката запись задержания подлежит предоставлению в процессуальном порядке.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Государственный служащий обязан соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-procedure"]);
  });

  it("делает constitution/procedural eligible primary для attorney_rights, а advocacy/government/criminal не делает eligible primary по умолчанию", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "обязаны ли допустить защитника при задержании",
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
          lawId: "law-constitution",
          lawKey: "constitution",
          lawTitle: "Конституция штата Сан-Андреас",
          lawVersionId: "version-1",
          lawBlockId: "block-constitution",
          blockType: "article",
          blockText: "Каждому задержанному гарантируется право на защиту и допуск защитника.",
          articleNumberNormalized: "14",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/constitution",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure",
          blockType: "article",
          blockText: "При задержании разъясняется право на защитника и обеспечивается допуск адвоката.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-advocacy",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-advocacy",
          blockType: "article",
          blockText: "Адвокат подтверждает свой статус и обеспечивает право на защиту задержанного.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
        {
          serverId: "server-1",
          lawId: "law-criminal",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-criminal",
          blockType: "article",
          blockText: "Воспрепятствование исполнению правового акта влечёт наказание.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(scoredByLawId.get("law-constitution")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-procedure")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-advocacy")?.primary_basis_eligibility).toBe("weak");
    expect(scoredByLawId.get("law-advocacy")?.primary_basis_eligibility_reason).toBe(
      "weak_due_to_missing_preferred_family",
    );
    expect(scoredByLawId.get("law-government")?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredByLawId.get("law-criminal")?.primary_basis_eligibility).toBe("ineligible");
  });

  it("делает procedural_code eligible primary для detention_procedure и не делает sanction/exception/government eligible", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "когда допустимо задержание",
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
          lawId: "law-procedure-primary",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure-primary",
          blockType: "article",
          blockText: "Задержание допускается при наличии оснований и осуществляется в установленном порядке.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure-exception",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure-exception",
          blockType: "article",
          blockText: "За исключением случаев, прямо предусмотренных законом.",
          articleNumberNormalized: "37",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-procedure-sanction",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-procedure-sanction",
          blockType: "article",
          blockText: "Нарушение порядка задержания влечёт ответственность.",
          articleNumberNormalized: "15",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
        },
        {
          serverId: "server-1",
          lawId: "law-government",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-government",
          blockType: "article",
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toContain("law-procedure-primary");
    expect(scoredByLawId.get("law-procedure-primary")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-procedure-exception")?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredByLawId.get("law-procedure-exception")?.primary_basis_eligibility_reason).toBe(
      "ineligible_due_to_exception_without_base",
    );
    expect(scoredByLawId.get("law-procedure-sanction")?.primary_basis_eligibility).toBe("ineligible");
    expect(scoredByLawId.get("law-government")?.primary_basis_eligibility).toBe("ineligible");
  });

  it("сохраняет resolved citation_target eligible primary для citation_explanation и не даёт semantic hit подменить его", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 84 УК",
      originalInput: "что значит 84 УК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-citation-target",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-citation-target",
          blockType: "article",
          blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
          sourceChannel: "citation_target",
          citationResolutionStatus: "resolved",
          citationMatchStrength: "exact_article",
        },
        {
          serverId: "server-1",
          lawId: "law-semantic",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-semantic",
          blockType: "article",
          blockText: "Должностное лицо обязано соблюдать служебные процедуры.",
          articleNumberNormalized: "38",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
          sourceChannel: "semantic",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-citation-target"]);
    expect(scoredByLawId.get("law-citation-target")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-citation-target")?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_resolved_citation_target",
    );
    expect(scoredByLawId.get("law-semantic")?.primary_basis_eligibility).not.toBe("eligible");
  });

  it("делает citation_target по АК clean direct basis для citation_explanation даже при санкционном role", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 22 ч.1 АК",
      originalInput: "что значит 22 ч.1 АК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-citation-target-ak",
          lawKey: "administrative_code",
          lawTitle: "Административный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-citation-target-ak",
          blockType: "article",
          blockText: "Незаконное проникновение или нахождение влечет штраф и иные меры ответственности.",
          articleNumberNormalized: "22",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/administrative",
          sourceChannel: "citation_target",
          citationResolutionStatus: "resolved",
          citationMatchStrength: "exact_article_supported_subunit",
        },
        {
          serverId: "server-1",
          lawId: "law-semantic-ak",
          lawKey: "ethics_code",
          lawTitle: "Этический кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-semantic-ak",
          blockType: "article",
          blockText: "Статья 22. Государственный служащий обязан соблюдать процедуры и правила поведения.",
          articleNumberNormalized: "22",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/ethics",
          sourceChannel: "semantic",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(plan.primaryLegalIssueType).toBe("citation_explanation");
    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-citation-target-ak"]);
    expect(scoredByLawId.get("law-citation-target-ak")?.norm_role).toBe("sanction");
    expect(scoredByLawId.get("law-citation-target-ak")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-citation-target-ak")?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_resolved_citation_target",
    );
  });

  it("делает citation_target по ПК clean direct basis для citation_application даже если semantic hit релевантнее по score", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "можно ли по 23.1 ПК",
      originalInput: "можно ли по 23.1 ПК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-semantic-pk",
          lawKey: "government_code",
          lawTitle: "Кодекс о деятельности Правительства",
          lawVersionId: "version-1",
          lawBlockId: "block-semantic-pk",
          blockType: "article",
          blockText:
            "Можно ли по этой процедуре квалифицировать нарушение и применить меры по статье 23.1 в общем служебном порядке.",
          articleNumberNormalized: "40",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/government",
          sourceChannel: "semantic",
        },
        {
          serverId: "server-1",
          lawId: "law-citation-target-pk",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-citation-target-pk",
          blockType: "article",
          blockText: "Порядок наложения штрафа (тикета).",
          articleNumberNormalized: "23.1",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedural",
          sourceChannel: "citation_target",
          citationResolutionStatus: "resolved",
          citationMatchStrength: "exact_article",
        },
      ],
    });

    const scoredByLawId = new Map(
      selection.scored_candidates.map((entry) => [entry.candidate.lawId, entry] as const),
    );

    expect(plan.primaryLegalIssueType).toBe("citation_application");
    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual(["law-citation-target-pk"]);
    expect(scoredByLawId.get("law-citation-target-pk")?.primary_basis_eligibility).toBe("eligible");
    expect(scoredByLawId.get("law-citation-target-pk")?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_resolved_citation_target",
    );
    expect(scoredByLawId.get("law-semantic-pk")?.primary_basis_eligibility).toBe("ineligible");
  });

  it("делает citation_target по Закону об адвокатуре clean direct basis для citation_explanation", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 5 ч.4 Закона об адвокатуре",
      originalInput: "что значит 5 ч.4 Закона об адвокатуре",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-citation-target-advocacy",
          lawKey: "advocacy_law",
          lawTitle: "Закон об адвокатуре и адвокатской деятельности",
          lawVersionId: "version-1",
          lawBlockId: "block-citation-target-advocacy",
          blockType: "article",
          blockText: "За исключением случаев ограниченного доступа ответ на адвокатский запрос предоставляется в установленном порядке.",
          articleNumberNormalized: "5",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/advocacy",
          sourceChannel: "citation_target",
          citationResolutionStatus: "resolved",
          citationMatchStrength: "exact_article_supported_subunit",
        },
      ],
    });

    const scoredCandidate = selection.scored_candidates[0];

    expect(plan.primaryLegalIssueType).toBe("citation_explanation");
    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual([
      "law-citation-target-advocacy",
    ]);
    expect(scoredCandidate?.norm_role).toBe("exception");
    expect(scoredCandidate?.primary_basis_eligibility).toBe("eligible");
    expect(scoredCandidate?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_resolved_citation_target",
    );
  });

  it("оставляет partially_supported citation_target direct basis и сохраняет статус gap в diagnostics", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит ст. 23 ч.1 п. «в» ПК",
      originalInput: "что значит ст. 23 ч.1 п. «в» ПК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-citation-target-partial",
          lawKey: "procedural_code",
          lawTitle: "Процессуальный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-citation-target-partial",
          blockType: "article",
          blockText: "Обязанности сотрудника, выполняющего задержание.",
          articleNumberNormalized: "23",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/procedure",
          sourceChannel: "citation_target",
          citationResolutionStatus: "partially_supported",
          citationResolutionReason: "no_point_metadata",
          citationMatchStrength: "article_with_gap",
        },
      ],
    });
    const diagnostics = buildLegalGroundingDiagnostics({ plan, selection });
    const citationDiagnostic = diagnostics.candidate_diagnostics.find(
      (entry) => entry.law_id === "law-citation-target-partial",
    );

    expect(selection.direct_basis_status).toBe("direct_basis_present");
    expect(selection.primary_basis_norms.map((entry) => entry.lawId)).toEqual([
      "law-citation-target-partial",
    ]);
    expect(citationDiagnostic?.primary_basis_eligibility).toBe("eligible");
    expect(citationDiagnostic?.primary_basis_eligibility_reason).toBe(
      "eligible_due_to_resolved_citation_target",
    );
    expect(citationDiagnostic?.citation_resolution_status).toBe("partially_supported");
  });

  it("не создаёт fake eligible primary из semantic hit при unresolved explicit citation", () => {
    const plan = buildLegalQueryPlan({
      normalizedInput: "что значит 999 УК",
      originalInput: "что значит 999 УК",
      intent: "qualification_check",
      actorContext: "general_question",
      responseMode: "normal",
      serverId: "server-1",
    });

    const selection = selectStructuredLegalContext({
      plan,
      candidates: [
        {
          serverId: "server-1",
          lawId: "law-semantic",
          lawKey: "criminal_code",
          lawTitle: "Уголовный кодекс",
          lawVersionId: "version-1",
          lawBlockId: "block-semantic",
          blockType: "article",
          blockText: "Неисполнение обязательного правового акта влечёт уголовную ответственность.",
          articleNumberNormalized: "84",
          sourceTopicUrl: "https://forum.gta5rp.com/threads/criminal",
          sourceChannel: "semantic",
        },
      ],
    });

    const semanticCandidate = selection.scored_candidates[0];
    const diagnostics = buildLegalGroundingDiagnostics({ plan, selection });

    expect(selection.primary_basis_norms).toEqual([]);
    expect(selection.direct_basis_status).toBe("partial_basis_only");
    expect(semanticCandidate?.primary_basis_eligibility).toBe("ineligible");
    expect(diagnostics.grounding_diagnostics.flags).toContain("citation_unresolved_no_primary_basis");
  });
});
