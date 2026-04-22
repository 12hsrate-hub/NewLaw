import Link from "next/link";

import type {
  AccountCharactersOverviewContext,
  AccountCharactersServerGroup,
} from "@/server/account-zone/characters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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

function formatLabels(values: string[], labels: Record<string, string>) {
  return values.length ? values.map((value) => labels[value] ?? value).join(", ") : "не заданы";
}

function CharacterGroup(props: { group: AccountCharactersServerGroup }) {
  const { group } = props;

  return (
    <Card className={`space-y-4 ${group.isFocused ? "border-[var(--accent)]" : ""}`}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{group.server.name}</Badge>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            {group.server.code}
          </span>
          {group.isFocused ? <Badge className="bg-[#e9efe0] text-[#35501c]">Фокус route</Badge> : null}
        </div>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Персонажей на сервере: <span className="font-medium text-[var(--foreground)]">{group.characterCount}</span>.
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Default character для server-scoped модулей:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {group.defaultCharacterLabel ?? "пока не выбран"}
          </span>
        </p>
      </div>

      {!group.characters.length ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-white/50 p-4">
          <h3 className="text-lg font-semibold">Персонажей пока нет</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Эта server group уже видима внутри account zone, но создавать и редактировать персонажей
            здесь полностью мы начнём позже. Пока CTA ведёт во временный transitional flow.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
              href={group.createBridgeHref}
            >
              Временно открыть characters flow
            </Link>
          </div>
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AccountCharactersOverview(props: {
  context: AccountCharactersOverviewContext;
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
