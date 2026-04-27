import type { ReactNode } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DocumentAreaServerSummary } from "@/server/document-area/context";
import type { DocumentEntryCapabilities } from "@/server/navigation/capabilities";
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
            Открыть заявки на доступ
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
  documentEntryCapabilities?: DocumentEntryCapabilities;
  legalServicesAgreementDocumentCount?: number;
}) {
  const blockReasons = props.documentEntryCapabilities?.blockReasons ?? [];
  const showGeneralCharacterNote =
    blockReasons.includes("character_required") &&
    (!props.documentEntryCapabilities?.canCreateSelfComplaint ||
      !props.documentEntryCapabilities?.canCreateClaims);
  const showAttorneyAdvocateNote =
    blockReasons.includes("advocate_character_required") &&
    !props.documentEntryCapabilities?.canCreateAttorneyRequest;
  const showAgreementAdvocateNote =
    blockReasons.includes("advocate_character_required") &&
    !props.documentEntryCapabilities?.canCreateLegalServicesAgreement;
  const showAttorneyTrustorNote =
    blockReasons.includes("trustor_required_temporarily") &&
    !props.documentEntryCapabilities?.canCreateAttorneyRequest;
  const showAgreementTrustorNote =
    blockReasons.includes("trustor_required_temporarily") &&
    !props.documentEntryCapabilities?.canCreateLegalServicesAgreement;

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
              Создавайте и редактируйте жалобы в ОГП, собирайте готовый текст для форума и
              готовьте публикацию.
            </p>
            {showGeneralCharacterNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Чтобы начать жалобу, сначала нужен персонаж на этом сервере.
              </p>
            ) : null}
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
              Создавайте и редактируйте договоры на оказание юридических услуг. После заполнения
              данных можно собрать страницы договора для проверки и скачивания.
            </p>
            {showAgreementAdvocateNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для договора нужен персонаж с адвокатским доступом.
              </p>
            ) : null}
            {showAgreementTrustorNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                В текущей версии для этого действия нужен сохранённый доверитель.
              </p>
            ) : null}
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
            {showAttorneyAdvocateNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для адвокатского запроса нужен персонаж с адвокатским доступом.
              </p>
            ) : null}
            {showAttorneyTrustorNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                В текущей версии для этого действия нужен сохранённый доверитель.
              </p>
            ) : null}
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
            {showGeneralCharacterNote ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Чтобы начать иск, сначала нужен персонаж на этом сервере.
              </p>
            ) : null}
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
          <li>Сборка готового текста для форума доступна в сохранённом редакторе жалобы.</li>
          <li>
            Выбранный персонаж показан явно и может быть изменён до первого сохранения.
          </li>
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
  return subtype === "rehabilitation" ? "Реабилитация" : "Исковое заявление";
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
      ? "Иски"
      : props.mode === "new"
        ? "Новый документ из раздела «Иски»"
        : "Редактор документа из раздела «Иски»";

  const description =
    props.mode === "index"
      ? "Здесь собраны документы из раздела исков."
      : props.mode === "new"
        ? "Сначала выберите вид документа, а затем создайте черновик."
        : "Откройте сохранённый документ и продолжите редактирование.";

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Иски</p>
          {props.selectedSubtype ? <Badge>Вид документа: {formatClaimSubtypeLabel(props.selectedSubtype)}</Badge> : null}
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--muted)]">
          <Badge>Сервер: {props.server.name}</Badge>
          {props.selectedCharacter ? (
            <>
              <Badge>Персонаж: {props.selectedCharacter.fullName}</Badge>
              <span>Паспорт: {props.selectedCharacter.passportNumber}</span>
              <span>
                Сейчас выбран{" "}
                {props.selectedCharacter.source === "last_used" ? "последний использованный" : "первый доступный"} персонаж
              </span>
            </>
          ) : (
            <Badge>Персонаж пока не выбран</Badge>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-2xl font-semibold">Что доступно в этом разделе</h2>
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <li>Документ вида «Реабилитация».</li>
          <li>Документ вида «Исковое заявление».</li>
          <li>Черновики и итоговые версии документов по искам.</li>
          <li>Публикация на форуме для этого раздела не используется.</li>
          {props.mode === "editor" ? (
            <li>После первого сохранения вид документа уже не меняется автоматически.</li>
          ) : null}
        </ul>
      </Card>

      {props.mode === "new" ? (
        <Card className="space-y-4">
          <h2 className="text-2xl font-semibold">Выбор вида документа</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Перед созданием черновика нужно выбрать, какой именно документ вы хотите подготовить.
          </p>
          <div className="flex flex-wrap gap-3">
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new?subtype=rehabilitation`}>
              Выбрать реабилитацию
            </FoundationLink>
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new?subtype=lawsuit`}>
              Выбрать исковое заявление
            </FoundationLink>
          </div>
          {props.selectedSubtype ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Сейчас выбран документ вида «{formatClaimSubtypeLabel(props.selectedSubtype)}».
              Ниже можно перейти к созданию черновика.
            </p>
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">
              Пока вид документа не выбран. Без этого новый черновик не создаётся.
            </p>
          )}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {props.mode !== "index" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/claims`}>
              Вернуться к искам
            </FoundationLink>
          ) : null}
          {props.mode !== "new" ? (
            <FoundationLink href={`/servers/${props.server.code}/documents/claims/new`}>
              Выбрать вид документа
            </FoundationLink>
          ) : null}
          <FoundationLink href={`/servers/${props.server.code}/documents`}>
            Вернуться к документам сервера
          </FoundationLink>
        </div>
      </Card>
    </div>
  );
}
