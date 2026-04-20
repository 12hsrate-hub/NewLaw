import {
  runLawSourceDiscoveryAction,
  runLawTopicImportAction,
} from "@/server/actions/law-corpus";
import { createLawSourceIndexAction, toggleLawSourceIndexAction } from "@/server/actions/law-sources";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ServerItem = {
  id: string;
  name: string;
};

type LawSourceIndexItem = {
  id: string;
  serverId: string;
  indexUrl: string;
  isEnabled: boolean;
  lastDiscoveredAt: Date | null;
  lastDiscoveryStatus: "running" | "success" | "failure" | null;
  lastDiscoveryError: string | null;
};

type LawItem = {
  id: string;
  serverId: string;
  lawKey: string;
  title: string;
  topicUrl: string;
  lawKind: "primary" | "supplement";
  isExcluded: boolean;
  classificationOverride: "primary" | "supplement" | null;
  currentVersionId: string | null;
  latestVersionStatus: "imported_draft" | "current" | "superseded" | null;
  versionCount: number;
};

type LawSourceManagementSectionProps = {
  servers: ServerItem[];
  sourceIndexes: LawSourceIndexItem[];
  laws: LawItem[];
  status?: string;
};

function resolveStatusMessage(status?: string) {
  switch (status) {
    case "law-source-created":
      return "Источник законодательной базы добавлен.";
    case "law-source-updated":
      return "Состояние источника обновлено.";
    case "law-source-limit":
      return "Для одного сервера можно сохранить максимум 2 index URL.";
    case "law-source-duplicate":
      return "Такой index URL уже привязан к этому серверу.";
    case "law-source-server-not-found":
      return "Сервер для источника не найден.";
    case "law-source-not-found":
      return "Источник не найден.";
    case "law-source-create-error":
      return "Не удалось добавить источник. Проверь URL и попробуй ещё раз.";
    case "law-source-update-error":
      return "Не удалось обновить источник.";
    case "law-discovery-success":
      return "Discovery завершён. Список laws обновлён без автоматического переключения current-версий.";
    case "law-discovery-running":
      return "Discovery уже выполняется для этого источника. Дождись завершения текущего запуска.";
    case "law-discovery-error":
      return "Discovery завершился с ошибкой. Подробности смотри в статусе источника.";
    case "law-import-created":
      return "Создана новая imported_draft версия закона.";
    case "law-import-unchanged":
      return "Изменений не найдено. Новая версия закона не создавалась.";
    case "law-import-running":
      return "Import уже выполняется для этого сервера. Дождись завершения текущего запуска.";
    case "law-import-target-not-found":
      return "Целевой закон для import не найден.";
    case "law-import-no-posts":
      return "Не удалось собрать нормативную цепочку постов для импортируемой темы.";
    case "law-import-excluded":
      return "Этот закон помечен как excluded и не должен импортироваться через обычный workflow.";
    case "law-import-error":
      return "Import завершился с ошибкой.";
    default:
      return null;
  }
}

function resolveLawKindLabel(law: LawItem) {
  if (law.isExcluded) {
    return "ignored";
  }

  return law.classificationOverride ?? law.lawKind;
}

export function LawSourceManagementSection({
  servers,
  sourceIndexes,
  laws,
  status,
}: LawSourceManagementSectionProps) {
  const statusMessage = resolveStatusMessage(status);

  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Law Corpus</p>
          <h1 className="text-3xl font-semibold">Internal Source Management</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На этом шаге доступны ручные `discovery` и `import` для `super_admin`, raw source layer,
            нормализация и segmentation в `LawBlock`. Review current-version workflow и retrieval
            пока не входят в scope.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Источники законов, discovery, import и imported snapshots доступны только `super_admin`.
          Текст закона вручную на сайте не редактируется.
        </div>

        {statusMessage ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6">
            {statusMessage}
          </div>
        ) : null}
      </Card>

      {servers.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-2xl font-semibold">Серверы пока не доступны</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Сначала в bootstrap-данных должен появиться хотя бы один рабочий сервер. После этого
            здесь можно будет привязать к нему 1–2 index URL форума и запускать discovery/import.
          </p>
        </Card>
      ) : null}

      {servers.map((server) => {
        const serverSourceIndexes = sourceIndexes.filter((sourceIndex) => sourceIndex.serverId === server.id);
        const serverLaws = laws.filter((law) => law.serverId === server.id);
        const sourceLimitReached = serverSourceIndexes.length >= 2;

        return (
          <Card className="space-y-5" key={server.id}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server</p>
              <h2 className="text-2xl font-semibold">{server.name}</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для одного сервера можно хранить максимум 2 index URL с домена `forum.gta5rp.com`.
                Discovery и import запускаются вручную.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--foreground)]">Текущие источники</h3>

                {serverSourceIndexes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                    Для этого сервера источники ещё не добавлены.
                  </div>
                ) : (
                  serverSourceIndexes.map((sourceIndex) => (
                    <div
                      className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
                      key={sourceIndex.id}
                    >
                      <div className="space-y-2">
                        <p className="break-all text-sm font-medium text-[var(--foreground)]">
                          {sourceIndex.indexUrl}
                        </p>
                        <p className="text-xs leading-5 text-[var(--muted)]">
                          Статус: {sourceIndex.isEnabled ? "включён" : "отключён"}
                          {sourceIndex.lastDiscoveryStatus
                            ? ` · последний discovery: ${sourceIndex.lastDiscoveryStatus}`
                            : ""}
                        </p>
                        {sourceIndex.lastDiscoveryError ? (
                          <p className="text-xs leading-5 text-[#9f3d22]">
                            Последняя ошибка discovery: {sourceIndex.lastDiscoveryError}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <form action={toggleLawSourceIndexAction}>
                          <input name="redirectTo" type="hidden" value="/app/admin-laws" />
                          <input name="sourceIndexId" type="hidden" value={sourceIndex.id} />
                          <input
                            name="isEnabled"
                            type="hidden"
                            value={sourceIndex.isEnabled ? "false" : "true"}
                          />
                          <Button type="submit" variant="secondary">
                            {sourceIndex.isEnabled ? "Отключить" : "Включить"}
                          </Button>
                        </form>

                        <form action={runLawSourceDiscoveryAction}>
                          <input name="redirectTo" type="hidden" value="/app/admin-laws" />
                          <input name="sourceIndexId" type="hidden" value={sourceIndex.id} />
                          <Button disabled={!sourceIndex.isEnabled} type="submit" variant="secondary">
                            Запустить discovery
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                action={createLawSourceIndexAction}
                className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-4"
              >
                <input name="redirectTo" type="hidden" value="/app/admin-laws" />
                <input name="serverId" type="hidden" value={server.id} />

                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-[var(--foreground)]">Добавить index URL</h3>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    URL должен быть только с `https://forum.gta5rp.com/`.
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Index URL</span>
                  <input
                    className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
                    name="indexUrl"
                    placeholder="https://forum.gta5rp.com/forums/..."
                  />
                </label>

                <Button disabled={sourceLimitReached} type="submit">
                  Добавить источник
                </Button>

                {sourceLimitReached ? (
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Лимит 2 источника уже достигнут. Сначала отключи или замени один из текущих URL.
                  </p>
                ) : null}
              </form>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-[var(--foreground)]">Обнаруженные законы</h3>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Здесь видны `primary` и `supplement` записи, созданные после discovery. Судебные
                  прецеденты и ignored topics сюда не попадают.
                </p>
              </div>

              {serverLaws.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                  Для этого сервера laws пока не обнаружены. Сначала запусти discovery по одному из
                  index URL.
                </div>
              ) : (
                <div className="space-y-3">
                  {serverLaws.map((law) => (
                    <div
                      className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
                      key={law.id}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                          <span>{resolveLawKindLabel(law)}</span>
                          <span>·</span>
                          <span>{law.lawKey}</span>
                          <span>·</span>
                          <span>versions: {law.versionCount}</span>
                          {law.latestVersionStatus ? (
                            <>
                              <span>·</span>
                              <span>latest: {law.latestVersionStatus}</span>
                            </>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{law.title}</p>
                        <p className="break-all text-xs leading-5 text-[var(--muted)]">{law.topicUrl}</p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <form action={runLawTopicImportAction}>
                          <input name="redirectTo" type="hidden" value="/app/admin-laws" />
                          <input name="lawId" type="hidden" value={law.id} />
                          <Button
                            disabled={resolveLawKindLabel(law) === "ignored"}
                            type="submit"
                            variant="secondary"
                          >
                            Импортировать тему
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
