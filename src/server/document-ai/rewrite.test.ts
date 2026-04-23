import { describe, expect, it, vi } from "vitest";

import {
  __documentFieldRewriteInternals,
  DocumentFieldRewriteBlockedError,
  DocumentFieldRewriteUnavailableError,
  rewriteOwnedDocumentField,
} from "@/server/document-ai/rewrite";
import { DocumentAccessDeniedError } from "@/server/document-area/persistence";

function createBaseDocument(input?: {
  documentType?: "ogp_complaint" | "rehabilitation" | "lawsuit";
  payload?: Record<string, unknown>;
}) {
  return {
    id: "document-1",
    accountId: "account-1",
    serverId: "server-1",
    characterId: "character-1",
    documentType: input?.documentType ?? ("ogp_complaint" as const),
    title: "Жалоба в ОГП",
    status: "draft" as const,
    formSchemaVersion: "ogp_complaint_mvp_editor_v1",
    snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
    authorSnapshotJson: {
      characterId: "character-1",
      serverId: "server-1",
      serverCode: "blackberry",
      serverName: "Blackberry",
      fullName: "Игорь Юристов",
      nickname: "Игорь Юристов",
      passportNumber: "AA-001",
      isProfileComplete: true,
      roleKeys: ["lawyer"],
      accessFlags: ["advocate"],
      capturedAt: "2026-04-22T10:00:00.000Z",
    },
    formPayloadJson: input?.payload ?? {
      filingMode: "representative",
      appealNumber: "OGP-001",
      objectOrganization: "LSPD",
      objectFullName: "Officer Smoke",
      incidentAt: "2026-04-22T10:15",
      situationDescription: "Изначальное описание ситуации",
      violationSummary: "Изначальная формулировка нарушения",
      workingNotes: "Черновая заметка",
      trustorSnapshot: {
        sourceType: "inline_manual",
        fullName: "Пётр Доверитель",
        passportNumber: "TR-001",
        note: "Действую по доверенности",
      },
      evidenceItems: [
        {
          id: "item-1",
          mode: "custom",
          templateKey: null,
          labelSnapshot: "Запись с бодикамеры",
          url: "https://example.com/bodycam",
          sortOrder: 0,
        },
      ],
    },
    updatedAt: new Date("2026-04-22T11:00:00.000Z"),
    server: {
      id: "server-1",
      code: "blackberry",
      name: "Blackberry",
    },
  };
}

describe("document field rewrite flow", () => {
  it("строит suggestion только из persisted owner document и пишет safe ai log", async () => {
    const requestProxyCompletion = vi.fn().mockResolvedValue({
      status: "success",
      content: "Улучшенный и структурированный текст секции.",
      proxyKey: "primary",
      providerKey: "openai_compatible",
      model: "gpt-5.4",
      attemptedProxyKeys: ["primary"],
      responsePayloadJson: {
        choices: [
          {
            finish_reason: "stop",
          },
        ],
      },
    });
    const createAIRequest = vi.fn().mockResolvedValue({
      id: "ai-request-1",
    });

    const result = await rewriteOwnedDocumentField(
      {
        accountId: "account-1",
        documentId: "document-1",
        sectionKey: "situation_description",
      },
      {
        getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
        requestProxyCompletion,
        createAIRequest,
        now: vi
          .fn()
          .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
          .mockReturnValueOnce(new Date("2026-04-22T11:05:01.250Z")),
      },
    );

    expect(result.sourceText).toBe("Изначальное описание ситуации");
    expect(result.suggestionText).toBe("Улучшенный и структурированный текст секции.");
    expect(result.basedOnUpdatedAt).toBe("2026-04-22T11:00:00.000Z");
    expect(result.usageMeta.featureKey).toBe("document_field_rewrite");

    expect(requestProxyCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMetadata: {
          featureKey: "document_field_rewrite",
          documentId: "document-1",
          documentType: "ogp_complaint",
          sectionKey: "situation_description",
        },
      }),
    );

    const userPrompt = requestProxyCompletion.mock.calls[0]?.[0]?.userPrompt as string;
    expect(userPrompt).toContain("Изначальное описание ситуации");
    expect(userPrompt).toContain("violationSummary: Изначальная формулировка нарушения");
    expect(userPrompt).not.toContain("workingNotes");

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "document_field_rewrite",
        requestPayloadJson: expect.objectContaining({
          documentId: "document-1",
          documentType: "ogp_complaint",
          sectionKey: "situation_description",
          sourceLength: "Изначальное описание ситуации".length,
          contextFieldKeys: [
            "objectOrganization",
            "objectFullName",
            "incidentAt",
            "appealNumber",
            "violationSummary",
          ],
        }),
        responsePayloadJson: expect.objectContaining({
          suggestionLength: "Улучшенный и структурированный текст секции.".length,
          latencyMs: 1250,
          finishReason: "stop",
        }),
      }),
    );

    const aiRequestInput = createAIRequest.mock.calls[0]?.[0];
    expect(aiRequestInput.requestPayloadJson).not.toHaveProperty("sourceText");
    expect(aiRequestInput.requestPayloadJson).not.toHaveProperty("contextText");
  });

  it("блокирует unsupported section для текущего document type", async () => {
    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "pretrial_summary",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      reasons: ["unsupported_section"],
    } satisfies Pick<DocumentFieldRewriteBlockedError, "reasons">);
  });

  it("не даёт вызывать rewrite для чужого документа", async () => {
    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-404",
          sectionKey: "situation_description",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(null),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentAccessDeniedError);
  });

  it("даёт safe unavailable error и логирует неуспешную попытку", async () => {
    const createAIRequest = vi.fn().mockResolvedValue({
      id: "ai-request-2",
    });

    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "situation_description",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(createBaseDocument()),
          requestProxyCompletion: vi.fn().mockResolvedValue({
            status: "unavailable",
            message: "AI proxy не настроен для текущего окружения.",
            attemptedProxyKeys: [],
          }),
          createAIRequest,
          now: vi
            .fn()
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.000Z"))
            .mockReturnValueOnce(new Date("2026-04-22T11:05:00.050Z")),
        },
      ),
    ).rejects.toBeInstanceOf(DocumentFieldRewriteUnavailableError);

    expect(createAIRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unavailable",
        errorMessage: "AI proxy не настроен для текущего окружения.",
      }),
    );
  });

  it("не принимает пустой source text", async () => {
    await expect(
      rewriteOwnedDocumentField(
        {
          accountId: "account-1",
          documentId: "document-1",
          sectionKey: "situation_description",
        },
        {
          getDocumentByIdForAccount: vi.fn().mockResolvedValue(
            createBaseDocument({
              payload: {
                ...createBaseDocument().formPayloadJson,
                situationDescription: "   ",
              },
            }),
          ),
          requestProxyCompletion: vi.fn(),
          createAIRequest: vi.fn(),
          now: () => new Date("2026-04-22T11:05:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({
      reasons: ["source_text_empty"],
    } satisfies Pick<DocumentFieldRewriteBlockedError, "reasons">);
  });

  it("не смешивает v1 rewrite с grounded assistant policy", () => {
    const systemPrompt = __documentFieldRewriteInternals.buildRewriteSystemPrompt();

    expect(systemPrompt).toContain("writing assistant");
    expect(systemPrompt).not.toContain("confirmed corpus");
    expect(systemPrompt).not.toContain("laws-first");
    expect(systemPrompt).not.toContain("grounded");
  });
});
