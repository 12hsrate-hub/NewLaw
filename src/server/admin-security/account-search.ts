import {
  getAccountByEmail,
  getAccountById,
  getAccountByLogin,
} from "@/db/repositories/account.repository";
import { adminAccountSearchIdentifierSchema } from "@/schemas/account-security";

type AccountSearchDependencies = {
  getAccountById: typeof getAccountById;
  getAccountByEmail: typeof getAccountByEmail;
  getAccountByLogin: typeof getAccountByLogin;
};

const defaultDependencies: AccountSearchDependencies = {
  getAccountById,
  getAccountByEmail,
  getAccountByLogin,
};

export type AdminAccountSearchResult =
  | {
      status: "idle";
      identifier: "";
      account: null;
      message: null;
    }
  | {
      status: "invalid";
      identifier: string;
      account: null;
      message: string;
    }
  | {
      status: "not-found";
      identifier: string;
      account: null;
      message: string;
    }
  | {
      status: "found";
      identifier: string;
      account: Awaited<ReturnType<typeof getAccountById>>;
      message: null;
    };

export async function findAccountForAdminSearch(
  rawIdentifier: string | null | undefined,
  dependencies: AccountSearchDependencies = defaultDependencies,
): Promise<AdminAccountSearchResult> {
  const identifier = rawIdentifier?.trim() ?? "";

  if (!identifier) {
    return {
      status: "idle",
      identifier: "",
      account: null,
      message: null,
    };
  }

  const parsed = adminAccountSearchIdentifierSchema.safeParse(identifier);

  if (!parsed.success) {
    return {
      status: "invalid",
      identifier,
      account: null,
      message: parsed.error.issues[0]?.message ?? "Укажи корректный email, login или account id.",
    };
  }

  const normalizedIdentifier = parsed.data;
  const normalizedLower = normalizedIdentifier.toLowerCase();
  let account = null;

  if (normalizedLower.includes("@")) {
    account = await dependencies.getAccountByEmail(normalizedLower);
  } else if (/^[0-9a-f-]{36}$/i.test(normalizedIdentifier)) {
    account = await dependencies.getAccountById(normalizedIdentifier);
  } else {
    account = await dependencies.getAccountByLogin(normalizedLower);
  }

  if (!account) {
    return {
      status: "not-found",
      identifier,
      account: null,
      message:
        "Аккаунт не найден. Поиск выполняется только по email, account login или account id.",
    };
  }

  return {
    status: "found",
    identifier,
    account,
    message: null,
  };
}
