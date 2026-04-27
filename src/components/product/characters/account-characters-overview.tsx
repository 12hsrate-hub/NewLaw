import Link from "next/link";

import type {
  AccountCharactersOverviewContext,
  AccountCharactersServerGroup,
} from "@/server/account-zone/characters";
import { createCharacterAccessRequestAction } from "@/server/actions/characters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CharacterFormCard } from "@/components/product/characters/character-form-card";
import { CharacterSignatureCard } from "@/components/product/characters/character-signature-card";

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
  "character-created": "Карточка персонажа сохранена.",
  "character-updated": "Изменения персонажа сохранены.",
  "character-limit": "На одном сервере нельзя иметь больше трёх персонажей.",
  "passport-conflict": "Паспорт уже используется в рамках этого аккаунта и сервера.",
  "character-create-error": "Не удалось создать персонажа. Проверьте ФИО и паспорт, затем повторите попытку.",
  "character-update-error": "Не удалось сохранить изменения персонажа. Проверьте заполненные поля и попробуйте снова.",
  "character-not-found": "Не удалось найти персонажа для редактирования. Обновите страницу и попробуйте снова.",
  "character-signature-uploaded": "Подпись персонажа сохранена и станет использоваться в новых шаблонных документах.",
  "character-signature-uploaded-warning":
    "Подпись персонажа сохранена. Для лучшего отображения в документах рекомендуется использовать PNG с прозрачным фоном.",
  "character-signature-removed":
    "Активная подпись отвязана от персонажа. Уже созданные документы продолжают использовать сохранённый снимок подписи.",
  "character-signature-access-denied":
    "Не удалось изменить подпись персонажа. Проверьте, что редактируете свой профиль, и попробуйте снова.",
  "character-signature-missing-file":
    "Выберите файл подписи и попробуйте снова.",
  "character-signature-invalid-format":
    "Поддерживаются только PNG, JPG/JPEG и WEBP.",
  "character-signature-file-too-large":
    "Файл подписи должен быть не больше 1 МБ.",
  "character-signature-invalid-dimensions":
    "Проверьте размеры подписи: допустимо от 300×100 до 1200×400 px и от 2:1 до 5:1.",
  "character-signature-upload-error":
    "Не удалось сохранить подпись персонажа. Попробуйте снова позже.",
  "character-access-request-created":
    "Заявка на адвокатский доступ отправлена и ожидает рассмотрения администратором.",
  "character-access-request-not-found":
    "Не удалось найти персонажа для заявки на доступ. Обновите страницу и попробуйте снова.",
  "character-access-request-pending-exists":
    "По этому персонажу уже есть заявка на рассмотрении.",
  "character-access-request-already-granted":
    "У этого персонажа уже есть адвокатский доступ. Новая заявка не требуется.",
  "character-access-request-create-error":
    "Не удалось отправить заявку на адвокатский доступ. Попробуйте снова позже.",
};

function formatLabels(values: string[], labels: Record<string, string>) {
  return values.length ? values.map((value) => labels[value] ?? value).join(", ") : "не заданы";
}

function formatAdvocateAccessStatus(input: {
  status: "not_requested" | "pending" | "rejected" | "granted";
}) {
  switch (input.status) {
    case "pending":
      return "Заявка на рассмотрении";
    case "rejected":
      return "Заявка отклонена";
    case "granted":
      return "Адвокатский доступ выдан";
    default:
      return "Доступ не запрошен";
  }
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
            {group.isFocused ? (
              <Badge className="bg-[#e9efe0] text-[#35501c]">Выбранный сервер</Badge>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Персонажей на сервере:{" "}
            <span className="font-medium text-[var(--foreground)]">{group.characterCount}</span>.
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Персонаж по умолчанию для этого сервера:{" "}
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
            Добавьте персонажа прямо в этой группе сервера. После этого он сможет использоваться
            в документах и других серверных разделах.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {group.characters.map((character) => (
            <Card key={character.id} className="space-y-3 border border-[var(--border)] bg-white/60">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{character.fullName}</Badge>
                {character.isDefaultForServer ? (
                  <Badge className="bg-[#dfead9] text-[#285c2d]">По умолчанию для сервера</Badge>
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
                  Доступы:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {formatLabels(character.accessFlagKeys, accessFlagLabels)}
                  </span>
                </p>
                <p>
                  Адвокатский доступ:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {formatAdvocateAccessStatus({
                      status: character.advocateAccessRequest.status,
                    })}
                  </span>
                </p>
                {character.advocateAccessRequest.requestComment ? (
                  <p>
                    Комментарий к заявке:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {character.advocateAccessRequest.requestComment}
                    </span>
                  </p>
                ) : null}
                {character.advocateAccessRequest.reviewComment ? (
                  <p>
                    Комментарий администратора:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {character.advocateAccessRequest.reviewComment}
                    </span>
                  </p>
                ) : null}
                <p>
                  Доп. профиль:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {character.hasProfileData
                      ? character.compactProfileSummary
                      : "дополнительные данные пока не сохранены"}
                  </span>
                </p>
                <p>
                  Подпись для документов:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {character.activeSignature ? "загружена" : "не загружена"}
                  </span>
                </p>
                {character.position ? (
                  <p>
                    Должность:{" "}
                    <span className="font-medium text-[var(--foreground)]">{character.position}</span>
                  </p>
                ) : null}
                {character.address ? (
                  <p>
                    Адрес:{" "}
                    <span className="font-medium text-[var(--foreground)]">{character.address}</span>
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
                    Игровая почта:{" "}
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
                    Заметка профиля:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {character.profileNote}
                    </span>
                  </p>
                ) : null}
              </div>

              {character.advocateAccessRequest.canSubmit ? (
                <form
                  action={createCharacterAccessRequestAction}
                  className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/50 p-4"
                >
                  <input name="redirectTo" type="hidden" value={accountRedirectTo} />
                  <input name="characterId" type="hidden" value={character.id} />
                  <input name="requestType" type="hidden" value="advocate_access" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Запросить адвокатский доступ</h3>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      Доступ выдаётся только после рассмотрения заявки администратором.
                    </p>
                  </div>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium text-[var(--foreground)]">
                      Комментарий или основание
                    </span>
                    <textarea
                      className="min-h-24 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                      name="requestComment"
                      placeholder="Кратко опиши, зачем этому персонажу нужен адвокатский доступ."
                    />
                  </label>
                  <button
                    className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white"
                    type="submit"
                  >
                    Отправить заявку
                  </button>
                </form>
              ) : null}

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
                      address: character.address,
                      phone: character.phone,
                      icEmail: character.icEmail,
                      passportImageUrl: character.passportImageUrl,
                      profileNote: character.profileNote,
                      roleKeys: character.roleKeys,
                    }}
                    mode="edit"
                    redirectTo={accountRedirectTo}
                    selectionBehavior="account_zone"
                    serverId={group.server.id}
                    surface="account_zone"
                  />
                  <CharacterSignatureCard
                    activeSignature={character.activeSignature}
                    characterId={character.id}
                    redirectTo={accountRedirectTo}
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
            Персонажи
          </p>
          <h1 className="text-3xl font-semibold">Мои персонажи</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Здесь персонажи собраны по серверам. Документы и юридический помощник открываются
            из раздела конкретного сервера.
          </p>
        </div>

        {props.context.focusedServerCode ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Показана группа выбранного сервера. Данные персонажей не меняются.
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
            Пока у аккаунта нет доступных серверов, список персонажей будет пустым.
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
