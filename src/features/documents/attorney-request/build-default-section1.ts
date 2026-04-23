import type {
  AttorneyRequestPeriod,
  AttorneyRequestSection1Item,
  AttorneyRequestTrustorSnapshot,
} from "@/features/documents/attorney-request/types";

export function buildDefaultAttorneyRequestSection1(input: {
  contractNumber: string;
  trustorSnapshot: AttorneyRequestTrustorSnapshot;
  targetOfficerInput: string;
  period: AttorneyRequestPeriod;
  authorIcEmail: string;
}): AttorneyRequestSection1Item[] {
  const trustorName = input.trustorSnapshot.fullName || "доверителя";
  const targetOfficer = input.targetOfficerInput || "указанного сотрудника";
  const period = input.period.periodDisplayText || "за указанный период";
  const contract = input.contractNumber || "указанному договору";
  const email = input.authorIcEmail || "игровую почту адвоката";

  return [
    {
      id: "1",
      text: `Прошу предоставить видеозаписи и материалы фиксации процессуальных действий в отношении ${trustorName} по договору №${contract} ${period}, связанных с сотрудником / нашивкой: ${targetOfficer}. Ответ прошу направить на игровую почту: ${email}.`,
    },
    {
      id: "2",
      text: `Если процессуальные действия в отношении ${trustorName} проводились вне указанного периода, прошу предоставить полную видеозапись за соответствующую дату с участием сотрудника / нашивки: ${targetOfficer}.`,
    },
    {
      id: "3",
      text: `Прошу предоставить личные данные сотрудника / нашивки ${targetOfficer}, необходимые для защиты прав и законных интересов доверителя ${trustorName}.`,
    },
  ];
}
