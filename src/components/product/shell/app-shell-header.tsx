import Link from "next/link";

import { signOutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ServerOption = {
  id: string;
  name: string;
};

type CharacterOption = {
  id: string;
  fullName: string;
  passportNumber: string;
};

type AppShellHeaderProps = {
  accountEmail: string;
  accountLogin: string;
  activeCharacterId: string | null;
  activeCharacterName: string | null;
  activeServerId: string | null;
  activeServerName: string | null;
  characters: CharacterOption[];
  currentPath: string;
  isSuperAdmin?: boolean;
  mustChangePassword: boolean;
  servers: ServerOption[];
};

export function AppShellHeader({
  accountEmail,
  accountLogin,
  activeCharacterName,
  activeServerId,
  activeServerName,
  characters,
  isSuperAdmin = false,
  mustChangePassword,
  servers,
}: AppShellHeaderProps) {
  const hasAvailableServers = servers.length > 0;
  const hasCharactersOnActiveServer = characters.length > 0;

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Внутренний контур</p>
          <h1 className="text-3xl font-semibold">Lawyer5RP MVP</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Аккаунт: <span className="font-medium text-[var(--foreground)]">{accountEmail}</span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Login: <span className="font-medium text-[var(--foreground)]">{accountLogin}</span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Активный сервер:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {activeServerName ?? "Доступный сервер пока не определён"}
            </span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Активный персонаж:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {activeCharacterName ?? "Персонаж ещё не выбран"}
            </span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Серверов в контуре:{" "}
            <span className="font-medium text-[var(--foreground)]">{servers.length}</span>
            . Персонажей на текущем сервере:{" "}
            <span className="font-medium text-[var(--foreground)]">{characters.length}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
            href="/app/security"
          >
            Безопасность
          </Link>
          {isSuperAdmin ? (
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
              href="/app/admin-security"
            >
              Admin Security
            </Link>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              Выйти
            </Button>
          </form>
        </div>
      </div>

      {mustChangePassword ? (
        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Для продолжения работы сначала обнови пароль аккаунта. Пока пароль не изменён, остальные действия внутри защищённой части временно заблокированы.
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
        {!hasAvailableServers ? (
          <p>
            В read-only shell пока нет доступных серверов. Когда серверы появятся в конфигурации
            проекта, этот экран начнёт показывать их автоматически.
          </p>
        ) : !activeServerId ? (
          <p>
            Список серверов загружен, но активный сервер пока не определён. Shell использует
            безопасный SSR fallback и не пишет состояние выбора в БД на шаге `04.1`.
          </p>
        ) : !hasCharactersOnActiveServer ? (
          <p>
            Для сервера <span className="font-medium text-[var(--foreground)]">{activeServerName}</span>{" "}
            персонажи пока не найдены. На следующем подшаге здесь появятся выбор и создание
            персонажей.
          </p>
        ) : (
          <p>
            Сейчас shell работает только в режиме чтения: показывает активный сервер{" "}
            <span className="font-medium text-[var(--foreground)]">{activeServerName}</span> и
            персонажа{" "}
            <span className="font-medium text-[var(--foreground)]">
              {activeCharacterName ?? "без выбранного профиля"}
            </span>
            . Мутации выбора сервера и персонажа будут добавлены отдельным подшагом.
          </p>
        )}
      </div>
    </Card>
  );
}
