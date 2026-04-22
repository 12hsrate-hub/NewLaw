import { createTrustorAction, updateTrustorAction } from "@/server/actions/trustors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TrustorFormValues = {
  trustorId?: string;
  fullName?: string;
  passportNumber?: string;
  phone?: string | null;
  note?: string | null;
};

type TrustorFormCardProps = {
  defaultValues?: TrustorFormValues;
  mode: "create" | "edit";
  redirectTo?: string;
  serverId: string;
};

export function TrustorFormCard({
  defaultValues,
  mode,
  redirectTo = "/account/trustors",
  serverId,
}: TrustorFormCardProps) {
  const action = mode === "create" ? createTrustorAction : updateTrustorAction;
  const submitLabel = mode === "create" ? "Сохранить trustor card" : "Сохранить изменения";
  const title = mode === "create" ? "Новая trustor card" : "Редактирование trustor card";
  const description =
    mode === "create"
      ? "Карточка создаётся прямо в account zone и остаётся reusable-data слоем. Неполные поля допустимы, но полностью пустую карточку сохранить нельзя."
      : "Изменения касаются только registry card внутри account zone и не должны ретроактивно менять уже созданные document snapshots.";

  return (
    <Card className="space-y-5 border border-[var(--border)] bg-white/50">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>

      <form action={action} className="space-y-4">
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <input name="serverId" type="hidden" value={serverId} />
        {mode === "edit" ? (
          <input name="trustorId" type="hidden" value={defaultValues?.trustorId ?? ""} />
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-trustor-fullName`}>
            ФИО доверителя
          </label>
          <Input
            defaultValue={defaultValues?.fullName ?? ""}
            id={`${mode}-trustor-fullName`}
            name="fullName"
            placeholder="Иван Доверителев"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-trustor-passport`}>
            Паспорт доверителя
          </label>
          <Input
            defaultValue={defaultValues?.passportNumber ?? ""}
            id={`${mode}-trustor-passport`}
            name="passportNumber"
            placeholder="AA-001"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-trustor-phone`}>
            Телефон
          </label>
          <Input
            defaultValue={defaultValues?.phone ?? ""}
            id={`${mode}-trustor-phone`}
            name="phone"
            placeholder="+7 900 000-00-00"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-trustor-note`}>
            Примечание
          </label>
          <Textarea
            defaultValue={defaultValues?.note ?? ""}
            id={`${mode}-trustor-note`}
            name="note"
            placeholder="Короткая note по trustor card или representative context."
            rows={3}
          />
        </div>

        <Button type="submit">{submitLabel}</Button>
      </form>
    </Card>
  );
}
