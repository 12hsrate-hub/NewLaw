import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ServerItem = {
  id: string;
  name: string;
};

type CharacterItem = {
  id: string;
  fullName: string;
  passportNumber: string;
};

type ProtectedShellOverviewSectionProps = {
  activeCharacterId: string | null;
  activeCharacterName: string | null;
  activeServerName: string | null;
  characters: CharacterItem[];
  isSuperAdmin?: boolean;
  status?: string;
  servers: ServerItem[];
};

const statusLabels: Record<string, string> = {
  "server-not-found": "Выбранный сервер не найден или больше недоступен.",
  "server-selection-error": "Не удалось сменить активный сервер.",
  "character-selection-error": "Не удалось сменить активного персонажа.",
};

export function ProtectedShellOverviewSection({
  activeCharacterId,
  activeCharacterName,
  activeServerName,
  characters,
  isSuperAdmin = false,
  status,
  servers,
}: ProtectedShellOverviewSectionProps) {
  const hasServers = servers.length > 0;
  const hasCharacters = characters.length > 0;

  return (
    <section className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Transitional Compatibility Route
        </p>
        <h2 className="text-2xl font-semibold">`/app` больше не основной рабочий контур</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Этот маршрут сохранён как безопасная compatibility surface для старых bookmark и
          surrounding protected flows. Основные user сценарии теперь живут в account zone,
          server-scoped routes и internal contour, а `/app` больше не должен восприниматься как
          canonical workspace.
        </p>
        {status && statusLabels[status] ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm text-[var(--foreground)]">
            {statusLabels[status]}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Куда идти дальше</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Основные точки входа уже вынесены из `/app`. Ниже собраны безопасные primary links без
            hard redirect и без скрытого изменения твоего текущего server state.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link
            className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 transition hover:bg-white"
            href="/account"
          >
            <p className="text-sm font-medium text-[var(--foreground)]">/account</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Self-service zone для overview и настроек аккаунта.
            </p>
          </Link>
          <Link
            className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 transition hover:bg-white"
            href="/account/characters"
          >
            <p className="text-sm font-medium text-[var(--foreground)]">/account/characters</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Управление персонажами и profile-level карточками вне generic `/app`.
            </p>
          </Link>
          <Link
            className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 transition hover:bg-white"
            href="/servers"
          >
            <p className="text-sm font-medium text-[var(--foreground)]">/servers</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Entry point в server-scoped hub и document work area.
            </p>
          </Link>
          {isSuperAdmin ? (
            <Link
              className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 transition hover:bg-white"
              href="/internal"
            >
              <p className="text-sm font-medium text-[var(--foreground)]">/internal</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Internal zone для admin и super_admin сценариев.
              </p>
            </Link>
          ) : null}
        </div>
      </Card>

      {!hasServers ? (
        <Card className="space-y-3">
          <h3 className="text-xl font-semibold">Доступных серверов пока нет</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Transitional `/app` загрузился корректно, но в системе пока нет активных серверов.
            Как только серверы появятся, основной вход останется через `/servers`, а не через `/app`.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <Card className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Серверный контекст</h3>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Сводка ниже остаётся только compatibility-слоем. `UserServerState` и SSR fallback не
                убираются, но сам `/app` больше не считается владельцем основного server workflow.
              </p>
            </div>

            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{server.name}</p>
                    <p className="text-xs text-[var(--muted)]">server id: {server.id}</p>
                  </div>
                  {server.name === activeServerName ? (
                    <Badge className="bg-[#dfead9] text-[#285c2d]">Активный</Badge>
                  ) : (
                    <Badge className="bg-white text-[var(--muted)]">Доступен</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {!hasCharacters ? (
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Персонажей на сервере пока нет</h3>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для текущего сервера{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {activeServerName ?? "без выбранного названия"}
                </span>{" "}
                ещё нет персонажей. Создание и редактирование карточек уже вынесены в
                `/account/characters`, а `/app` больше не выступает character workspace.
              </p>
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/55 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                Для focused character management используй `/account/characters`.
              </div>
            </Card>
          ) : (
            <Card className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Персонажи выбранного сервера</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Ниже остаётся только read-only summary выбранного server context. Полноценное
                  profile-management редактирование теперь должно начинаться из `/account/characters`.
                </p>
              </div>

              <div className="space-y-3">
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className="rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {character.fullName}
                      </p>
                      {character.id === activeCharacterId ? (
                        <Badge className="bg-[#dfead9] text-[#285c2d]">Активный</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Паспорт:{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        {character.passportNumber}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                Текущий активный персонаж:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {activeCharacterName ?? "пока не определён"}
                </span>
                . Переключение и сохранённый state остаются доступными, но `/app` больше не должен
                восприниматься как основной workspace для character или document сценариев.
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
