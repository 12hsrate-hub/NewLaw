import type { DocumentAuthorSnapshot } from "@/schemas/document";

export function buildDocumentEditorServerSummary(server: {
  code: string;
  name: string;
}) {
  return {
    code: server.code,
    name: server.name,
  };
}

export function buildDocumentEditorAuthorSnapshotSummary(authorSnapshot: DocumentAuthorSnapshot) {
  return {
    fullName: authorSnapshot.fullName,
    passportNumber: authorSnapshot.passportNumber,
    position: authorSnapshot.position,
    address: authorSnapshot.address,
    phone: authorSnapshot.phone,
    icEmail: authorSnapshot.icEmail,
    passportImageUrl: authorSnapshot.passportImageUrl,
    nickname: authorSnapshot.nickname,
    roleKeys: authorSnapshot.roleKeys,
    accessFlags: authorSnapshot.accessFlags,
    isProfileComplete: authorSnapshot.isProfileComplete,
  };
}

export function buildInvalidDocumentDataSummary(document: {
  id: string;
  title: string;
  status: "draft" | "generated" | "published";
  createdAt: Date;
  updatedAt: Date;
  snapshotCapturedAt: Date;
}) {
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    snapshotCapturedAt: document.snapshotCapturedAt.toISOString(),
    dataHealth: "invalid_payload" as const,
  };
}
