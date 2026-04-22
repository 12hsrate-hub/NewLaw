import Link from "next/link";

import type {
  AccountTrustorsOverviewContext,
  AccountTrustorsServerGroup,
} from "@/server/account-zone/trustors";
import { softDeleteTrustorAction } from "@/server/actions/trustors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrustorFormCard } from "@/components/product/trustors/trustor-form-card";

const statusLabels: Record<string, string> = {
  "trustor-created": "Trustor card сохранена в account zone.",
  "trustor-updated": "Изменения trustor card сохранены.",
  "trustor-deleted": "Trustor card мягко удалена и скрыта из default overview.",
  "trustor-not-found": "Trustor card для редактирования или удаления не найдена.",
  "trustor-create-error": "Не удалось сохранить trustor card. Проверь данные и попробуй ещё раз.",
  "trustor-update-error": "Не удалось сохранить изменения trustor card. Попробуй ещё раз.",
  "trustor-delete-error": "Не удалось мягко удалить trustor card. Попробуй ещё раз.",
};

function TrustorGroup(props: { group: AccountTrustorsServerGroup }) {
  const { group } = props;
  const createDetailsId = `create-trustor-${group.server.code}`;
  const accountRedirectTo = group.focusHref;

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
            Карточек доверителей на сервере:{" "}
            <span className="font-medium text-[var(--foreground)]">{group.trustorCount}</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {!group.isFocused ? (
            <Link
              className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
              href={group.focusHref}
            >
              Сфокусировать группу
            </Link>
          ) : null}
          <Link
            className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
            href={group.createBridgeHref}
          >
            Создать trustor card
          </Link>
        </div>
      </div>

      <details
        className="rounded-2xl border border-[var(--border)] bg-white/40 p-4"
        id={createDetailsId}
        open={group.isFocused}
      >
        <summary className="cursor-pointer text-sm font-medium">
          Создать trustor card на этом сервере
        </summary>
        <div className="mt-4">
          <TrustorFormCard
            mode="create"
            redirectTo={accountRedirectTo}
            serverId={group.server.id}
          />
        </div>
      </details>

      {!group.trustors.length ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-white/50 p-4">
          <h3 className="text-lg font-semibold">Карточек доверителей пока нет</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Registry route уже готов. Здесь можно создавать reusable trustor cards по серверу, но
            эта account-zone страница не становится document workflow hub и не трогает existing
            snapshots в уже созданных документах.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {group.trustors.map((trustor) => (
            <Card key={trustor.id} className="space-y-3 border border-[var(--border)] bg-white/60">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{trustor.fullName.trim().length > 0 ? trustor.fullName : "Без имени"}</Badge>
                <Badge className="bg-white/70 text-[var(--foreground)]">
                  {trustor.isRepresentativeReady
                    ? "Готов для representative flow"
                    : "Нужны обязательные поля"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <p>
                  Паспорт:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {trustor.passportNumber.trim().length > 0
                      ? trustor.passportNumber
                      : "не заполнен"}
                  </span>
                </p>
                {trustor.phone ? (
                  <p>
                    Телефон:{" "}
                    <span className="font-medium text-[var(--foreground)]">{trustor.phone}</span>
                  </p>
                ) : null}
                {trustor.note ? (
                  <p>
                    Примечание:{" "}
                    <span className="font-medium text-[var(--foreground)]">{trustor.note}</span>
                  </p>
                ) : null}
              </div>

              <details className="rounded-2xl border border-[var(--border)] bg-white/50 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Редактировать trustor card
                </summary>
                <div className="mt-4 space-y-4">
                  <TrustorFormCard
                    defaultValues={{
                      trustorId: trustor.id,
                      fullName: trustor.fullName,
                      passportNumber: trustor.passportNumber,
                      phone: trustor.phone,
                      note: trustor.note,
                    }}
                    mode="edit"
                    redirectTo={accountRedirectTo}
                    serverId={group.server.id}
                  />

                  <form action={softDeleteTrustorAction}>
                    <input name="redirectTo" type="hidden" value={accountRedirectTo} />
                    <input name="trustorId" type="hidden" value={trustor.id} />
                    <Button type="submit" variant="secondary">
                      Мягко удалить trustor card
                    </Button>
                  </form>
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AccountTrustorsOverview(props: {
  context: AccountTrustorsOverviewContext;
  status?: string | null;
}) {
  return (
    <section className="space-y-6">
      <Card className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Account Trustors
          </p>
          <h1 className="text-3xl font-semibold">Доверители аккаунта</h1>
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Это account-wide reusable registry внутри account zone. Он помогает держать owner-owned
            trustor cards по серверам, но не заменяет document snapshots и не превращает страницу в
            server workflow hub.
          </p>
        </div>

        {props.context.focusedServerCode ? (
          <p className="rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
            Route focus применён для сервера:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {props.context.focusedServerCode}
            </span>
            . Это только account-zone focus pattern для grouped overview.
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
            Account route уже готов, но активные серверы для reusable trustor registry пока не
            найдены.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {props.context.serverGroups.map((group) => (
            <TrustorGroup group={group} key={group.server.id} />
          ))}
        </div>
      )}
    </section>
  );
}
