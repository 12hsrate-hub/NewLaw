import Link from "next/link";

import type {
  AccountTrustorsOverviewContext,
  AccountTrustorsServerGroup,
} from "@/server/account-zone/trustors";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function TrustorGroup(props: { group: AccountTrustorsServerGroup }) {
  const { group } = props;

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

        {!group.isFocused ? (
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
              href={group.focusHref}
            >
              Сфокусировать группу
            </Link>
          </div>
        ) : null}
      </div>

      {!group.trustors.length ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-white/50 p-4">
          <h3 className="text-lg font-semibold">Карточек доверителей пока нет</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Registry foundation уже готов, но reusable trustor cards на этом сервере пока не
            сохранены. Existing OGP/claims flows по-прежнему используют inline snapshot внутри
            документа как обязательный fallback.
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
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AccountTrustorsOverview(props: {
  context: AccountTrustorsOverviewContext;
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
