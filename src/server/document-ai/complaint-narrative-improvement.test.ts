import { describe, expect, it, vi } from "vitest";

import {
  complaintNarrativeImprovementActionInputSchema,
  complaintNarrativeImprovementResultSchema,
  complaintNarrativeImprovementRuntimeInputSchema,
  type ComplaintNarrativeImprovementRuntimeInput,
} from "@/schemas/document-ai";
import {
  __complaintNarrativeImprovementInternals,
  ComplaintNarrativeImprovementBlockedError,
  ComplaintNarrativeImprovementInvalidOutputError,
  ComplaintNarrativeImprovementUnavailableError,
  ComplaintNarrativeImprovementValidationError,
  assertComplaintNarrativeImprovementPreflight,
  buildComplaintNarrativeImprovementRuntimeInput,
  buildComplaintNarrativeImprovementSystemPrompt,
  buildComplaintNarrativeImprovementUserPrompt,
  improveOwnedComplaintNarrative,
  mapComplaintNarrativeImprovementBlockingReasonsToMessages,
  parseComplaintNarrativeImprovementResult,
  validateComplaintNarrativeImprovementPreflight,
} from "@/server/document-ai/complaint-narrative-improvement";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

function createBaseDocument(input?: {
  payload?: Record<string, unknown>;
}) {
  return {
    id: "document-1",
    updatedAt: new Date("2026-04-27T10:10:00.000Z"),
    documentType: "ogp_complaint" as const,
    serverId: "server-1",
    authorSnapshotJson: {
      characterId: "character-1",
      serverId: "server-1",
      serverCode: "blackberry",
      serverName: "Blackberry",
      fullName: "Игорь Юристов",
      nickname: "Игорь Юристов",
      passportNumber: "AA-001",
      position: "Адвокат",
      address: "",
      phone: "",
      icEmail: "",
      passportImageUrl: "",
      isProfileComplete: true,
      roleKeys: ["lawyer"],
      accessFlags: ["advocate"],
      capturedAt: "2026-04-27T10:00:00.000Z",
    },
    formPayloadJson: {
      filingMode: "representative",
      appealNumber: "OGP-001",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smoke",
      incidentAt: "2026-04-22T10:15",
      situationDescription:
        "Я действовал как представитель доверителя. После задержания доверителю не предоставили видеозапись и копию ответа на адвокатский запрос.",
      violationSummary: "Краткая формулировка, которую нельзя использовать как source text.",
      workingNotes: "",
      trustorSnapshot: {
        sourceType: "inline_manual",
        fullName: "Пётр Доверитель",
        passportNumber: "TR-001",
        address: "",
        phone: "",
        icEmail: "",
        passportImageUrl: "",
        note: "Действую по доверенности",
      },
      evidenceItems: [
        {
          id: "item-1",
          mode: "custom",
          templateKey: null,
          labelSnapshot: "Видео с бодикамеры",
          url: "https://example.com/bodycam",
          sortOrder: 0,
        },
      ],
      ...input?.payload,
    },
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
  };
}

describe("complaint narrative improvement contract", () => {
  it("строит action input schema с default length mode", () => {
    const parsed = complaintNarrativeImprovementActionInputSchema.parse({
      documentId: "document-1",
    });

    expect(parsed.lengthMode).toBe("normal");
  });

  it("строит runtime input из persisted OGP document без использования violationSummary как source", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: createBaseDocument(),
      lawVersion: "law-version-1",
      lengthMode: "detailed",
      selectedLegalContext: {
        laws: [
          {
            law_name: "Закон об адвокатуре",
            article: "5",
            part: "4",
            excerpt: "Норма о порядке ответа на адвокатский запрос.",
          },
        ],
      },
    });

    expect(runtimeInput).toMatchObject({
      server_id: "server-1",
      law_version: "law-version-1",
      representative_mode: "representative",
      victim_or_trustor_mode: "trustor",
      victim_or_trustor_name: "Пётр Доверитель",
      organization: "LSPD",
      subject_name: "Officer Smoke",
      date_time: "2026-04-22T10:15",
      length_mode: "detailed",
    });
    expect(runtimeInput.raw_situation_description).toContain("доверителю не предоставили видеозапись");
    expect(runtimeInput.raw_situation_description).not.toContain("Краткая формулировка");
  });

  it("не блокирует preflight без evidence list и legal context", () => {
    const runtimeInput = complaintNarrativeImprovementRuntimeInputSchema.parse({
      server_id: "server-1",
      law_version: null,
      active_character: {
        full_name: "Игорь Юристов",
        role_label: "Адвокат",
      },
      applicant_role: "representative_advocate",
      representative_mode: "representative",
      victim_or_trustor_mode: "trustor",
      victim_or_trustor_name: "Пётр Доверитель",
      organization: "LSPD",
      subject_name: "Officer Smoke",
      date_time: "2026-04-22T10:15",
      raw_situation_description: "Доверителю не предоставили ответ на запрос.",
      evidence_list: [],
      selected_legal_context: null,
      length_mode: "normal",
    });

    expect(validateComplaintNarrativeImprovementPreflight(runtimeInput)).toEqual([]);
    expect(() => assertComplaintNarrativeImprovementPreflight(runtimeInput)).not.toThrow();
  });

  it("блокирует improvement при отсутствии обязательных полей", () => {
    const runtimeInput = {
      server_id: "",
      law_version: null,
      active_character: {
        full_name: " ",
        role_label: null,
      },
      applicant_role: null,
      representative_mode: "representative",
      victim_or_trustor_mode: "trustor",
      victim_or_trustor_name: "",
      organization: "",
      subject_name: "",
      date_time: "",
      raw_situation_description: "",
      evidence_list: [],
      selected_legal_context: null,
      length_mode: "normal",
    } as ComplaintNarrativeImprovementRuntimeInput;

    const reasons = validateComplaintNarrativeImprovementPreflight(runtimeInput);
    expect(reasons).toEqual(
      expect.arrayContaining([
        "missing_server_id",
        "missing_active_character",
        "missing_applicant_role",
        "missing_organization",
        "missing_subject_name",
        "missing_trustor_name",
        "missing_raw_situation_description",
        "missing_date_time",
      ]),
    );
    expect(() => assertComplaintNarrativeImprovementPreflight(runtimeInput)).toThrow(
      ComplaintNarrativeImprovementBlockedError,
    );
    expect(mapComplaintNarrativeImprovementBlockingReasonsToMessages(reasons)).toContain(
      "Для представительской жалобы нужно указать ФИО доверителя.",
    );
  });

  it("system prompt содержит compact style profile и не включает полные примеры жалоб", () => {
    const systemPrompt = buildComplaintNarrativeImprovementSystemPrompt();

    expect(systemPrompt).toContain("Стиль: официальный, юридический, нейтральный, уверенный");
    expect(systemPrompt).toContain("short_violation_summary нельзя использовать как source-of-facts");
    expect(systemPrompt).toContain("Это не Legal Q&A, не полная жалоба, не violation summary и не BBCode generation.");
    expect(systemPrompt).not.toContain("Пример готовой жалобы");
  });

  it("user prompt включает date_time caution, archetypes и не подмешивает violationSummary", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: createBaseDocument(),
      attorneyRequestContext: {
        request_sent: true,
        response_received: false,
      },
      arrestOrBodycamContext: {
        recording_requested: true,
        recording_provided: false,
      },
    });

    const userPrompt = buildComplaintNarrativeImprovementUserPrompt(runtimeInput);

    expect(userPrompt).toContain("date_time");
    expect(userPrompt).toContain("date_time is ambiguous by default");
    expect(userPrompt).toContain("attorney request without materials");
    expect(userPrompt).toContain("detention without recording");
    expect(userPrompt).toContain("short_violation_summary");
    expect(userPrompt).not.toContain("Краткая формулировка, которую нельзя использовать как source text.");
  });

  it("output parser отвергает invalid risk flags", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: createBaseDocument(),
    });

    expect(() =>
      parseComplaintNarrativeImprovementResult({
        runtimeInput,
        rawResult: {
          improved_text: "Текст",
          legal_basis_used: [],
          used_facts: [],
          missing_facts: [],
          review_notes: [],
          risk_flags: ["totally_invalid_flag"],
          should_send_to_review: false,
        },
      }),
    ).toThrow();
  });

  it("output parser отвергает legal basis без selected legal context", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: createBaseDocument(),
    });

    expect(() =>
      parseComplaintNarrativeImprovementResult({
        runtimeInput,
        rawResult: {
          improved_text: "Текст без выдумки фактов.",
          legal_basis_used: [
            {
              law_name: "ПК",
              article: "23.1",
              reason: "Выдуманная ссылка без legal context.",
            },
          ],
          used_facts: ["Факт 1"],
          missing_facts: [],
          review_notes: [],
          risk_flags: ["weak_legal_context"],
          should_send_to_review: false,
        },
      }),
    ).toThrow(ComplaintNarrativeImprovementValidationError);
  });

  it("output parser принимает valid structured result и auto-add missing_evidence при упоминании записи", () => {
    const runtimeInput = complaintNarrativeImprovementRuntimeInputSchema.parse({
      server_id: "server-1",
      law_version: null,
      active_character: {
        full_name: "Игорь Юристов",
        role_label: "Адвокат",
      },
      applicant_role: "representative_advocate",
      representative_mode: "representative",
      victim_or_trustor_mode: "trustor",
      victim_or_trustor_name: "Пётр Доверитель",
      organization: "LSPD",
      subject_name: "Officer Smoke",
      date_time: "2026-04-22T10:15",
      raw_situation_description:
        "После задержания видеозапись не была предоставлена, хотя на неё ссылались при объяснении событий.",
      evidence_list: [],
      selected_legal_context: {
        laws: [
          {
            law_name: "Процессуальный кодекс",
            article: "23.1",
            excerpt: "Норма о процессуальной видеофиксации.",
          },
        ],
        precedents: [],
      },
      length_mode: "normal",
    });

    const parsed = parseComplaintNarrativeImprovementResult({
      runtimeInput,
      rawResult: {
        improved_text:
          "Я, действуя в интересах доверителя, описываю обстоятельства задержания и последующего непредоставления записи, что затрудняет объективную проверку соблюдения установленного порядка.",
        legal_basis_used: [
          {
            law_name: "Процессуальный кодекс",
            article: "23.1",
            reason: "Контекст даёт процессуальную норму о записи и её значении для проверки.",
          },
        ],
        used_facts: ["Задержание", "Запись не была предоставлена"],
        missing_facts: ["Кто именно отказал в предоставлении записи"],
        review_notes: ["Нужно уточнить, каким документом был оформлен отказ."],
        risk_flags: ["insufficient_facts", "ambiguous_date_time"],
        should_send_to_review: false,
      },
    });

    expect(complaintNarrativeImprovementResultSchema.parse(parsed)).toBeTruthy();
    expect(parsed.risk_flags).toEqual(
      expect.arrayContaining(["insufficient_facts", "ambiguous_date_time", "missing_evidence"]),
    );
    expect(parsed.review_notes).toContain(
      __complaintNarrativeImprovementInternals.MISSING_EVIDENCE_REVIEW_NOTE,
    );
    expect(parsed.should_send_to_review).toBe(true);
  });

  it("запускает owner-only improvement через mock AI provider и пишет safe ai log", async () => {
    const requestProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: JSON.stringify({
        improved_text:
          "Я, действуя как представитель доверителя, излагаю обстоятельства задержания и последующего непредоставления материалов, что требует проверки со стороны ОГП.",
        legal_basis_used: [],
        used_facts: ["Задержание", "Непредоставление видеозаписи"],
        missing_facts: ["Кто именно отказал в предоставлении материалов"],
        review_notes: ["Следует уточнить, каким образом был оформлен отказ."],
        risk_flags: ["insufficient_facts", "ambiguous_date_time"],
        should_send_to_review: true,
      }),
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4-mini",
      attemptedProxyKeys: ["primary"],
      attempts: [],
      responsePayloadJson: {
        choices: [{ finish_reason: "stop" }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 160,
          total_tokens: 360,
          cost_usd: 0.01,
        },
      },
    });
    const createAIRequest = vi.fn().mockResolvedValue({ id: "ai-request-1" });

    const result = await improveOwnedComplaintNarrative(
      {
        accountId: "account-1",
        documentId: "document-1",
        lengthMode: "normal",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
        requestProxyCompletion,
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-27T10:15:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-27T10:15:01.100Z")),
      },
    );

    expect(result.sourceText).toContain("не предоставили видеозапись");
    expect(result.result.improved_text).toContain("требует проверки со стороны ОГП");
    expect(result.basedOnUpdatedAt).toBe("2026-04-27T10:10:00.000Z");
    expect(result.usageMeta.featureKey).toBe("complaint_narrative_improvement");
    expect(result.usageMeta.lengthMode).toBe("normal");

    expect(requestProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMetadata: expect.objectContaining({
          featureKey: "complaint_narrative_improvement",
          documentId: "document-1",
          documentType: "ogp_complaint",
          intent: "complaint_narrative_improvement",
          response_mode: "document_ready",
          prompt_version: "complaint_narrative_improvement_v1",
          length_mode: "normal",
          evidence_count: 1,
          has_legal_context: false,
        }),
      }),
    );

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "complaint_narrative_improvement",
        status: "success",
        requestPayloadJson: expect.objectContaining({
          documentId: "document-1",
          documentType: "ogp_complaint",
          intent: "complaint_narrative_improvement",
          prompt_version: "complaint_narrative_improvement_v1",
          runtime_input: expect.objectContaining({
            server_id: "server-1",
            organization: "LSPD",
          }),
        }),
        responsePayloadJson: expect.objectContaining({
          statusBranch: "success",
          improved_text_length: expect.any(Number),
          risk_flags: ["insufficient_facts", "ambiguous_date_time"],
          should_send_to_review: true,
          output_trace: expect.objectContaining({
            output_kind: "complaint_narrative_structured_json",
          }),
        }),
      }),
    );
  });

  it("возвращает safe unavailable branch при недоступном AI provider", async () => {
    const createAIRequest = vi.fn().mockResolvedValue({ id: "ai-request-2" });

    await expect(
      improveOwnedComplaintNarrative(
        {
          accountId: "account-1",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          requestProxyCompletion: vi.fn().mockResolvedValue({
            status: "unavailable",
            message: "AI proxy не настроен для текущего окружения.",
            attemptedProxyKeys: [],
            attempts: [],
          }),
          createAIRequest,
          now: vi
            .fn()
            .mockReturnValueOnce(new Date("2026-04-27T10:15:00.000Z"))
            .mockReturnValueOnce(new Date("2026-04-27T10:15:00.050Z")),
        },
      ),
    ).rejects.toBeInstanceOf(ComplaintNarrativeImprovementUnavailableError);

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "complaint_narrative_improvement",
        status: "unavailable",
        errorMessage: "AI proxy не настроен для текущего окружения.",
        responsePayloadJson: expect.objectContaining({
          statusBranch: "unavailable",
          output_trace: null,
        }),
      }),
    );
  });

  it("безопасно помечает invalid structured output", async () => {
    const createAIRequest = vi.fn().mockResolvedValue({ id: "ai-request-3" });

    await expect(
      improveOwnedComplaintNarrative(
        {
          accountId: "account-1",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          requestProxyCompletion: vi.fn().mockResolvedValue({
            status: "success",
            content: '{"improved_text":"Текст","risk_flags":["not_allowed"]}',
            proxyKey: "primary",
            providerKey: "openai_compatible",
            model: "gpt-5.4-mini",
            attemptedProxyKeys: ["primary"],
            attempts: [],
            responsePayloadJson: {
              choices: [{ finish_reason: "stop" }],
              usage: {
                prompt_tokens: 180,
                completion_tokens: 90,
                total_tokens: 270,
                cost_usd: 0.008,
              },
            },
          }),
          createAIRequest,
          now: vi
            .fn()
            .mockReturnValueOnce(new Date("2026-04-27T10:15:00.000Z"))
            .mockReturnValueOnce(new Date("2026-04-27T10:15:00.700Z")),
        },
      ),
    ).rejects.toBeInstanceOf(ComplaintNarrativeImprovementInvalidOutputError);

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "complaint_narrative_improvement",
        status: "failure",
        responsePayloadJson: expect.objectContaining({
          statusBranch: "invalid_output",
          output_trace: expect.objectContaining({
            output_kind: "complaint_narrative_structured_json",
          }),
        }),
      }),
    );
  });

  it("не даёт запускать improvement для чужого или неподходящего документа", async () => {
    await expect(
      improveOwnedComplaintNarrative(
        {
          accountId: "account-1",
          documentId: "document-404",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-27T10:15:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });
});
