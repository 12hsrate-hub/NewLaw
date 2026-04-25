import type { TrustorRegistryPrefillOption } from "@/lib/trustors/registry-prefill";
import type {
  ClaimDocumentType,
  ClaimsDraftPayload,
  ClaimsRenderedOutput,
  OgpComplaintEvidenceGroup,
  OgpComplaintEvidenceRow,
  OgpComplaintTrustorSnapshot,
} from "@/schemas/document";
import type {
  ClaimsDocumentRewriteSectionKey,
  DocumentFieldRewriteUsageMeta,
  GroundedClaimsDocumentRewriteSectionKey,
  GroundedDocumentFieldRewriteUsageMeta,
  GroundedDocumentReference,
  GroundedDocumentRewriteMode,
} from "@/schemas/document-ai";

export type SharedCharacterContext = {
  fullName: string;
  passportNumber: string;
  position?: string;
  phone?: string;
  icEmail?: string;
  passportImageUrl?: string;
  isProfileComplete: boolean;
  canUseRepresentative: boolean;
};

export type CreateCharacterOption = SharedCharacterContext & {
  id: string;
};

export type ClaimsDraftCreateClientProps = {
  server: {
    code: string;
    name: string;
  };
  documentType: ClaimDocumentType;
  characters: CreateCharacterOption[];
  selectedCharacter: CreateCharacterOption & {
    source: "last_used" | "first_available";
  };
  initialTitle: string;
  initialPayload: ClaimsDraftPayload;
  trustorRegistry: TrustorRegistryPrefillOption[];
};

export type ClaimsDraftEditorClientProps = {
  documentId: string;
  documentType: ClaimDocumentType;
  server: {
    code: string;
    name: string;
  };
  authorSnapshot: SharedCharacterContext;
  initialTitle: string;
  initialPayload: ClaimsDraftPayload;
  status: "draft" | "generated" | "published";
  updatedAt: string;
  generatedAt: string | null;
  generatedFormSchemaVersion: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  generatedArtifact: ClaimsRenderedOutput | null;
  isModifiedAfterGeneration: boolean;
  trustorRegistry: TrustorRegistryPrefillOption[];
};

export type ClaimsPreviewState = ClaimsRenderedOutput | null;

export type ClaimsGenerationState = {
  status: "draft" | "generated" | "published";
  generatedAt: string | null;
  generatedFormSchemaVersion: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  isModifiedAfterGeneration: boolean;
};

export type ClaimsEditorState = {
  title: string;
  payload: ClaimsDraftPayload;
};

export type ClaimsRewriteSuggestionState = {
  sectionKey: ClaimsDocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  usageMeta: DocumentFieldRewriteUsageMeta;
};

export type ClaimsGroundedRewriteSuggestionState = {
  sectionKey: GroundedClaimsDocumentRewriteSectionKey;
  sectionLabel: string;
  sourceText: string;
  suggestionText: string;
  basedOnUpdatedAt: string;
  groundingMode: GroundedDocumentRewriteMode;
  references: GroundedDocumentReference[];
  usageMeta: GroundedDocumentFieldRewriteUsageMeta;
};

function createLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildEmptyEvidenceGroup(): OgpComplaintEvidenceGroup {
  return {
    id: createLocalId("claim_evidence_group"),
    title: "",
    rows: [],
  };
}

export function buildEmptyEvidenceRow(): OgpComplaintEvidenceRow {
  return {
    id: createLocalId("claim_evidence_row"),
    mode: "link",
    templateKey: "custom",
    labelSnapshot: "",
    label: "",
    url: "",
    note: "",
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

export function createEditorState(input: {
  title: string;
  payload: ClaimsDraftPayload;
}): ClaimsEditorState {
  return {
    title: input.title,
    payload: {
      ...input.payload,
      trustorSnapshot:
        input.payload.filingMode === "representative"
          ? (input.payload.trustorSnapshot ?? buildEmptyTrustorSnapshot())
          : null,
    },
  };
}

export function areStatesEqual(left: ClaimsEditorState, right: ClaimsEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createGenerationState(input: {
  status: "draft" | "generated" | "published";
  generatedAt: string | null;
  generatedFormSchemaVersion: string | null;
  generatedOutputFormat: string | null;
  generatedRendererVersion: string | null;
  isModifiedAfterGeneration: boolean;
}): ClaimsGenerationState {
  return {
    status: input.status,
    generatedAt: input.generatedAt,
    generatedFormSchemaVersion: input.generatedFormSchemaVersion,
    generatedOutputFormat: input.generatedOutputFormat,
    generatedRendererVersion: input.generatedRendererVersion,
    isModifiedAfterGeneration: input.isModifiedAfterGeneration,
  };
}

export function formatSubtypeLabel(documentType: ClaimDocumentType) {
  return documentType === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

export function filingModeLabel(mode: ClaimsDraftPayload["filingMode"]) {
  return mode === "representative" ? "Representative" : "Self";
}

export function formatGroundedSupportSummary(
  groundingMode: GroundedDocumentRewriteMode,
  references: GroundedDocumentReference[],
) {
  if (groundingMode === "law_grounded") {
    return `Опора: подтверждённые нормы закона (${references.length}). Suggestion остаётся локальным и не сохраняется автоматически.`;
  }

  return `Опора: подтверждённые судебные прецеденты (${references.length}). Норма закона по retrieval не найдена, поэтому suggestion остаётся precedent-grounded.`;
}
