import { createCharacterAction, updateCharacterAction } from "@/server/actions/characters";
import {
  characterAccessFlagKeys,
  characterRoleKeys,
} from "@/schemas/character";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const roleLabels: Record<(typeof characterRoleKeys)[number], string> = {
  citizen: "Гражданин",
  lawyer: "Адвокат",
};

const accessFlagLabels: Record<(typeof characterAccessFlagKeys)[number], string> = {
  advocate: "Адвокатский доступ",
  server_editor: "Редактор сервера",
  server_admin: "Администратор сервера",
  tester: "Тестовый доступ",
};

type CharacterFormValues = {
  accessFlags?: string[];
  characterId?: string;
  fullName: string;
  nickname?: string;
  position?: string | null;
  address?: string | null;
  phone?: string | null;
  icEmail?: string | null;
  passportImageUrl?: string | null;
  profileNote?: string | null;
  profileSignature?: string | null;
  isProfileComplete?: boolean;
  passportNumber: string;
  roleKeys?: string[];
};

type CharacterFormCardProps = {
  defaultValues?: CharacterFormValues;
  mode: "create" | "edit";
  redirectTo?: string;
  selectionBehavior?: "app_shell" | "account_zone";
  serverId: string;
  surface?: "app_shell" | "account_zone";
};

export function CharacterFormCard({
  defaultValues,
  mode,
  redirectTo = "/app",
  selectionBehavior = "app_shell",
  serverId,
  surface = "app_shell",
}: CharacterFormCardProps) {
  const action = mode === "create" ? createCharacterAction : updateCharacterAction;
  const submitLabel = mode === "create" ? "Создать персонажа" : "Сохранить изменения";
  const title = mode === "create" ? "Новый персонаж" : "Редактирование персонажа";
  const appShellDescription =
    mode === "create"
      ? "Заполните ФИО и паспорт. Роли и дополнительные доступы можно указать позже."
      : "Обновите данные персонажа для текущего сервера.";
  const accountZoneDescription =
    mode === "create"
      ? "Создайте карточку персонажа для выбранного сервера."
      : "Изменения сохраняются только в этой карточке персонажа.";
  const description = surface === "account_zone" ? accountZoneDescription : appShellDescription;
  const selectedRoleKeys = new Set(defaultValues?.roleKeys ?? []);
  const selectedAccessFlags = new Set(defaultValues?.accessFlags ?? []);

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>

      <form action={action} className="space-y-4">
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <input name="selectionBehavior" type="hidden" value={selectionBehavior} />
        <input name="serverId" type="hidden" value={serverId} />
        {mode === "edit" ? (
          <input name="characterId" type="hidden" value={defaultValues?.characterId ?? ""} />
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-fullName`}>
            ФИО
          </label>
          <Input
            defaultValue={defaultValues?.fullName ?? ""}
            id={`${mode}-fullName`}
            name="fullName"
            placeholder="Иван Иванов"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-passportNumber`}>
            Паспорт
          </label>
          <Input
            defaultValue={defaultValues?.passportNumber ?? ""}
            id={`${mode}-passportNumber`}
            name="passportNumber"
            placeholder="PASS-001"
            required
          />
        </div>

        {surface === "account_zone" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${mode}-nickname`}>
              Ник
            </label>
            <Input
              defaultValue={defaultValues?.nickname ?? ""}
              id={`${mode}-nickname`}
              name="nickname"
              placeholder="Например: Игорь Юристов"
            />
          </div>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Роли персонажа</legend>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Это роли только текущего персонажа. Они не дают права администратора аккаунта.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {characterRoleKeys.map((roleKey) => (
              <label
                key={roleKey}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm"
              >
                <input
                  defaultChecked={selectedRoleKeys.has(roleKey)}
                  name="roleKeys"
                  type="checkbox"
                  value={roleKey}
                />
                <span>{roleLabels[roleKey]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Доступы персонажа</legend>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Эти доступы относятся только к выбранному персонажу.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {characterAccessFlagKeys.map((flagKey) => (
              <label
                key={flagKey}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm"
              >
                <input
                  defaultChecked={selectedAccessFlags.has(flagKey)}
                  name="accessFlags"
                  type="checkbox"
                  value={flagKey}
                />
                <span>
                  {accessFlagLabels[flagKey]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/40 p-4">
          <legend className="px-1 text-sm font-medium">Компактный профиль персонажа</legend>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Эти поля нужны для жалоб в ОГП и других документов.
          </p>

          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Система сама проверит, хватает ли данных для генерации жалобы в ОГП.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${mode}-position`}>
              Должность
            </label>
            <Input
              defaultValue={defaultValues?.position ?? ""}
              id={`${mode}-position`}
              name="position"
              placeholder="Например: Адвокат"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${mode}-address`}>
              Адрес
            </label>
            <Input
              defaultValue={defaultValues?.address ?? ""}
              id={`${mode}-address`}
              name="address"
              placeholder="Адрес проживания / регистрации"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`${mode}-phone`}>
                Телефон
              </label>
              <Input
                defaultValue={defaultValues?.phone ?? ""}
                id={`${mode}-phone`}
                name="phone"
                placeholder="123-45-67"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`${mode}-icEmail`}>
                Игровая почта
              </label>
              <Input
                defaultValue={defaultValues?.icEmail ?? ""}
                id={`${mode}-icEmail`}
                name="icEmail"
                placeholder="name@sa.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${mode}-passportImageUrl`}>
              Ссылка на скрин паспорта
            </label>
            <Input
              defaultValue={defaultValues?.passportImageUrl ?? ""}
              id={`${mode}-passportImageUrl`}
              name="passportImageUrl"
              placeholder="https://..."
              type="url"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${mode}-profileSignature`}>
              Подпись персонажа
            </label>
            <Input
              defaultValue={defaultValues?.profileSignature ?? ""}
              id={`${mode}-profileSignature`}
              name="profileSignature"
              placeholder="И. Иванов"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${mode}-profileNote`}>
              Краткая заметка профиля
            </label>
            <Textarea
              defaultValue={defaultValues?.profileNote ?? ""}
              id={`${mode}-profileNote`}
              name="profileNote"
              placeholder="Короткая заметка или уточнение по профилю."
              rows={3}
            />
          </div>
        </fieldset>

        <Button type="submit">{submitLabel}</Button>
      </form>
    </Card>
  );
}
