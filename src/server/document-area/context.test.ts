import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/repositories/character.repository", () => ({
  getCharactersByServer: vi.fn(),
  getCharacterByIdForAccount: vi.fn(),
}));

vi.mock("@/db/repositories/document.repository", () => ({
  countDocumentsByAccountAndServerAndType: vi.fn(),
  createDocumentRecord: vi.fn(),
  getDocumentByIdForAccount: vi.fn(),
  listDocumentsByAccount: vi.fn(),
  listDocumentsByAccountAndServerAndType: vi.fn(),
  updateDocumentDraftRecord: vi.fn(),
}));

vi.mock("@/db/repositories/server.repository", () => ({
  getServerById: vi.fn(),
  getServerByCode: vi.fn(),
  getServers: vi.fn(),
}));

vi.mock("@/db/repositories/user-server-state.repository", () => ({
  getUserServerStates: vi.fn(),
  selectActiveCharacter: vi.fn(),
  selectActiveServer: vi.fn(),
}));

vi.mock("@/server/auth/protected", () => ({
  requireProtectedAccountContext: vi.fn(),
}));

import { getCharactersByServer } from "@/db/repositories/character.repository";
import {
  countDocumentsByAccountAndServerAndType,
  getDocumentByIdForAccount,
  listDocumentsByAccount,
  listDocumentsByAccountAndServerAndType,
} from "@/db/repositories/document.repository";
import { getServerByCode, getServers } from "@/db/repositories/server.repository";
import { getUserServerStates } from "@/db/repositories/user-server-state.repository";
import {
  buildCharactersBridgePath,
  getAccountDocumentsOverviewContext,
  getClaimsEditorRouteContext,
  getClaimsFamilyRouteContext,
  getOgpComplaintEditorRouteContext,
  getOgpComplaintFamilyRouteContext,
  getServerDocumentsRouteContext,
} from "@/server/document-area/context";
import { requireProtectedAccountContext } from "@/server/auth/protected";

const accountContext = {
  user: {
    id: "user-1",
    email: "user@example.com",
  },
  account: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "user@example.com",
    login: "tester",
    pendingEmail: null,
    pendingEmailRequestedAt: null,
    isSuperAdmin: false,
    mustChangePassword: false,
    mustChangePasswordReason: null,
    passwordChangedAt: null,
    createdAt: new Date("2026-04-21T10:00:00.000Z"),
    updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  },
};

const blackberryServer = {
  id: "server-1",
  code: "blackberry",
  name: "Blackberry",
  isActive: true,
  sortOrder: 1,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
};

describe("document area context", () => {
  it("строит /account/documents как persisted cross-server overview", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        id: "state-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        activeCharacterId: "character-2",
        lastSelectedAt: new Date("2026-04-21T10:00:00.000Z"),
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-2",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: true,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
        roles: [],
        accessFlags: [
          {
            id: "flag-1",
            characterId: "character-2",
            flagKey: "advocate",
            createdAt: new Date("2026-04-21T10:00:00.000Z"),
          },
        ],
      },
    ]);
    vi.mocked(countDocumentsByAccountAndServerAndType).mockResolvedValue(1);
    vi.mocked(listDocumentsByAccount).mockResolvedValue([
      {
        id: "document-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        characterId: "character-2",
        documentType: "ogp_complaint",
        title: "Жалоба в ОГП",
        status: "draft",
        formSchemaVersion: "ogp_complaint_mvp_editor_v1",
        snapshotCapturedAt: new Date("2026-04-21T10:00:00.000Z"),
        authorSnapshotJson: {
          characterId: "character-2",
          serverId: "server-1",
          serverCode: "blackberry",
          serverName: "Blackberry",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-002",
          isProfileComplete: true,
          roleKeys: [],
          accessFlags: ["advocate"],
          capturedAt: "2026-04-21T10:00:00.000Z",
        },
        formPayloadJson: {
          filingMode: "self",
          appealNumber: "OGP-001",
          objectOrganization: "LSPD",
          objectFullName: "Сотрудник Полиции",
          workingNotes: "Черновая заметка",
          evidenceGroups: [],
        },
        generatedArtifactJson: null,
        generatedArtifactText: null,
        generatedOutputFormat: null,
        generatedRendererVersion: null,
        lastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        publicationUrl: null,
        isSiteForumSynced: false,
        isModifiedAfterGeneration: false,
        deletedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:15:00.000Z"),
        server: blackberryServer,
      },
    ]);

    const result = await getAccountDocumentsOverviewContext("/account/documents");

    expect(requireProtectedAccountContext).toHaveBeenCalledWith(
      "/account/documents",
      undefined,
      { allowMustChangePassword: true },
    );
      expect(result.servers[0]).toEqual(
      expect.objectContaining({
        code: "blackberry",
        selectedCharacterId: "character-2",
        ogpComplaintDocumentCount: 1,
        claimsDocumentCount: 2,
      }),
    );
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: "document-1",
        title: "Жалоба в ОГП",
        filingMode: "self",
        appealNumber: "OGP-001",
        objectOrganization: "LSPD",
        objectFullName: "Сотрудник Полиции",
      }),
    );
  });

  it("берёт server context только из route slug и возвращает ready state с last-used character", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getServerByCode).mockResolvedValue(blackberryServer);
    vi.mocked(getUserServerStates).mockResolvedValue([
      {
        id: "state-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        activeCharacterId: "character-2",
        lastSelectedAt: new Date("2026-04-21T10:00:00.000Z"),
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
    ]);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Павел Тестов",
        nickname: "Павел Тестов",
        passportNumber: "AA-001",
        isProfileComplete: true,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
        roles: [],
        accessFlags: [],
      },
      {
        id: "character-2",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: false,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
        roles: [],
        accessFlags: [
          {
            id: "flag-2",
            characterId: "character-2",
            flagKey: "advocate",
            createdAt: new Date("2026-04-21T10:00:00.000Z"),
          },
        ],
      },
    ]);
    vi.mocked(countDocumentsByAccountAndServerAndType).mockResolvedValue(2);

    const result = await getServerDocumentsRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents",
    });

    expect(getServerByCode).toHaveBeenCalledWith("blackberry");
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.server.code).toBe("blackberry");
      expect(result.selectedCharacter).toEqual(
        expect.objectContaining({
          id: "character-2",
          fullName: "Игорь Юристов",
          source: "last_used",
          isProfileComplete: false,
          canUseRepresentative: true,
        }),
      );
      expect(result.ogpComplaintDocumentCount).toBe(2);
      expect(result.claimsDocumentCount).toBe(4);
    }
  });

  it("family route показывает persisted документы даже если новых персонажей на сервере сейчас нет", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getServerByCode).mockResolvedValue(blackberryServer);
    vi.mocked(getUserServerStates).mockResolvedValue([]);
    vi.mocked(getCharactersByServer).mockResolvedValue([]);
    vi.mocked(listDocumentsByAccountAndServerAndType).mockResolvedValue([
      {
        id: "document-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        characterId: "character-legacy",
        documentType: "ogp_complaint",
        title: "Исторический draft",
        status: "draft",
        formSchemaVersion: "ogp_complaint_mvp_editor_v1",
        snapshotCapturedAt: new Date("2026-04-21T10:00:00.000Z"),
        authorSnapshotJson: {
          characterId: "character-legacy",
          serverId: "server-1",
          serverCode: "blackberry",
          serverName: "Blackberry",
          fullName: "Исторический Автор",
          nickname: "Исторический Автор",
          passportNumber: "AA-010",
          isProfileComplete: true,
          roleKeys: [],
          accessFlags: [],
          capturedAt: "2026-04-21T10:00:00.000Z",
        },
        formPayloadJson: {
          filingMode: "self",
          appealNumber: "OLD-001",
          objectOrganization: "",
          objectFullName: "",
          workingNotes: "Исторические заметки",
          evidenceGroups: [],
        },
        generatedArtifactJson: null,
        generatedArtifactText: null,
        generatedOutputFormat: null,
        generatedRendererVersion: null,
        lastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        publicationUrl: null,
        isSiteForumSynced: false,
        isModifiedAfterGeneration: false,
        deletedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:15:00.000Z"),
      },
    ]);
    vi.mocked(countDocumentsByAccountAndServerAndType).mockResolvedValue(1);

    const result = await getOgpComplaintFamilyRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/ogp-complaints",
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.canCreateDocuments).toBe(false);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]).toEqual(
        expect.objectContaining({
          title: "Исторический draft",
          filingMode: "self",
          appealNumber: "OLD-001",
        }),
      );
    }
  });

  it("editor route отдаёт только owner-account документ с persisted complaint payload", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getServerByCode).mockResolvedValue(blackberryServer);
    vi.mocked(getCharactersByServer).mockResolvedValue([]);
    vi.mocked(countDocumentsByAccountAndServerAndType).mockResolvedValue(0);
    vi.mocked(getUserServerStates).mockResolvedValue([]);
    vi.mocked(getDocumentByIdForAccount).mockResolvedValue({
      id: "document-1",
      accountId: accountContext.account.id,
      serverId: "server-1",
      characterId: "character-1",
      documentType: "ogp_complaint",
      title: "Persisted draft",
      status: "draft",
      formSchemaVersion: "ogp_complaint_mvp_editor_v1",
      snapshotCapturedAt: new Date("2026-04-21T10:00:00.000Z"),
      authorSnapshotJson: {
        characterId: "character-1",
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: false,
        roleKeys: ["lawyer"],
        accessFlags: ["advocate"],
        capturedAt: "2026-04-21T10:00:00.000Z",
      },
      formPayloadJson: {
        filingMode: "representative",
        appealNumber: "REP-001",
        objectOrganization: "LSPD",
        objectFullName: "Сотрудник Полиции",
        incidentAt: "2026-04-21T11:15",
        situationDescription: "Описание ситуации",
        violationSummary: "Резюме нарушения",
        workingNotes: "Рабочие заметки",
        trustorSnapshot: {
          sourceType: "inline_manual",
          fullName: "Пётр Доверитель",
          passportNumber: "TR-001",
          note: "",
        },
        evidenceGroups: [],
      },
      generatedArtifactJson: null,
      generatedArtifactText: null,
      generatedOutputFormat: null,
      generatedRendererVersion: null,
      lastGeneratedBbcode: null,
      generatedAt: null,
      generatedLawVersion: null,
      generatedTemplateVersion: null,
      generatedFormSchemaVersion: null,
      publicationUrl: null,
      isSiteForumSynced: false,
      isModifiedAfterGeneration: false,
      deletedAt: null,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:15:00.000Z"),
      server: blackberryServer,
      character: {
        id: "character-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: false,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
        roles: [
          {
            id: "role-1",
            characterId: "character-1",
            roleKey: "lawyer",
            createdAt: new Date("2026-04-21T10:00:00.000Z"),
          },
        ],
        accessFlags: [
          {
            id: "flag-1",
            characterId: "character-1",
            flagKey: "advocate",
            createdAt: new Date("2026-04-21T10:00:00.000Z"),
          },
        ],
      },
    });

    const result = await getOgpComplaintEditorRouteContext({
      serverSlug: "blackberry",
      documentId: "document-1",
      nextPath: "/servers/blackberry/documents/ogp-complaints/document-1",
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.document.id).toBe("document-1");
      expect(result.document.authorSnapshot.fullName).toBe("Игорь Юристов");
      expect(result.document.authorSnapshot.isProfileComplete).toBe(false);
      expect(result.document.payload).toEqual(
        expect.objectContaining({
          filingMode: "representative",
          appealNumber: "REP-001",
        }),
      );
    }
  });

  it("строит временный bridge path для no-characters create flow", () => {
    expect(buildCharactersBridgePath()).toBe("/app");
  });

  it("строит /account/documents с persisted claims рядом с OGP", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getUserServerStates).mockResolvedValue([]);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-2",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: true,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        updatedAt: new Date("2026-04-22T10:00:00.000Z"),
        roles: [],
        accessFlags: [],
      },
    ]);
    vi.mocked(countDocumentsByAccountAndServerAndType)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    vi.mocked(listDocumentsByAccount).mockResolvedValue([
      {
        id: "claim-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        characterId: "character-2",
        documentType: "rehabilitation",
        title: "Документ по реабилитации",
        status: "draft",
        formSchemaVersion: "rehabilitation_claim_mvp_editor_v1",
        snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
        authorSnapshotJson: {
          characterId: "character-2",
          serverId: "server-1",
          serverCode: "blackberry",
          serverName: "Blackberry",
          fullName: "Игорь Юристов",
          nickname: "Игорь Юристов",
          passportNumber: "AA-002",
          isProfileComplete: true,
          roleKeys: [],
          accessFlags: [],
          capturedAt: "2026-04-22T10:00:00.000Z",
        },
        formPayloadJson: {
          filingMode: "self",
          respondentName: "",
          claimSubject: "",
          factualBackground: "",
          legalBasisSummary: "",
          requestedRelief: "",
          workingNotes: "Claims notes",
          trustorSnapshot: null,
          evidenceGroups: [],
          caseReference: "",
          rehabilitationBasis: "",
          harmSummary: "",
        },
        generatedArtifactJson: null,
        generatedArtifactText: null,
        generatedOutputFormat: null,
        generatedRendererVersion: null,
        lastGeneratedBbcode: null,
        generatedAt: null,
        generatedLawVersion: null,
        generatedTemplateVersion: null,
        generatedFormSchemaVersion: null,
        publicationUrl: null,
        isSiteForumSynced: false,
        isModifiedAfterGeneration: false,
        deletedAt: null,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        updatedAt: new Date("2026-04-22T10:05:00.000Z"),
        server: blackberryServer,
      },
    ]);

    const result = await getAccountDocumentsOverviewContext("/account/documents");

    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        id: "claim-1",
        documentType: "rehabilitation",
        subtype: "rehabilitation",
        filingMode: "self",
        workingNotesPreview: "Claims notes",
      }),
    );
  });

  it("claims family route показывает persisted rehabilitation/lawsuit документы на сервере", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getServerByCode).mockResolvedValue(blackberryServer);
    vi.mocked(getUserServerStates).mockResolvedValue([]);
    vi.mocked(getCharactersByServer).mockResolvedValue([
      {
        id: "character-2",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: true,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        updatedAt: new Date("2026-04-22T10:00:00.000Z"),
        roles: [],
        accessFlags: [],
      },
    ]);
    vi.mocked(listDocumentsByAccountAndServerAndType)
      .mockResolvedValueOnce([
        {
          id: "claim-1",
          accountId: accountContext.account.id,
          serverId: "server-1",
          characterId: "character-2",
          documentType: "rehabilitation",
          title: "Документ по реабилитации",
          status: "draft",
          formSchemaVersion: "rehabilitation_claim_mvp_editor_v1",
          snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
          authorSnapshotJson: {
            characterId: "character-2",
            serverId: "server-1",
            serverCode: "blackberry",
            serverName: "Blackberry",
            fullName: "Игорь Юристов",
            nickname: "Игорь Юристов",
            passportNumber: "AA-002",
            isProfileComplete: true,
            roleKeys: [],
            accessFlags: [],
            capturedAt: "2026-04-22T10:00:00.000Z",
          },
          formPayloadJson: {
            filingMode: "self",
            respondentName: "",
            claimSubject: "",
            factualBackground: "",
            legalBasisSummary: "",
            requestedRelief: "",
            workingNotes: "Rehab notes",
            trustorSnapshot: null,
            evidenceGroups: [],
            caseReference: "",
            rehabilitationBasis: "",
            harmSummary: "",
          },
          generatedArtifactJson: null,
          generatedArtifactText: null,
          generatedOutputFormat: null,
          generatedRendererVersion: null,
          lastGeneratedBbcode: null,
          generatedAt: null,
          generatedLawVersion: null,
          generatedTemplateVersion: null,
          generatedFormSchemaVersion: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          isModifiedAfterGeneration: false,
          deletedAt: null,
          createdAt: new Date("2026-04-22T10:00:00.000Z"),
          updatedAt: new Date("2026-04-22T10:05:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "claim-2",
          accountId: accountContext.account.id,
          serverId: "server-1",
          characterId: "character-2",
          documentType: "lawsuit",
          title: "Исковое заявление",
          status: "draft",
          formSchemaVersion: "lawsuit_claim_mvp_editor_v1",
          snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
          authorSnapshotJson: {
            characterId: "character-2",
            serverId: "server-1",
            serverCode: "blackberry",
            serverName: "Blackberry",
            fullName: "Игорь Юристов",
            nickname: "Игорь Юристов",
            passportNumber: "AA-002",
            isProfileComplete: true,
            roleKeys: [],
            accessFlags: [],
            capturedAt: "2026-04-22T10:00:00.000Z",
          },
          formPayloadJson: {
            filingMode: "self",
            respondentName: "",
            claimSubject: "",
            factualBackground: "",
            legalBasisSummary: "",
            requestedRelief: "",
            workingNotes: "Lawsuit notes",
            trustorSnapshot: null,
            evidenceGroups: [],
            courtName: "",
            defendantName: "",
            claimAmount: "",
            pretrialSummary: "",
          },
          generatedArtifactJson: null,
          generatedArtifactText: null,
          generatedOutputFormat: null,
          generatedRendererVersion: null,
          lastGeneratedBbcode: null,
          generatedAt: null,
          generatedLawVersion: null,
          generatedTemplateVersion: null,
          generatedFormSchemaVersion: null,
          publicationUrl: null,
          isSiteForumSynced: false,
          isModifiedAfterGeneration: false,
          deletedAt: null,
          createdAt: new Date("2026-04-22T10:00:00.000Z"),
          updatedAt: new Date("2026-04-22T10:10:00.000Z"),
        },
      ]);

    const result = await getClaimsFamilyRouteContext({
      serverSlug: "blackberry",
      nextPath: "/servers/blackberry/documents/claims",
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.canCreateDocuments).toBe(true);
      expect(result.documents).toHaveLength(2);
      expect(result.documents[0]).toEqual(
        expect.objectContaining({
          documentType: "lawsuit",
          subtype: "lawsuit",
        }),
      );
      expect(result.documents[1]).toEqual(
        expect.objectContaining({
          documentType: "rehabilitation",
          subtype: "rehabilitation",
        }),
      );
    }
  });

  it("claims editor route отдаёт только owner-account persisted claim", async () => {
    vi.mocked(requireProtectedAccountContext).mockResolvedValue(accountContext);
    vi.mocked(getServers).mockResolvedValue([blackberryServer]);
    vi.mocked(getServerByCode).mockResolvedValue(blackberryServer);
    vi.mocked(getDocumentByIdForAccount).mockResolvedValue({
      id: "claim-1",
      accountId: accountContext.account.id,
      serverId: "server-1",
      characterId: "character-1",
      documentType: "rehabilitation",
      title: "Документ по реабилитации",
      status: "draft",
      formSchemaVersion: "rehabilitation_claim_mvp_editor_v1",
      snapshotCapturedAt: new Date("2026-04-22T10:00:00.000Z"),
      authorSnapshotJson: {
        characterId: "character-1",
        serverId: "server-1",
        serverCode: "blackberry",
        serverName: "Blackberry",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: true,
        roleKeys: ["lawyer"],
        accessFlags: [],
        capturedAt: "2026-04-22T10:00:00.000Z",
      },
      formPayloadJson: {
        filingMode: "self",
        respondentName: "",
        claimSubject: "",
        factualBackground: "",
        legalBasisSummary: "",
        requestedRelief: "",
        workingNotes: "Claims notes",
        trustorSnapshot: null,
        evidenceGroups: [],
        caseReference: "",
        rehabilitationBasis: "",
        harmSummary: "",
      },
      generatedArtifactJson: null,
      generatedArtifactText: null,
      generatedOutputFormat: null,
      generatedRendererVersion: null,
      lastGeneratedBbcode: null,
      generatedAt: null,
      generatedLawVersion: null,
      generatedTemplateVersion: null,
      generatedFormSchemaVersion: null,
      publicationUrl: null,
      isSiteForumSynced: false,
      isModifiedAfterGeneration: false,
      deletedAt: null,
      createdAt: new Date("2026-04-22T10:00:00.000Z"),
      updatedAt: new Date("2026-04-22T10:05:00.000Z"),
      server: blackberryServer,
      character: {
        id: "character-1",
        accountId: accountContext.account.id,
        serverId: "server-1",
        fullName: "Игорь Юристов",
        nickname: "Игорь Юристов",
        passportNumber: "AA-002",
        isProfileComplete: true,
        profileDataJson: null,
        deletedAt: null,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        updatedAt: new Date("2026-04-22T10:00:00.000Z"),
        roles: [
          {
            id: "role-1",
            characterId: "character-1",
            roleKey: "lawyer",
            createdAt: new Date("2026-04-22T10:00:00.000Z"),
          },
        ],
        accessFlags: [],
      },
    });

    const result = await getClaimsEditorRouteContext({
      serverSlug: "blackberry",
      documentId: "claim-1",
      nextPath: "/servers/blackberry/documents/claims/claim-1",
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.document.documentType).toBe("rehabilitation");
      expect(result.document.payload).toEqual({
        filingMode: "self",
        respondentName: "",
        claimSubject: "",
        factualBackground: "",
        legalBasisSummary: "",
        requestedRelief: "",
        workingNotes: "Claims notes",
        trustorSnapshot: null,
        evidenceGroups: [],
        caseReference: "",
        rehabilitationBasis: "",
        harmSummary: "",
      });
    }
  });
});



