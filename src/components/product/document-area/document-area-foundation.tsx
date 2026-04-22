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

export function AccountZoneFoundationIntro() {
  return (
    <Card className="space-y-3">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Account Zone</p>
      <h1 className="text-3xl font-semibold">Личный кабинет</h1>
      <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Это отдельная account zone. Рабочие document-модули живут не здесь, а в server-scoped
        маршрутах. `/account/documents` остаётся обзором документов по всем серверам и типам.
      </p>
      <div className="flex flex-wrap gap-3">
        <FoundationLink href="/account/documents">Открыть обзор документов</FoundationLink>
        <FoundationLink className="text-[var(--muted)]" href="/assistant">
          Вернуться к assistant
        </FoundationLink>
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
          Account Documents
        </p>
        <h1 className="text-3xl font-semibold">Мои документы</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это cross-server overview route. Здесь показывается общий обзор документов пользователя,
          а основной create/edit flow живёт в server-scoped document area, а не внутри account
          zone. Persisted `OGP complaints` уже отображаются здесь как реальные документы, а family
          `Claims` подготовлена так, чтобы позже появиться рядом с ними без смены account route
          contract.
        </p>
      </Card>

      {props.servers.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Серверы пока не найдены</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Foundation route уже существует, но без активных серверов обзор документов пока пустой.
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
                  Персонажей на сервере: {server.characterCount}. Выбранный по UX-default персонаж:{" "}
                  {server.selectedCharacterName ?? "пока не выбран"}.
                </p>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Активные families document area: `OGP complaints` и `Claims`. Claims пока
                  существуют как route/UI foundation и не притворяются persisted editor flow.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <FoundationLink href={`/servers/${server.code}/documents`}>
                  Открыть document area сервера
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
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Document Area</p>
        <h1 className="text-3xl font-semibold">Сервер не найден</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Такой `serverSlug` сейчас не найден среди доступных server contexts document area:{" "}
          {props.requestedServerSlug}.
        </p>
        <div className="flex flex-wrap gap-3">
          <FoundationLink href="/account/documents">Вернуться к обзору документов</FoundationLink>
        </div>
      </Card>

      {props.servers.length > 0 ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Доступные server-scoped зоны</h2>
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
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Document Area</p>
        <h1 className="text-3xl font-semibold">{props.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          На этом сервере у аккаунта пока нет персонажей, поэтому рабочий document flow ещё нельзя
          открыть. Это честный server-scoped empty state, а не deny или 404.
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Focused bridge ведёт в `/account/characters` сразу к группе нужного сервера и якорю
          создания персонажа. Это не меняет server-scoped document area semantics, а только
          убирает generic вход через transitional `/app`.
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
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Server Documents
        </p>
        <h1 className="text-3xl font-semibold">{props.server.name}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Это server-scoped document hub. Source of truth по серверу берётся только из URL, а не из
          active server shell state.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>
            UX-default: {props.selectedCharacter.source === "last_used" ? "last-used" : "first available"}
          </span>
          {typeof props.ogpComplaintDocumentCount === "number" ? (
            <span>Persisted OGP documents: {props.ogpComplaintDocumentCount}</span>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Document Family
            </p>
            <h2 className="text-2xl font-semibold">OGP complaints</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Первая уже рабочая family в document area. Здесь живут persisted drafts, owner-only
              editor route, deterministic BBCode generation и manual publication metadata.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
              Открыть OGP complaints
            </FoundationLink>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Document Family
            </p>
            <h2 className="text-2xl font-semibold">Claims</h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Отдельная family рядом с OGP complaints. Она покрывает subtype `rehabilitation` и
              `lawsuit`. Persisted drafts и owner-only routes уже заведены, но generation,
              publication и full subtype-specific payload editor появятся позже.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/claims`}>
              Открыть Claims
            </FoundationLink>
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new`}>
              Выбрать subtype
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
      ? "OGP complaints"
      : props.mode === "new"
        ? "Новая жалоба в ОГП"
        : "Future editor route";

  const description =
    props.mode === "index"
      ? "Это foundation-level family index. Здесь позже появятся реальные drafts и документы типа `ogp_complaint`."
      : props.mode === "new"
        ? "Это pre-draft entry route. До первого сохранения персонажа можно будет сменить, но persistence и snapshot model в этом шаге ещё не реализуются."
        : "Это foundation для будущего owner-account editor route. Здесь пока нет fake draft loading и нет симуляции несуществующей persistence-логики.";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            OGP Complaint Family
          </p>
          {props.mode === "editor" ? <Badge>owner-account route foundation</Badge> : null}
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>serverSlug: {props.server.code}</Badge>
          <Badge>Сервер: {props.server.name}</Badge>
          <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
          <span>Паспорт: {props.selectedCharacter.passportNumber}</span>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Текущее состояние foundation</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Persistence модели документов в этом шаге ещё нет.</li>
          <li>First-save snapshot capture ещё не реализован.</li>
          <li>Autosave, OGP wizard fields и BBCode generation пока отсутствуют.</li>
          <li>
            Выбранный персонаж показан явно и уже готов к будущему правилу “можно сменить до
            первого сохранения”.
          </li>
          {props.mode === "editor" ? (
            <li>Текущий foundation route использует documentId из URL: {props.documentId}.</li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-3">
          {props.mode !== "index" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints`}>
              Вернуться к OGP family
            </FoundationLink>
          ) : null}
          {props.mode !== "new" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/ogp-complaints/new`}>
              Открыть pre-draft entry
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
