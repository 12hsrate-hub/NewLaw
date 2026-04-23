import { attorneyRequestAddresseePresets } from "@/features/documents/attorney-request/presets";
import type { AttorneyRequestAddresseePresetKey } from "@/features/documents/attorney-request/types";

export function buildDefaultAttorneyRequestSection3(input: {
  addresseePreset: AttorneyRequestAddresseePresetKey | null;
  targetOfficerInput: string;
}) {
  const orgTarget = input.addresseePreset
    ? attorneyRequestAddresseePresets[input.addresseePreset].section3Target
    : "выбранному адресату";
  const targetOfficer = input.targetOfficerInput || "указанному сотруднику / нашивке";

  return `Адвокатский запрос о предоставлении личных данных (п. 3) направлен ${orgTarget}. Адвокатский запрос о предоставлении видеофиксации (п. 1, п. 2) направлен ${targetOfficer}.`;
}
