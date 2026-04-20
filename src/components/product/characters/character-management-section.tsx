import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CharacterFormCard } from "@/components/product/characters/character-form-card";

type CharacterItem = {
  id: string;
  fullName: string;
  nickname: string;
  passportNumber: string;
  roles: Array<{
    roleKey: string;
  }>;
  accessFlags: Array<{
    flagKey: string;
  }>;
};

type CharacterManagementSectionProps = {
  activeCharacterId: string | null;
  activeServerId: string | null;
  activeServerName: string | null;
  characters: CharacterItem[];
  status: string | undefined;
};

const roleLabels: Record<string, string> = {
  citizen: "Гражданин",
  lawyer: "Адвокат",
};

const accessFlagLabels: Record<string, string> = {
  advocate: "Адвокатский доступ",
  server_editor: "Редактор сервера",
  server_admin: "Администратор сервера",
  tester: "Тестовый доступ",
};

const statusLabels: Record<string, string> = {
  "character-created": "Персонаж создан и выбран активным.",
  "character-updated": "Изменения персонажа сохранены.",
  "character-limit": "На одном сервере нельзя иметь больше трёх персонажей.",
  "passport-conflict": "Паспорт уже используется в рамках этого аккаунта и сервера.",
  "character-create-error": "Не удалось создать персонажа. Проверь данные и попробуй ещё раз.",
  "character-not-found": "Персонаж для редактирования не найден.",
  "character-selection-error": "Не удалось выбрать активного персонажа.",
  "server-not-found": "Выбранный сервер не найден.",
  "server-selection-error": "Не удалось выбрать сервер.",
};

export function CharacterManagementSection({
  activeCharacterId,
  activeServerId,
  activeServerName,
  characters,
  status,
}: CharacterManagementSectionProps) {
  return (
    <section className="space-y-6">
      <Card className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Персонажи</p>
          <h2 className="text-2xl font-semibold">Управление персонажами</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Текущий сервер:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {activeServerName ?? "сервер не выбран"}
            </span>
            . Персонажи создаются вручную, email остаётся на уровне аккаунта.
          </p>
        </div>
        {status && statusLabels[status] ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm">
            {statusLabels[status]}
          </p>
        ) : null}
      </Card>

      {!activeServerId ? (
        <Card className="space-y-3">
          <h3 className="text-xl font-semibold">Сначала выбери сервер</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            После выбора сервера появятся список персонажей, создание и редактирование карточек.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div id="create-character">
            <CharacterFormCard mode="create" serverId={activeServerId} />
          </div>

          <div className="space-y-4">
            {!characters.length ? (
              <Card className="space-y-3">
                <h3 className="text-xl font-semibold">Персонажей пока нет</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  На этом сервере ещё нет ни одного персонажа. Создай первую карточку вручную через форму слева.
                </p>
                <a
                  className="inline-flex rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white"
                  href="#create-character"
                >
                  Создать персонажа
                </a>
              </Card>
            ) : (
              characters.map((character) => (
                <Card key={character.id} className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge>{character.fullName}</Badge>
                        {character.id === activeCharacterId ? <Badge className="bg-[#dfead9] text-[#285c2d]">Активный</Badge> : null}
                      </div>
                      <p className="text-sm leading-6 text-[var(--muted)]">
                        Паспорт:{" "}
                        <span className="font-medium text-[var(--foreground)]">
                          {character.passportNumber}
                        </span>
                      </p>
                      <p className="text-sm leading-6 text-[var(--muted)]">
                        Ник:{" "}
                        <span className="font-medium text-[var(--foreground)]">{character.nickname}</span>
                      </p>
                    </div>
                    <div className="text-sm leading-6 text-[var(--muted)]">
                      <p>
                        Роли:{" "}
                        {character.roles.map((role) => roleLabels[role.roleKey] ?? role.roleKey).join(", ") ||
                          "не заданы"}
                      </p>
                      <p>
                        Access flags:{" "}
                        {character.accessFlags
                          .map((flag) => accessFlagLabels[flag.flagKey] ?? flag.flagKey)
                          .join(", ") || "не заданы"}
                      </p>
                    </div>
                  </div>

                  <details className="rounded-2xl border border-[var(--border)] bg-white/50 p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Редактировать персонажа
                    </summary>
                    <div className="mt-4">
                      <CharacterFormCard
                        defaultValues={{
                          characterId: character.id,
                          fullName: character.fullName,
                          passportNumber: character.passportNumber,
                          roleKeys: character.roles.map((role) => role.roleKey),
                          accessFlags: character.accessFlags.map((flag) => flag.flagKey),
                        }}
                        mode="edit"
                        serverId={activeServerId}
                      />
                    </div>
                  </details>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
