import type { OgpComplaintTrustorSnapshot } from "@/schemas/document";

export type TrustorRegistryPrefillOption = {
  id: string;
  fullName: string;
  passportNumber: string;
  phone: string | null;
  note: string | null;
  isRepresentativeReady: boolean;
};

export function applyTrustorRegistryPrefill(
  trustor: TrustorRegistryPrefillOption,
  currentSnapshot?: OgpComplaintTrustorSnapshot | null,
): OgpComplaintTrustorSnapshot {
  return {
    sourceType: currentSnapshot?.sourceType ?? "inline_manual",
    fullName: trustor.fullName,
    passportNumber: trustor.passportNumber,
    note: trustor.note ?? "",
  };
}
