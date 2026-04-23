import type {
  AttorneyRequestAddresseePresetKey,
  AttorneyRequestSignerTitleSnapshot,
} from "@/features/documents/attorney-request/types";

export const attorneyRequestAddresseePresets: Record<
  AttorneyRequestAddresseePresetKey,
  {
    label: string;
    section3Target: string;
  }
> = {
  LSPD_CHIEF: {
    label: "Шефу LSPD",
    section3Target: "Шефу LSPD и его заместителям",
  },
  LSSD_SHERIFF: {
    label: "Шерифу LSSD",
    section3Target: "Шерифу LSSD и его заместителям",
  },
  FIB_DIRECTOR: {
    label: "Директору FIB",
    section3Target: "Директору FIB и его заместителям",
  },
  NG_GENERAL: {
    label: "Генералу NG",
    section3Target: "Генералу NG и его заместителям",
  },
  EMS_CHIEF_DOCTOR: {
    label: "Главному Врачу EMS",
    section3Target: "Главному Врачу EMS и его заместителям",
  },
  SASPA_CHIEF: {
    label: "Начальнику SASPA",
    section3Target: "Начальнику SASPA и его заместителям",
  },
  USSS_DIRECTOR: {
    label: "Директору USSS",
    section3Target: "Директору USSS и его заместителям",
  },
};

export const attorneyRequestAddresseePresetKeys = Object.keys(
  attorneyRequestAddresseePresets,
) as AttorneyRequestAddresseePresetKey[];

const signerTitlePresets: Record<string, Omit<AttorneyRequestSignerTitleSnapshot, "sourceTitle">> = {
  "адвокат": {
    leftColumnEn: "Lawyer",
    bodyRu: "Адвокат Штата Сан-Андреас",
    footerRu: "Адвокат",
  },
  "заместитель главы коллегии адвокатов": {
    leftColumnEn: "Deputy Head of Bar Association",
    bodyRu: "Заместитель Главы Коллегии Адвокатов штата Сан-Андреас",
    footerRu: "Заместитель Главы Коллегии Адвокатов",
  },
  "глава коллегии адвокатов": {
    leftColumnEn: "Head of Bar Association",
    bodyRu: "Глава Коллегии Адвокатов штата Сан-Андреас",
    footerRu: "Глава Коллегии Адвокатов",
  },
};

function normalizeTitleKey(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveAttorneyRequestSignerTitle(
  sourceTitle: string,
): AttorneyRequestSignerTitleSnapshot | null {
  const trimmedSourceTitle = sourceTitle.trim();

  if (trimmedSourceTitle.length === 0) {
    return null;
  }

  const normalized = normalizeTitleKey(trimmedSourceTitle);
  const preset = signerTitlePresets[normalized];

  if (!preset) {
    return {
      sourceTitle: trimmedSourceTitle,
      leftColumnEn: trimmedSourceTitle,
      bodyRu: trimmedSourceTitle,
      footerRu: trimmedSourceTitle,
    };
  }

  return {
    sourceTitle: trimmedSourceTitle,
    ...preset,
  };
}
