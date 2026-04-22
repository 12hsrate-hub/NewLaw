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
        description: "Сервер открыт для user-facing модулей.",
      };
    case "maintenance":
      return {
        label: "Maintenance",
        description: "Сервер временно находится в обслуживании.",
      };
    case "unavailable":
      return {
        label: "Недоступен",
        description: "Сервер виден в каталоге, но user-facing вход сейчас закрыт.",
      };
  }
}

export function resolveAssistantStatusUi(status: ServerAssistantStatus) {
  switch (status) {
    case "current_corpus_ready":
      return {
        label: "Assistant ready",
        description: "Подтверждённый corpus готов для работы assistant.",
      };
    case "corpus_bootstrap_incomplete":
      return {
        label: "Assistant limited",
        description: "Corpus уже собран частично, но ещё не считается полностью готовым.",
      };
    case "corpus_stale":
      return {
        label: "Assistant limited",
        description: "Corpus требует внимания, поэтому ответы лучше проверять особенно внимательно.",
      };
    case "assistant_disabled":
      return {
        label: "Assistant disabled",
        description: "Assistant для этого сервера сейчас недоступен.",
      };
    case "maintenance_mode":
      return {
        label: "Server maintenance",
        description: "Обычный assistant flow временно выключен из-за обслуживания сервера.",
      };
    case "no_corpus":
      return {
        label: "Assistant unavailable",
        description: "Подтверждённого corpus для assistant пока нет.",
      };
  }
}

export function resolveDocumentsAvailabilityUi(status: ServerDocumentsAvailabilityForViewer) {
  switch (status) {
    case "available":
      return {
        label: "Documents доступны",
        description: "Можно открыть server-scoped document area по этому серверу.",
      };
    case "needs_character":
      return {
        label: "Нужен персонаж",
        description: "Документы появятся после добавления персонажа на этом сервере.",
      };
    case "unavailable":
      return {
        label: "Documents недоступны",
        description: "Пока сервер недоступен, document area тоже закрыта.",
      };
    case "requires_auth":
      return {
        label: "Нужен вход",
        description: "Documents остаются private route и открываются только после входа.",
      };
  }
}
