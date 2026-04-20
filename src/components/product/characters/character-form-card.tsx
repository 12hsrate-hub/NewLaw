import { createCharacterAction, updateCharacterAction } from "@/server/actions/characters";
import {
  characterAccessFlagKeys,
  characterRoleKeys,
} from "@/schemas/character";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  passportNumber: string;
  roleKeys?: string[];
};

type CharacterFormCardProps = {
  defaultValues?: CharacterFormValues;
  mode: "create" | "edit";
  serverId: string;
};

export function CharacterFormCard({
  defaultValues,
  mode,
  serverId,
}: CharacterFormCardProps) {
  const action = mode === "create" ? createCharacterAction : updateCharacterAction;
  const submitLabel = mode === "create" ? "Создать персонажа" : "Сохранить изменения";
  const title = mode === "create" ? "Новый персонаж" : "Редактирование персонажа";
  const description =
    mode === "create"
      ? "Персонаж создаётся вручную. Минимально обязательны ФИО и паспорт, а роли и access flags можно оставить пустыми."
      : "Обновление карточки персонажа в текущем серверном контексте без выхода в отдельный permission-центр.";
  const selectedRoleKeys = new Set(defaultValues?.roleKeys ?? []);
  const selectedAccessFlags = new Set(defaultValues?.accessFlags ?? []);

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>

      <form action={action} className="space-y-4">
        <input name="redirectTo" type="hidden" value="/app" />
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

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Роли персонажа</legend>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Это только роли текущего персонажа. Они не связаны с `super_admin` и платформенными
            правами аккаунта.
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
          <legend className="text-sm font-medium">Access flags</legend>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Флаги тоже живут на уровне `character_id` и сохраняются только для этой карточки.
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
                  {accessFlagLabels[flagKey]} <span className="text-[var(--muted)]">({flagKey})</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit">{submitLabel}</Button>
      </form>
    </Card>
  );
}
