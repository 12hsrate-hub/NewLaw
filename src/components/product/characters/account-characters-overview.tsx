import Link from "next/link";

import type {
  AccountCharactersOverviewContext,
  AccountCharactersServerGroup,
} from "@/server/account-zone/characters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CharacterFormCard } from "@/components/product/characters/character-form-card";

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
  "character-created": "Карточка персонажа сохранена в account zone.",
  "character-updated": "Изменения персонажа сохранены в account zone.",
  "character-limit": "На одном сервере нельзя иметь больше трёх персонажей.",
  "passport-conflict": "Паспорт уже используется в рамках этого аккаунта и сервера.",
  "character-create-error": "Не удалось создать персонажа. Проверь данные и попробуй ещё раз.",
  "character-update-error": "Не удалось сохранить изменения персонажа. Попробуй ещё раз.",
  "character-not-found": "Персонаж для редактирования не найден.",
};

function formatLabels(values: string[], labels: Record<string, string>) {
  return values.length ? values.map((value) => labels[value] ?? value).join(", ") : "не заданы";
}

function CharacterGroup(props: { group: AccountCharactersServerGroup }) {
  const { group } = props;
  const createDetailsId = `create-character-${group.server.code}`;
  const accountRedirectTo = `${group.focusHref}`;

  return (
    <Card className={`space-y-4 ${group.isFocused ? "border-[var(--accent)]" : ""}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{group.server.name}</Badge>
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {group.server.code}
            </span>
            {group.isFocused ? (
              <Badge className="bg-[#e9efe0] text-[#35501c]">Фокус route</Badge>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Персонажей на сервере:{" "}
            <span className="font-medium text-[var(--foreground)]">{group.characterCount}</span>.
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Default character для server-scoped модулей:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {group.defaultCharacterLabel ?? "пока не выбран"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
            href={group.createBridgeHref}
          >
            Создать персонажа
          </Link>
        </div>
      </div>

      <details
        className="rounded-2xl border border-[var(--border)] bg-white/40 p-4"
        id={createDetailsId}
        open={group.isFocused}
      >
        <summary className="cursor-pointer text-sm font-medium">Создать персонажа на этом сервере</summary>
        <div className="mt-4">
          <CharacterFormCard
            mode="create"
            redirectTo={accountRedirectTo}
            selectionBehavior="account_zone"
            serverId={group.server.id}
            surface="account_zone"
          />
        </div>
      </details>

      {!group.characters.length ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-white/50 p-4">
          <h3 className="text-lg font-semibold">Персонажей пока нет</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Server group уже видима в account zone. Focused bridge и inline form ведут прямо к
            созданию персонажа в нужной server group без возврата в generic `/app`.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {group.characters.map((character) => (
            <Card key={character.id} className="space-y-3 border border-[var(--border)] bg-white/60">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{character.fullName}</Badge>
                {character.isDefaultForServer ? (
                  <Badge className="bg-[#dfead9] text-[#285c2d]">Default for server</Badge>
                ) : null}
                <Badge className="bg-white/70 text-[var(--foreground)]">
                  {character.isProfileComplete ? "Профиль заполнен" : "Профиль не заполнен"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <p>
                  Ник: <span className="font-medium text-[var(--foreground)]">{character.nickname}</span>
                </p>
                <p>
                  Паспорт:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {character.passportNumber}
                  </span>
                </p>
                <p>
                  Роли:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {formatLabels(character.roleKeys, roleLabels)}
                  </span>
                </p>
                <p>
                  Access flags:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {formatLabels(character.accessFlagKeys, accessFlagLabels)}
                  </span>
                </p>
                <p>
                  Доп. профиль:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {character.hasProfileData
                      ? character.compactProfileSummary
                      : "дополнительные данные пока не сохранены"}
                  </span>
                </p>
                {character.profileSignature ? (
                  <p>
                    Подпись:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {character.profileSignature}
                    </span>
                  </p>
                ) : null}
                {character.position ? (
                  <p>
                    Должность:{" "}
                    <span className="font-medium text-[var(--foreground)]">{character.position}</span>
                  </p>
                ) : null}
                {character.phone ? (
                  <p>
                    Телефон:{" "}
                    <span className="font-medium text-[var(--foreground)]">{character.phone}</span>
                  </p>
                ) : null}
                {character.icEmail ? (
                  <p>
                    IC email:{" "}
                    <span className="font-medium text-[var(--foreground)]">{character.icEmail}</span>
                  </p>
                ) : null}
                {character.passportImageUrl ? (
                  <p>
                    Скрин паспорта:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {character.passportImageUrl}
                    </span>
                  </p>
                ) : null}
                {character.profileNote ? (
                  <p>
                    Profile note:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {character.profileNote}
                    </span>
                  </p>
                ) : null}
              </div>

              <details className="rounded-2xl border border-[var(--border)] bg-white/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Редактировать персонажа
                </summary>
                <div className="mt-4">
                  <CharacterFormCard
                    defaultValues={{
                      accessFlags: character.accessFlagKeys,
                      characterId: character.id,
                      fullName: character.fullName,
                      isProfileComplete: character.isProfileComplete,
                      nickname: character.nickname,
                      passportNumber: character.passportNumber,
                      position: character.position,
                      phone: character.phone,
                      icEmail: character.icEmail,
                      passportImageUrl: character.passportImageUrl,
                      profileNote: character.profileNote,
                      profileSignature: character.profileSignature,
                      roleKeys: character.roleKeys,
                    }}
                    mode="edit"
                    redirectTo={accountRedirectTo}
                    selectionBehavior="account_zone"
                    serverId={group.server.id}
                    surface="account_zone"
                  />
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AccountCharactersOverview(props: {
  context: AccountCharactersOverviewContext;
  status?: string | null;
}) {
  return (
    <section className="space-y-6">
      <Card className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Account Characters
          </p>
          <h1 className="text-3xl font-semibold">Персонажи аккаунта</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Это account-wide profile-management overview. Здесь персонажи собраны по серверам, а
            рабочие assistant и documents flows по-прежнему живут в server-scoped маршрутах.
          </p>
        </div>

        {props.context.focusedServerCode ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Route focus применён для сервера:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.context.focusedServerCode}
            </span>
            . Это только UX-подсветка и не меняет source of truth рабочих server-scoped модулей.
          </p>
        ) : null}

        {props.status && statusLabels[props.status] ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
            {statusLabels[props.status]}
          </p>
        ) : null}
      </Card>

      {props.context.serverGroups.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Серверы пока не найдены</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Account route уже готов, но список серверов для profile-management зоны пока пуст.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {props.context.serverGroups.map((group) => (
            <CharacterGroup group={group} key={group.server.id} />
          ))}
        </div>
      )}
    </section>
  );
}
