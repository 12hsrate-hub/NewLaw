import type { OgpComplaintTrustorSnapshot } from "@/schemas/document";
import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
} from "@/lib/ogp/generation-contract";

export type TrustorRegistryPrefillOption = {
  id: string;
  fullName: string;
  passportNumber: string;
  phone: string | null;
  icEmail?: string | null;
  passportImageUrl?: string | null;
  note: string | null;
  isRepresentativeReady: boolean;
};

export function applyTrustorRegistryPrefill(
  trustor: TrustorRegistryPrefillOption,
  _currentSnapshot?: OgpComplaintTrustorSnapshot | null,
): OgpComplaintTrustorSnapshot {
  void _currentSnapshot;

  return {
    sourceType: "registry_prefill",
    fullName: trustor.fullName,
    passportNumber: normalizePassportNumber(trustor.passportNumber),
    phone: normalizePhone(trustor.phone ?? ""),
    icEmail: normalizeIcEmail(trustor.icEmail ?? ""),
    passportImageUrl: normalizeSafeUrl(trustor.passportImageUrl ?? ""),
    note: trustor.note ?? "",
  };
}
