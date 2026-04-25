import type { ReactNode } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DocumentAreaServerSummary } from "@/server/document-area/context";
import { cn } from "@/utils/cn";

function FoundationLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white",
        className,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export function AccountZoneFoundationIntro(props: {
  isSuperAdmin?: boolean;
}) {
  return (
    <Card className="space-y-3">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Личный кабинет</p>
      <h1 className="text-3xl font-semibold">Личный кабинет</h1>
      <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Здесь можно перейти к документам, персонажам, доверителям и настройкам аккаунта.
        Документы по конкретному серверу открываются из раздела серверов.
      </p>
      <div className="flex flex-wrap gap-3">
        <FoundationLink href="/account/documents">Открыть обзор документов</FoundationLink>
        <FoundationLink className="text-[var(--muted)]" href="/assistant">
          Открыть юридического помощника
        </FoundationLink>
        {props.isSuperAdmin ? (
          <FoundationLink className="text-[var(--muted)]" href="/internal/access-requests">
            Открыть access requests
          </FoundationLink>
        ) : null}
      </div>
    </Card>
  );
}

export function AccountDocumentsOverview(props: {
  servers: DocumentAreaServerSummary[];
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Документы
        </p>
        <h1 className="text-3xl font-semibold">Мои документы</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь собраны ваши документы по всем серверам. Создание и редактирование открываются
          из раздела конкретного сервера, чтобы не смешивать разные рабочие контексты.
        </p>
      </Card>

      {props.servers.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Серверы пока не найдены</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Пока у аккаунта нет доступных серверов, список документов будет пустым.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {props.servers.map((server) => (
            <Card className="space-y-4" key={server.id}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{server.name}</Badge>
                  <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {server.code}
                  </span>
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Персонажей на сервере: {server.characterCount}. Выбранный персонаж:{" "}
                  {server.selectedCharacterName ?? "пока не выбран"}.
                </p>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Жалобы в ОГП уже доступны для работы. Раздел исков отображается отдельно.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <FoundationLink href={`/servers/${server.code}/documents`}>
                  Открыть документы сервера
                </FoundationLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentServerNotFoundState(props: {
  requestedServerSlug: string;
  servers: DocumentAreaServerSummary[];
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Документы</p>
        <h1 className="text-3xl font-semibold">Сервер не найден</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Сервер с кодом {props.requestedServerSlug} сейчас недоступен для вашего аккаунта.
        </p>
        <div className="flex flex-wrap gap-3">
          <FoundationLink href="/account/documents">Вернуться к обзору документов</FoundationLink>
        </div>
      </Card>

      {props.servers.length > 0 ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Доступные серверы</h2>
          <div className="flex flex-wrap gap-3">
            {props.servers.map((server) => (
              <FoundationLink href={`/servers/${server.code}/documents`} key={server.id}>
                {server.name}
              </FoundationLink>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function DocumentNoCharactersState(props: {
  server: {
    code: string;
    name: string;
  };
  bridgeHref: string;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Документы</p>
        <h1 className="text-3xl font-semibold">{props.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          На этом сервере пока нет персонажей, поэтому документы для него создать нельзя.
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Сначала добавьте персонажа в личном кабинете. Ссылка ниже сразу откроет нужный сервер.
        </p>
        <div className="flex flex-wrap gap-3">
          <FoundationLink href={props.bridgeHref}>Создать персонажа на этом сервере</FoundationLink>
          <FoundationLink href="/account/documents">Вернуться к обзору документов</FoundationLink>
        </div>
      </Card>
    </div>
  );
}

export function ServerDocumentsHub(props: {
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: {
    id: string;
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  };
  ogpComplaintDocumentCount?: number;
  attorneyRequestDocumentCount?: number;
  legalServicesAgreementDocumentCount?: number;
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Документы сервера
        </p>
        <h1 className="text-3xl font-semibold">{props.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Здесь собраны документы и действия для выбранного сервера.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            Выбор: {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"}
          </span>
          {typeof props.ogpComplaintDocumentCount === "number" ? (
            <span>Жалоб в ОГП: {props.ogpComplaintDocumentCount}</span>
          ) : null}
          {typeof props.attorneyRequestDocumentCount === "number" ? (
            <span>Адвокатских запросов: {props.attorneyRequestDocumentCount}</span>
          ) : null}
          {typeof props.legalServicesAgreementDocumentCount === "number" ? (
            <span>Договоров: {props.legalServicesAgreementDocumentCount}</span>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Раздел документов
            </p>
            <h2 className="text-2xl font-semibold">Жалобы в ОГП</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Создавайте и редактируйте жалобы в ОГП, генерируйте BBCode и готовьте публикацию
              на форуме.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
              Открыть жалобы в ОГП
            </FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Раздел документов
            </p>
            <h2 className="text-2xl font-semibold">Договоры на оказание юридических услуг</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Тестовое rigid-template family для server-specific договоров. Static template
              берётся из reference PDF, а спорные поля остаются provisional внутри spike.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink
              href={`/servers/${props.server.code}/documents/legal-services-agreements`}
            >
              Открыть договоры
            </FoundationLink>
            <FoundationLink
              href={`/servers/${props.server.code}/documents/legal-services-agreements/new`}
            >
              Создать договор
            </FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Раздел документов
            </p>
            <h2 className="text-2xl font-semibold">Адвокатские запросы</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Создавайте запросы от имени адвоката, фиксируя персонажа и доверителя в сохранённом
              документе.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/attorney-requests`}>
              Открыть адвокатские запросы
            </FoundationLink>
            <FoundationLink href={`/servers/${props.server.code}/documents/attorney-requests/new`}>
              Создать запрос
            </FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Раздел документов
            </p>
            <h2 className="text-2xl font-semibold">Иски</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Отдельный раздел для исковых документов. Он не смешивается с жалобами в ОГП.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/claims`}>
              Открыть иски
            </FoundationLink>
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new`}>
              Выбрать тип иска
            </FoundationLink>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function OgpComplaintFoundation(props: {
  mode: "index" | "new" | "editor";
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: {
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  };
  documentId?: string;
}) {
  const title =
    props.mode === "index"
      ? "Жалобы в ОГП"
      : props.mode === "new"
        ? "Новая жалоба в ОГП"
        : "Редактор жалобы в ОГП";

  const description =
    props.mode === "index"
      ? "Здесь будут отображаться жалобы в ОГП по выбранному серверу."
      : props.mode === "new"
        ? "Создайте черновик жалобы. До первого сохранения можно сменить выбранного персонажа."
        : "Откройте сохранённую жалобу и продолжите редактирование.";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Жалоба в ОГП
          </p>
          {props.mode === "editor" ? <Badge>только для владельца</Badge> : null}
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Код сервера: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>Паспорт: {props.selectedCharacter.passportNumber}</span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Что доступно сейчас</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Черновик можно создать и затем открыть в редакторе жалобы.</li>
          <li>После сохранения данные персонажа фиксируются в документе.</li>
          <li>Генерация BBCode доступна в сохранённом редакторе жалобы.</li>
          <li>
            Выбранный персонаж показан явно и может быть изменён до первого сохранения.
          </li>
          {props.mode === "editor" ? (
            <li>ID документа: {props.documentId}.</li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-3">
          {props.mode !== "index" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
              Вернуться к жалобам в ОГП
            </FoundationLink>
          ) : null}
          {props.mode !== "new" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints/new`}>
              Создать новую жалобу
            </FoundationLink>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function formatClaimSubtypeLabel(subtype: "rehabilitation" | "lawsuit") {
  return subtype === "rehabilitation" ? "Rehabilitation" : "Lawsuit";
}

export function ClaimsFamilyFoundation(props: {
  mode: "index" | "new" | "editor";
  server: {
    code: string;
    name: string;
  };
  selectedCharacter: {
    fullName: string;
    passportNumber: string;
    source: "last_used" | "first_available";
  } | null;
  selectedSubtype?: "rehabilitation" | "lawsuit" | null;
  documentId?: string;
}) {
  const title =
    props.mode === "index"
      ? "Claims"
      : props.mode === "new"
        ? "Новый claim"
        : "Future claims editor route";

  const description =
    props.mode === "index"
      ? "Это отдельная family внутри server-scoped document area. Здесь позже будут жить persisted claims типов `rehabilitation` и `lawsuit`."
      : props.mode === "new"
        ? "Это entry route family `Claims`. Сначала пользователь обязан выбрать subtype, а persisted create/edit flow начнётся только в следующем claims-шаге."
        : "Это future owner-account route для claims. Здесь пока нет fake loading, fake persistence и нет подмены работы через `/account` или `/app`.";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Claims Family</p>
          {props.mode === "editor" ? <Badge>owner-account route foundation</Badge> : null}
          {props.selectedSubtype ? <Badge>Subtype: {formatClaimSubtypeLabel(props.selectedSubtype)}</Badge> : null}
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
              <span>Паспорт: {props.selectedCharacter.passportNumber}</span>
              <span>
                UX-default:{" "}
                {props.selectedCharacter.source === "last_used" ? "last-used" : "first available"}
              </span>
            </>
          ) : (
            <Badge>Персонаж пока не выбран</Badge>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Что входит в family `Claims`</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Subtype `rehabilitation`.</li>
          <li>Subtype `lawsuit`.</li>
          <li>Отдельный route/editor contract, не подмешанный в `OGP complaints`.</li>
          <li>Никакого `BBCode`, `publication_url` или forum automation на этом шаге.</li>
          {props.mode === "editor" ? (
            <li>Subtype будущего persisted документа будет определяться по `document_type`, а не по URL.</li>
          ) : null}
          {props.mode === "editor" && props.documentId ? (
            <li>Текущий route contract использует documentId из URL: {props.documentId}.</li>
          ) : null}
        </ul>
      </Card>

      {props.mode === "new" ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Выбор subtype</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Subtype choice обязателен. Сейчас это честный foundation-level entry без draft creation:
            route только фиксирует будущий контракт editor flow.
          </p>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new?subtype=rehabilitation`}>
              Выбрать Rehabilitation
            </FoundationLink>
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new?subtype=lawsuit`}>
              Выбрать Lawsuit
            </FoundationLink>
          </div>
          {props.selectedSubtype ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Сейчас выбран subtype `{props.selectedSubtype}`. Persisted claims create flow и
              claims editor payload появятся отдельным следующим блоком.
            </p>
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Пока subtype не выбран. Без явного выбора route не должен создавать впечатление, что
              claims draft уже создаётся автоматически.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {props.mode !== "index" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/claims`}>
              Вернуться к Claims family
            </FoundationLink>
          ) : null}
          {props.mode !== "new" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new`}>
              Открыть subtype choice
            </FoundationLink>
          ) : null}
          <FoundationLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к hub сервера
          </FoundationLink>
        </div>
      </Card>
    </div>
  );
}
