import type { PrimaryShellContext } from "@/server/primary-shell/context";
import { getProtectedServerHubContext } from "@/server/server-directory/hub";

export type HomeDashboardContext = {
  activeServer: {
    name: string | null;
    slug: string | null;
  };
  quickActions: {
    assistantHref: string;
    documentsHref: string;
    documentsHelperText: string | null;
    lawyerWorkspaceHref: string | null;
    serversHref: string;
    accountHref: string;
    internalHref: string | null;
  };
  tools: {
    assistant: {
      href: string;
      helperText: string | null;
    };
    documents: {
      href: string;
      actionLabel: string;
      helperText: string | null;
    };
    servers: {
      href: string;
    };
    account: {
      href: string;
    };
    lawyer: {
      href: string;
    } | null;
    internal: {
      href: string;
    } | null;
  };
  placeholders: {
    requiresAttention: string;
    recentActivity: string;
  };
};

function hasCharacterRequirement(context: Awaited<ReturnType<typeof getProtectedServerHubContext>>) {
  if (context.status !== "ready") {
    return false;
  }

  const blockReasons = context.documentEntryCapabilities?.blockReasons ?? [];

  return (
    blockReasons.includes("character_required") &&
    (!context.documentEntryCapabilities?.canCreateSelfComplaint ||
      !context.documentEntryCapabilities?.canCreateClaims)
  );
}

function hasAssistantMaterialsRequirement(
  context: Awaited<ReturnType<typeof getProtectedServerHubContext>>,
) {
  if (context.status !== "ready") {
    return false;
  }

  return context.workspaceCapabilities?.blockReasons.includes("materials_unavailable") ?? false;
}

function resolveDocumentsHelperText(
  context: Awaited<ReturnType<typeof getProtectedServerHubContext>> | null,
) {
  if (!context) {
    return "Чтобы перейти к документам по серверу, сначала выберите сервер в шапке или откройте список серверов.";
  }

  if (context.status !== "ready") {
    return "Документы для выбранного сервера сейчас недоступны. Откройте список серверов и выберите другой сервер.";
  }

  const blockReasons = context.documentEntryCapabilities?.blockReasons ?? [];

  if (
    blockReasons.includes("character_required") &&
    (!context.documentEntryCapabilities?.canCreateSelfComplaint ||
      !context.documentEntryCapabilities?.canCreateClaims)
  ) {
    return "Раздел можно открыть уже сейчас, но для жалоб и исков сначала нужен персонаж на этом сервере.";
  }

  if (
    blockReasons.includes("advocate_character_required") &&
    (!context.documentEntryCapabilities?.canCreateAttorneyRequest ||
      !context.documentEntryCapabilities?.canCreateLegalServicesAgreement)
  ) {
    return "Для адвокатских документов потребуется персонаж с адвокатским доступом.";
  }

  if (
    blockReasons.includes("trustor_required_temporarily") &&
    (!context.documentEntryCapabilities?.canCreateAttorneyRequest ||
      !context.documentEntryCapabilities?.canCreateLegalServicesAgreement)
  ) {
    return "В текущей версии для некоторых адвокатских действий нужен сохранённый доверитель.";
  }

  return "Откройте документы по активному серверу, чтобы перейти к жалобам, искам и другим действиям.";
}

function resolveAssistantHelperText(
  shellContext: PrimaryShellContext,
  context: Awaited<ReturnType<typeof getProtectedServerHubContext>> | null,
) {
  if (!shellContext.activeServer.slug || !shellContext.activeServer.name) {
    return "Откройте помощника и выберите нужный сервер, когда понадобится рабочий контекст.";
  }

  if (context && hasAssistantMaterialsRequirement(context)) {
    return `Для сервера «${shellContext.activeServer.name}» пока недостаточно правовых материалов.`;
  }

  return `Активный сервер: ${shellContext.activeServer.name}. При необходимости его можно сменить в шапке.`;
}

function resolveRequiresAttention(
  shellContext: PrimaryShellContext,
  context: Awaited<ReturnType<typeof getProtectedServerHubContext>> | null,
) {
  if (!shellContext.activeServer.slug) {
    return "Выберите активный сервер в шапке, чтобы быстрее переходить к документам и подсказкам по нему.";
  }

  if (context && hasCharacterRequirement(context)) {
    return "На активном сервере для жалоб и исков сначала нужен персонаж.";
  }

  if (context && hasAssistantMaterialsRequirement(context)) {
    return "Для активного сервера пока недостаточно материалов для юридического помощника.";
  }

  return "Сейчас срочных действий не найдено. Здесь позже появятся приоритетные напоминания.";
}

export async function getHomeDashboardContext(input: {
  shellContext: PrimaryShellContext;
}): Promise<HomeDashboardContext> {
  const { shellContext } = input;
  const activeServerSlug = shellContext.activeServer.slug;
  const activeServerContext = activeServerSlug
    ? await getProtectedServerHubContext({
        serverSlug: activeServerSlug,
        nextPath: `/servers/${activeServerSlug}`,
      })
    : null;
  const canOpenDocuments =
    activeServerContext?.status === "ready" &&
    (activeServerContext.workspaceCapabilities?.canOpenDocumentsWorkspace ?? true);
  const documentsHref =
    activeServerSlug && canOpenDocuments ? `/servers/${activeServerSlug}/documents` : null;
  const lawyerWorkspaceHref = shellContext.navigation.lawyerWorkspaceHref;

  return {
    activeServer: {
      name: shellContext.activeServer.name,
      slug: shellContext.activeServer.slug,
    },
    quickActions: {
      assistantHref: "/assistant",
      documentsHref: documentsHref ?? "/servers",
      documentsHelperText: documentsHref
        ? null
        : "Сначала выберите сервер, чтобы открыть документы.",
      lawyerWorkspaceHref,
      serversHref: "/servers",
      accountHref: "/account",
      internalHref: shellContext.navigation.internalHref,
    },
    tools: {
      assistant: {
        href: "/assistant",
        helperText: resolveAssistantHelperText(shellContext, activeServerContext),
      },
      documents: {
        href: documentsHref ?? "/servers",
        actionLabel: documentsHref ? "Открыть документы" : "Открыть серверы",
        helperText: resolveDocumentsHelperText(activeServerContext),
      },
      servers: {
        href: "/servers",
      },
      account: {
        href: "/account",
      },
      lawyer: lawyerWorkspaceHref
        ? {
            href: lawyerWorkspaceHref,
          }
        : null,
      internal: shellContext.navigation.internalHref
        ? {
            href: shellContext.navigation.internalHref,
          }
        : null,
    },
    placeholders: {
      requiresAttention: resolveRequiresAttention(shellContext, activeServerContext),
      recentActivity:
        "История последних действий появится здесь в отдельной линии развития, без перегрузки главной страницы.",
    },
  };
}
