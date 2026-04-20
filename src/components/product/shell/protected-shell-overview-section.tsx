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
  status,
  servers,
}: ProtectedShellOverviewSectionProps) {
  const hasServers = servers.length > 0;
  const hasCharacters = characters.length > 0;

  return (
    <section className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Protected Shell Foundation
        </p>
        <h2 className="text-2xl font-semibold">Read-only контур `/app`</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Overview-экран остаётся read-only, но в header уже доступны выбор активного сервера и
          выбор активного персонажа. Ниже в этом же shell теперь доступно базовое ручное создание,
          редактирование карточек и минимальный слой ролей и access flags.
        </p>
        {status && statusLabels[status] ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm text-[var(--foreground)]">
            {statusLabels[status]}
          </p>
        ) : null}
      </Card>

      {!hasServers ? (
        <Card className="space-y-3">
          <h3 className="text-xl font-semibold">Доступных серверов пока нет</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Защищённый shell загрузился корректно, но в системе пока нет активных серверов.
            Следующий доменный поток начнётся сразу после появления серверов в конфигурации.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <Card className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Серверный контекст</h3>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Shell использует SSR context и безопасный fallback, если в `UserServerState` ещё нет
                сохранённого выбора.
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
                ещё нет персонажей. Выбор активного сервера уже работает, а форма создания доступна
                ниже в блоке управления персонажами.
              </p>
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/55 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                Следующий шаг после этого блока: роли и access flags
              </div>
            </Card>
          ) : (
            <Card className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Персонажи выбранного сервера</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Ниже показан read-only список персонажей активного сервера. Пока без форм, ролей и
                  access flags.
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
                . Переключение уже доступно в header, а базовое редактирование карточек вынесено в
                отдельный блок ниже.
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
