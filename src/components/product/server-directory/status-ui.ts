import type {
  ServerAssistantStatus,
  ServerDirectoryAvailability,
  ServerDocumentsAvailabilityForViewer,
} from "@/server/server-directory/context";

export function resolveDirectoryAvailabilityUi(status: ServerDirectoryAvailability) {
  switch (status) {
    case "active":
      return {
        label: "Доступен",
        description: "Сервер открыт для работы.",
      };
    case "maintenance":
      return {
        label: "Технические работы",
        description: "Сервер временно находится на обслуживании. Попробуйте открыть его позже.",
      };
    case "unavailable":
      return {
        label: "Недоступен",
        description: "Сервер временно недоступен. Можно выбрать другой сервер или вернуться позже.",
      };
  }
}

export function resolveAssistantStatusUi(status: ServerAssistantStatus) {
  switch (status) {
    case "current_corpus_ready":
      return {
        label: "Помощник доступен",
        description: "Для этого сервера доступны подтверждённые правовые материалы.",
      };
    case "corpus_bootstrap_incomplete":
      return {
        label: "Помощник работает с ограничениями",
        description: "Часть правовых материалов уже доступна, но ответы могут быть менее полными.",
      };
    case "corpus_stale":
      return {
        label: "Помощник работает с ограничениями",
        description: "Часть правовых материалов требует обновления. Ответы лучше проверять особенно внимательно.",
      };
    case "assistant_disabled":
      return {
        label: "Помощник временно недоступен",
        description: "Для этого сервера помощник сейчас не открыт.",
      };
    case "maintenance_mode":
      return {
        label: "Раздел временно недоступен",
        description: "Помощник для этого сервера временно отключён на время работ.",
      };
    case "no_corpus":
      return {
        label: "Помощник временно недоступен",
        description: "Для этого сервера пока не хватает подтверждённых правовых материалов.",
      };
  }
}

export function resolveDocumentsAvailabilityUi(status: ServerDocumentsAvailabilityForViewer) {
  switch (status) {
    case "available":
      return {
        label: "Документы доступны",
        description: "Можно открыть документы по выбранному серверу.",
      };
    case "needs_character":
      return {
        label: "Нужен персонаж",
        description: "Документы появятся после добавления персонажа на этом сервере.",
      };
    case "unavailable":
      return {
        label: "Документы временно недоступны",
        description: "Раздел документов откроется после восстановления доступа к серверу.",
      };
    case "requires_auth":
      return {
        label: "Нужен вход",
        description: "Чтобы открыть документы по серверу, сначала войдите в аккаунт.",
      };
  }
}
