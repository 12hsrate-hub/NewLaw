import { createCharacterAction, updateCharacterAction } from "@/server/actions/characters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CharacterFormValues = {
  characterId?: string;
  fullName: string;
  passportNumber: string;
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
      ? "Персонаж создаётся вручную. Минимально обязательны ФИО и паспорт."
      : "Обновление карточки персонажа в текущем серверном контексте.";

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

        <Button type="submit">{submitLabel}</Button>
      </form>
    </Card>
  );
}
