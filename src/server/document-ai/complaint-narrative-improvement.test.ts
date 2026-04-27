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
  ComplaintNarrativeImprovementInvalidDraftError,
  ComplaintNarrativeImprovementInvalidOutputError,
  ComplaintNarrativeImprovementUnsupportedDocumentTypeError,
  ComplaintNarrativeImprovementUnavailableError,
  ComplaintNarrativeImprovementValidationError,
  assertComplaintNarrativeImprovementPreflight,
  buildComplaintNarrativeImprovementInputFromDraft,
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

  it("draft adapter использует только нужные поля из реального OGP draft context", () => {
    const runtimeInput = buildComplaintNarrativeImprovementInputFromDraft({
      document: createBaseDocument({
        payload: {
          evidenceItems: [],
          violationSummary: "Эта формулировка не должна становиться source text.",
        },
      }),
      lengthMode: "short",
    });

    expect(runtimeInput.server_id).toBe("server-1");
    expect(runtimeInput.active_character.full_name).toBe("Игорь Юристов");
    expect(runtimeInput.applicant_role).toBe("representative_advocate");
    expect(runtimeInput.organization).toBe("LSPD");
    expect(runtimeInput.subject_name).toBe("Officer Smoke");
    expect(runtimeInput.victim_or_trustor_mode).toBe("trustor");
    expect(runtimeInput.victim_or_trustor_name).toBe("Пётр Доверитель");
    expect(runtimeInput.date_time).toBe("2026-04-22T10:15");
    expect(runtimeInput.raw_situation_description).not.toContain("Эта формулировка");
    expect(runtimeInput.length_mode).toBe("short");
    expect(runtimeInput.evidence_list).toEqual([]);
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
    expect(systemPrompt).toContain("не смешивай формулы 'представитель' и 'адвокат'");
    expect(systemPrompt).toContain("Не добавляй роль 'адвокат', если applicant_role этого не подтверждает.");
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
    expect(userPrompt).not.toContain("в статусе представителя адвоката");
  });

  it("user prompt даёт нормализованную role phrasing guidance для advocate representative", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: createBaseDocument(),
    });

    const userPrompt = buildComplaintNarrativeImprovementUserPrompt(runtimeInput);

    expect(userPrompt).toContain(
      'Заявитель Игорь Юристов, являясь адвокатом и действуя в интересах доверителя Пётр Доверитель, ...',
    );
    expect(userPrompt).toContain(
      'В интересах доверителя Пётр Доверитель заявителем был направлен ...',
    );
  });

  it("user prompt даёт нейтральную representative phrasing guidance без роли адвоката", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: {
        ...createBaseDocument(),
        authorSnapshotJson: {
          ...createBaseDocument().authorSnapshotJson,
          position: "Представитель",
          roleKeys: [],
          accessFlags: [],
        },
      },
    });

    const userPrompt = buildComplaintNarrativeImprovementUserPrompt(runtimeInput);

    expect(userPrompt).toContain(
      'Заявитель Игорь Юристов, действуя как представитель доверителя Пётр Доверитель, ...',
    );
    expect(userPrompt).not.toContain("являясь адвокатом");
  });

  it("user prompt для self-filed complaint использует self role phrasing guidance", () => {
    const runtimeInput = buildComplaintNarrativeImprovementRuntimeInput({
      document: createBaseDocument({
        payload: {
          filingMode: "self",
          trustorSnapshot: null,
        },
      }),
    });

    const userPrompt = buildComplaintNarrativeImprovementUserPrompt(runtimeInput);

    expect(userPrompt).toContain('Заявитель Игорь Юристов обращается от своего имени ...');
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

  it("adapter не интерпретирует date_time как тип события и передаёт его нейтрально", () => {
    const runtimeInput = buildComplaintNarrativeImprovementInputFromDraft({
      document: createBaseDocument({
        payload: {
          incidentAt: "2026-04-22T10:15",
          situationDescription: "Имел место конфликт, после которого запись не была предоставлена.",
        },
      }),
    });

    expect(runtimeInput.date_time).toBe("2026-04-22T10:15");
    expect(runtimeInput.raw_situation_description).toContain("запись не была предоставлена");
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

  it("не вызывает provider при blocked preflight и возвращает missing required context", async () => {
    const requestProxyCompletion = vi.fn();
    const createAIRequest = vi.fn();

    await expect(
      improveOwnedComplaintNarrative(
        {
          accountId: "account-1",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(
            createBaseDocument({
              payload: {
                trustorSnapshot: {
                  sourceType: "inline_manual",
                  fullName: "",
                  passportNumber: "TR-001",
                  address: "",
                  phone: "",
                  icEmail: "",
                  passportImageUrl: "",
                  note: "Действую по доверенности",
                },
              },
            }),
          ),
          requestProxyCompletion,
          createAIRequest,
          now: () => new Date("2026-04-27T10:15:00.000Z"),
        },
      ),
    ).rejects.toThrow(ComplaintNarrativeImprovementBlockedError);

    expect(requestProxyCompletion).not.toHaveBeenCalled();
    expect(createAIRequest).not.toHaveBeenCalled();
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

  it("не вызывает provider для unsupported document type", async () => {
    const requestProxyCompletion = vi.fn();
    const createAIRequest = vi.fn();

    await expect(
      improveOwnedComplaintNarrative(
        {
          accountId: "account-1",
          documentId: "document-claims-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseDocument(),
            documentType: "lawsuit",
          }),
          requestProxyCompletion,
          createAIRequest,
          now: () => new Date("2026-04-27T10:15:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(ComplaintNarrativeImprovementUnsupportedDocumentTypeError);

    expect(requestProxyCompletion).not.toHaveBeenCalled();
    expect(createAIRequest).not.toHaveBeenCalled();
  });

  it("не вызывает provider при invalid draft shape", async () => {
    const requestProxyCompletion = vi.fn();
    const createAIRequest = vi.fn();

    await expect(
      improveOwnedComplaintNarrative(
        {
          accountId: "account-1",
          documentId: "document-1",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue({
            ...createBaseDocument(),
            formPayloadJson: {
              filingMode: "representative",
              objectOrganization: "LSPD",
              objectFullName: "Officer Smoke",
              incidentAt: 12345,
              situationDescription: "Описание",
              violationSummary: "Не использовать",
              evidenceItems: [],
            },
          }),
          requestProxyCompletion,
          createAIRequest,
          now: () => new Date("2026-04-27T10:15:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(ComplaintNarrativeImprovementInvalidDraftError);

    expect(requestProxyCompletion).not.toHaveBeenCalled();
    expect(createAIRequest).not.toHaveBeenCalled();
  });
});
