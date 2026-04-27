"use client";

import {
  buildOgpGenerationValidationResult,
  type OgpChecklistIssue,
  type OgpGenerationReadyState,
} from "@/lib/ogp/generation-contract";
import type { TrustorRegistryPrefillOption } from "@/lib/trustors/registry-prefill";
import {
  ogpComplaintEvidenceTemplateKeys,
  type OgpComplaintDraftPayload,
  type OgpComplaintEvidenceItem,
  type OgpComplaintTrustorSnapshot,
  type OgpForumSyncState,
} from "@/schemas/document";
import type {
  ComplaintNarrativeImprovementUsageMeta,
  ComplaintNarrativeLegalBasisUsed,
  ComplaintNarrativeRiskFlag,
  DocumentFieldRewriteUsageMeta,
  GroundedDocumentFieldRewriteUsageMeta,
  GroundedDocumentReference,
  GroundedDocumentRewriteMode,
  GroundedOgpDocumentRewriteSectionKey,
  OgpDocumentRewriteSectionKey,
} from "@/schemas/document-ai";
import type { ForumConnectionSummary } from "@/schemas/forum-integration";

export type SharedCharacterContext = {
  fullName: string;
  passportNumber: string;
  position?: string;
  address?: string;
  phone?: string;
  icEmail?: string;
  passportImageUrl?: string;
  isProfileComplete: boolean;
  canUseRepresentative: boolean;
};

export type CreateCharacterOption = SharedCharacterContext & {
  id: string;
};

export type OgpComplaintDraftCreateClientProps = {
  server: {
    code: string;
    name: string;
  };
  characters: CreateCharacterOption[];
  selectedCharacter: CreateCharacterOption & {
    source: "last_used" | "first_available";
  };
  initialTitle: string;
  initialPayload: OgpComplaintDraftPayload;
  trustorRegistry: TrustorRegistryPrefillOption[];
};

export type OgpComplaintDraftEditorClientProps = {
  documentId: string;
  server: {
    code: string;
    name: string;
  };
  authorSnapshot: SharedCharacterContext;
  initialTitle: string;
  initialPayload: OgpComplaintDraftPayload;
  initialLastGeneratedBbcode: string | null;
  generatedAt: string | null;
  generatedLawVersion: string | null;
  generatedTemplateVersion: string | null;
  generatedFormSchemaVersion: string | null;
  initialPublicationUrl: string | null;
  initialIsSiteForumSynced: boolean;
  initialIsModifiedAfterGeneration: boolean;
  initialForumSyncState: OgpForumSyncState;
  initialForumThreadId: string | null;
  initialForumPostId: string | null;
  initialForumPublishedBbcodeHash: string | null;
  initialForumLastPublishedAt: string | null;
  initialForumLastSyncError: string | null;
  status: "draft" | "generated" | "published";
  forumConnection: ForumConnectionSummary;
  updatedAt: string;
  trustorRegistry: TrustorRegistryPrefillOption[];
};

export type OgpComplaintEditorState = {
  title: string;
  payload: OgpComplaintDraftPayload;
};

export type OgpComplaintGenerationState = {
  status: "draft" | "generated" | "published";
  lastGeneratedBbcode: string | null;
  generatedAt: string | null;
  generatedLawVersion: string | null;
  generatedTemplateVersion: string | null;
  generatedFormSchemaVersion: string | null;
  publicationUrl: string | null;
  isSiteForumSynced: boolean;
  isModifiedAfterGeneration: boolean;
  forumSyncState: OgpForumSyncState;
  forumThreadId: string | null;
  forumPostId: string | null;
  forumPublishedBbcodeHash: string | null;
  forumLastPublishedAt: string | null;
  forumLastSyncError: string | null;
};

export type OgpGenerationBlockState = {
  readyState: OgpGenerationReadyState;
  characterIssues: OgpChecklistIssue[];
  trustorIssues: OgpChecklistIssue[];
  documentIssues: OgpChecklistIssue[];
};

export type OgpRewriteSuggestionState = {
  sectionKey: OgpDocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  usageMeta: DocumentFieldRewriteUsageMeta;
};

export type OgpGroundedRewriteSuggestionState = {
  sectionKey: GroundedOgpDocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  groundingMode: GroundedDocumentRewriteMode;
  references: GroundedDocumentReference[];
  usageMeta: GroundedDocumentFieldRewriteUsageMeta;
};

export type OgpComplaintNarrativeImprovementSuggestionState = {
  sourceText: string;
  improvedText: string;
  basedOnUpdatedAt: string;
  legalBasisUsed: ComplaintNarrativeLegalBasisUsed[];
  usedFacts: string[];
  missingFacts: string[];
  reviewNotes: string[];
  riskFlags: ComplaintNarrativeRiskFlag[];
  shouldSendToReview: boolean;
  usageMeta: ComplaintNarrativeImprovementUsageMeta;
};

export const evidenceTemplateLabels: Record<(typeof ogpComplaintEvidenceTemplateKeys)[number], string> = {
  legal_services_contract: "Договор на оказание юридических услуг",
  attorney_request: "Адвокатский запрос",
  attorney_request_response: "Ответ на адвокатский запрос",
  trustor_recording: "Запись со стороны доверителя",
  officer_provided_recording: "Запись, предоставленная сотрудником",
  arrest_record: "Запись об аресте",
  fines_registry_extract: "Выписка из базы штрафов",
  leadership_response: "Официальный ответ руководства",
};

export function createEditorState(input: {
  title: string;
  payload: OgpComplaintDraftPayload;
}): OgpComplaintEditorState {
  return {
    title: input.title,
    payload: {
      ...input.payload,
      trustorSnapshot:
        input.payload.filingMode === "representative"
          ? (input.payload.trustorSnapshot ?? {
              sourceType: "inline_manual",
              fullName: "",
              passportNumber: "",
              address: "",
              phone: "",
              icEmail: "",
              passportImageUrl: "",
              note: "",
            })
          : null,
    },
  };
}

function createLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function areStatesEqual(left: OgpComplaintEditorState, right: OgpComplaintEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function filingModeLabel(mode: OgpComplaintDraftPayload["filingMode"]) {
  return mode === "representative" ? "как представитель" : "от своего имени";
}

export function formatGroundedSupportSummary(
  groundingMode: GroundedDocumentRewriteMode,
  references: GroundedDocumentReference[],
) {
  if (groundingMode === "law_grounded") {
    return `Опора: подтверждённые нормы закона (${references.length}). Предложение не сохраняется автоматически.`;
  }

  return `Опора: подтверждённые судебные прецеденты (${references.length}). Подходящей нормы закона не найдено, поэтому текст опирается только на прецеденты.`;
}

export function formatForumConnectionState(state: ForumConnectionSummary["state"]) {
  if (state === "not_connected") {
    return "не подключено";
  }

  if (state === "connected_unvalidated") {
    return "подключено, но не проверено";
  }

  if (state === "valid") {
    return "подключение работает";
  }

  if (state === "invalid") {
    return "нужно подключить заново";
  }

  return "отключено";
}

export function formatForumSyncState(state: OgpForumSyncState) {
  if (state === "not_published") {
    return "пока не опубликовано";
  }

  if (state === "current") {
    return "публикация актуальна";
  }

  if (state === "outdated") {
    return "требуется обновление публикации";
  }

  if (state === "failed") {
    return "не удалось опубликовать";
  }

  return "ссылка добавлена вручную";
}

export function formatDraftStatus(status: OgpComplaintGenerationState["status"]) {
  if (status === "draft") {
    return "Черновик";
  }

  if (status === "generated") {
    return "Документ собран";
  }

  return "Опубликован";
}

export function applyComplaintNarrativeImprovementSuggestion(
  payload: OgpComplaintDraftPayload,
  improvedText: string,
): OgpComplaintDraftPayload {
  return {
    ...payload,
    situationDescription: improvedText,
  };
}

export function formatComplaintNarrativeRiskFlagLabel(flag: ComplaintNarrativeRiskFlag) {
  switch (flag) {
    case "insufficient_facts":
      return "Недостаточно фактов";
    case "weak_legal_context":
      return "Слабый правовой контекст";
    case "missing_evidence":
      return "Не хватает указанного доказательства";
    case "unclear_roles":
      return "Нужно проверить роли участников";
    case "unclear_timeline":
      return "Неясная хронология";
    case "ambiguous_date_time":
      return "Уточните назначение даты/времени";
    case "possible_overclaiming":
      return "Проверьте категоричность формулировок";
    case "legal_basis_not_found":
      return "Нормы не были подтверждены";
  }
}

export function formatComplaintNarrativeBlockedMessage(reasons: string[]) {
  const normalizedReasons = reasons
    .map((reason) => reason.trim().replace(/[.。]+$/u, ""))
    .filter((reason) => reason.length > 0);

  if (normalizedReasons.length === 0) {
    return "Для улучшения описания заполните обязательные поля жалобы.";
  }

  return `Для улучшения описания заполните обязательные поля: ${normalizedReasons.join("; ")}.`;
}

export function buildEmptyEvidenceItem(sortOrder: number): OgpComplaintEvidenceItem {
  const firstTemplateKey = ogpComplaintEvidenceTemplateKeys[0];

  return {
    id: createLocalId("evidence_item"),
    mode: "template",
    templateKey: firstTemplateKey,
    labelSnapshot: evidenceTemplateLabels[firstTemplateKey],
    url: "",
    sortOrder,
  };
}

export function buildEmptyTrustorSnapshot(): OgpComplaintTrustorSnapshot {
  return {
    sourceType: "inline_manual",
    fullName: "",
    passportNumber: "",
    address: "",
    phone: "",
    icEmail: "",
    passportImageUrl: "",
    note: "",
  };
}

export function buildEmptyOgpComplaintPayload(
  filingMode: OgpComplaintDraftPayload["filingMode"] = "self",
): OgpComplaintDraftPayload {
  return {
    filingMode,
    appealNumber: "",
    objectOrganization: "",
    objectFullName: "",
    incidentAt: "",
    situationDescription: "",
    violationSummary: "",
    workingNotes: "",
    trustorSnapshot: filingMode === "representative" ? buildEmptyTrustorSnapshot() : null,
    evidenceItems: [],
  };
}

export function createGenerationState(input: {
  status: "draft" | "generated" | "published";
  lastGeneratedBbcode: string | null;
  generatedAt: string | null;
  generatedLawVersion: string | null;
  generatedTemplateVersion: string | null;
  generatedFormSchemaVersion: string | null;
  publicationUrl: string | null;
  isSiteForumSynced: boolean;
  isModifiedAfterGeneration: boolean;
  forumSyncState: OgpForumSyncState;
  forumThreadId: string | null;
  forumPostId: string | null;
  forumPublishedBbcodeHash: string | null;
  forumLastPublishedAt: string | null;
  forumLastSyncError: string | null;
}): OgpComplaintGenerationState {
  return {
    status: input.status,
    lastGeneratedBbcode: input.lastGeneratedBbcode,
    generatedAt: input.generatedAt,
    generatedLawVersion: input.generatedLawVersion,
    generatedTemplateVersion: input.generatedTemplateVersion,
    generatedFormSchemaVersion: input.generatedFormSchemaVersion,
    publicationUrl: input.publicationUrl,
    isSiteForumSynced: input.isSiteForumSynced,
    isModifiedAfterGeneration: input.isModifiedAfterGeneration,
    forumSyncState: input.forumSyncState,
    forumThreadId: input.forumThreadId,
    forumPostId: input.forumPostId,
    forumPublishedBbcodeHash: input.forumPublishedBbcodeHash,
    forumLastPublishedAt: input.forumLastPublishedAt,
    forumLastSyncError: input.forumLastSyncError,
  };
}

export function buildGenerationBlockState(input: {
  authorSnapshot: SharedCharacterContext;
  payload: OgpComplaintDraftPayload;
}): OgpGenerationBlockState {
  const validation = buildOgpGenerationValidationResult({
    characterProfile: {
      fullName: input.authorSnapshot.fullName,
      position: input.authorSnapshot.position ?? "",
      address: input.authorSnapshot.address ?? "",
      passportNumber: input.authorSnapshot.passportNumber,
      phone: input.authorSnapshot.phone ?? "",
      icEmail: input.authorSnapshot.icEmail ?? "",
      passportImageUrl: input.authorSnapshot.passportImageUrl ?? "",
    },
    trustorProfile:
      input.payload.filingMode === "representative" && input.payload.trustorSnapshot
        ? {
            fullName: input.payload.trustorSnapshot.fullName,
            passportNumber: input.payload.trustorSnapshot.passportNumber,
            address: input.payload.trustorSnapshot.address,
            phone: input.payload.trustorSnapshot.phone,
            icEmail: input.payload.trustorSnapshot.icEmail,
            passportImageUrl: input.payload.trustorSnapshot.passportImageUrl,
          }
        : null,
    documentPayload: {
      appealNumber: input.payload.appealNumber,
      organizationName: input.payload.objectOrganization,
      subjectLabel: input.payload.objectFullName,
      incidentAt: input.payload.incidentAt,
      situationDescription: input.payload.situationDescription,
      violationSummary: input.payload.violationSummary,
      evidenceItems: input.payload.evidenceItems,
    },
  });

  return {
    readyState: validation.readyState,
    characterIssues: validation.characterIssues,
    trustorIssues: validation.trustorIssues,
    documentIssues: validation.documentIssues,
  };
}

export function formatGenerationReadyState(readyState: OgpGenerationReadyState) {
  if (readyState === "generation_ready") {
    return "готово к генерации";
  }

  if (readyState === "blocked_by_character_profile") {
    return "нужно заполнить профиль персонажа";
  }

  if (readyState === "blocked_by_trustor_snapshot") {
    return "нужно заполнить данные доверителя";
  }

  if (readyState === "blocked_by_document_payload") {
    return "нужно заполнить поля жалобы";
  }

  return "нужно заполнить несколько разделов";
}
