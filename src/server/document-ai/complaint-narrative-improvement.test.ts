import { describe, expect, it } from "vitest";

import {
  complaintNarrativeImprovementActionInputSchema,
  complaintNarrativeImprovementResultSchema,
  complaintNarrativeImprovementRuntimeInputSchema,
  type ComplaintNarrativeImprovementRuntimeInput,
} from "@/schemas/document-ai";
import {
  __complaintNarrativeImprovementInternals,
  ComplaintNarrativeImprovementBlockedError,
  ComplaintNarrativeImprovementValidationError,
  assertComplaintNarrativeImprovementPreflight,
  buildComplaintNarrativeImprovementRuntimeInput,
  buildComplaintNarrativeImprovementSystemPrompt,
  buildComplaintNarrativeImprovementUserPrompt,
  mapComplaintNarrativeImprovementBlockingReasonsToMessages,
  parseComplaintNarrativeImprovementResult,
  validateComplaintNarrativeImprovementPreflight,
} from "@/server/document-ai/complaint-narrative-improvement";

function createBaseDocument(input?: {
  payload?: Record<string, unknown>;
}) {
  return {
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
});
