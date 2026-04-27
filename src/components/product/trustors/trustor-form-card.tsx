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
  icEmail?: string | null;
  passportImageUrl?: string | null;
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
  const submitLabel = mode === "create" ? "Сохранить доверителя" : "Сохранить изменения";
  const title = mode === "create" ? "Новый доверитель" : "Редактирование доверителя";
  const description =
    mode === "create"
      ? "Заполните основные данные доверителя. Можно сохранить неполную карточку, но хотя бы одно поле должно быть заполнено."
      : "Изменения применятся только к этой карточке. Уже созданные документы не изменятся автоматически.";

  return (
    <Card className="space-y-5">
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
          <label className="text-sm font-medium" htmlFor={`${mode}-trustor-ic-email`}>
            Игровая почта
          </label>
          <Input
            defaultValue={defaultValues?.icEmail ?? ""}
            id={`${mode}-trustor-ic-email`}
            name="icEmail"
            placeholder="name@sa.com"
            type="email"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-trustor-passport-image-url`}>
            Ссылка на скрин паспорта
          </label>
          <Input
            defaultValue={defaultValues?.passportImageUrl ?? ""}
            id={`${mode}-trustor-passport-image-url`}
            name="passportImageUrl"
            placeholder="https://..."
            type="url"
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
            placeholder="Короткая пометка, если она нужна."
            rows={3}
          />
        </div>

        <Button type="submit">{submitLabel}</Button>
      </form>
    </Card>
  );
}
