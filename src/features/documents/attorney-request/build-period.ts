import type { AttorneyRequestPeriod } from "@/features/documents/attorney-request/types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

function formatRuDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function buildMskDate(date: string, time: string) {
  return new Date(`${date}T${time}:00+03:00`);
}

export function buildAttorneyRequestPeriod(input: {
  requestDate: string;
  timeFrom: string;
  timeTo: string;
}): AttorneyRequestPeriod {
  if (
    !datePattern.test(input.requestDate) ||
    !timePattern.test(input.timeFrom) ||
    !timePattern.test(input.timeTo)
  ) {
    return {
      crossesMidnight: false,
      periodStartAt: null,
      periodEndAt: null,
      periodDisplayText: "",
    };
  }

  const periodStart = buildMskDate(input.requestDate, input.timeFrom);
  const periodEnd = buildMskDate(input.requestDate, input.timeTo);
  const crossesMidnight = input.timeTo < input.timeFrom;

  if (crossesMidnight) {
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  }

  return {
    crossesMidnight,
    periodStartAt: periodStart.toISOString(),
    periodEndAt: periodEnd.toISOString(),
    periodDisplayText: crossesMidnight
      ? `за период с ${formatRuDate(periodStart)} ${input.timeFrom} по ${formatRuDate(periodEnd)} ${input.timeTo}`
      : `за ${formatRuDate(periodStart)} с ${input.timeFrom} по ${input.timeTo}`,
  };
}
