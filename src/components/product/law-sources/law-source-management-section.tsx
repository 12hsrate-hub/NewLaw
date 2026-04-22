import {
  confirmCurrentLawVersionAction,
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

type LawVersionItem = {
  id: string;
  status: "imported_draft" | "current" | "superseded";
  importedAt: Date;
  confirmedAt: Date | null;
  confirmedByAccountEmail: string | null;
  sourcePostsCount: number;
  blocksCount: number;
  sourceSnapshotHash: string;
  normalizedTextHash: string;
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
  versions: LawVersionItem[];
};

type RetrievalPreviewItem = {
  serverId: string;
  lawId: string;
  lawKey: string;
  lawTitle: string;
  lawVersionId: string;
  lawVersionStatus: "imported_draft" | "current" | "superseded";
  lawBlockId: string;
  blockType: "section" | "chapter" | "article" | "appendix" | "unstructured";
  blockOrder: number;
  articleNumberNormalized: string | null;
  snippet: string;
  sourceTopicUrl: string;
  sourcePosts: Array<{
    postExternalId: string;
    postUrl: string;
    postOrder: number;
  }>;
  metadata: {
    sourceSnapshotHash: string;
    normalizedTextHash: string;
    corpusSnapshotHash: string;
  };
};

type RetrievalPreview = {
  serverId: string;
  serverName: string;
  query: string;
  resultCount: number;
  corpusSnapshotHash: string;
  currentVersionIds: string[];
  results: RetrievalPreviewItem[];
};

type BootstrapHealthItem = {
  status: "corpus_bootstrap_incomplete" | "usable_with_gaps" | "current_corpus_ready";
  primaryLawCount: number;
  supplementCount: number;
  ignoredCount: number;
  currentPrimaryCount: number;
  draftOnlyPrimaryCount: number;
  missingImportPrimaryCount: number;
  hasDiscoveryFailure: boolean;
};

type LawSourceManagementSectionProps = {
  servers: ServerItem[];
  sourceIndexes: LawSourceIndexItem[];
  laws: LawItem[];
  bootstrapHealthByServerId?: Record<string, BootstrapHealthItem>;
  status?: string;
  selectedPreviewServerId?: string | null;
  previewQuery?: string | null;
  retrievalPreview?: RetrievalPreview | null;
  redirectTo?: string;
};

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return value.toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

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
    case "law-version-confirmed":
      return "Imported draft версия подтверждена и стала current.";
    case "law-version-not-found":
      return "Версия закона для подтверждения не найдена.";
    case "law-version-invalid-status":
      return "Подтвердить как current можно только imported_draft версию.";
    case "law-version-confirm-error":
      return "Не удалось подтвердить imported_draft версию как current.";
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

function resolveBootstrapStatusLabel(status: BootstrapHealthItem["status"]) {
  switch (status) {
    case "corpus_bootstrap_incomplete":
      return "corpus_bootstrap_incomplete";
    case "usable_with_gaps":
      return "usable_with_gaps";
    case "current_corpus_ready":
      return "current_corpus_ready";
    default:
      return status;
  }
}

function CurrentVersionBadge({ version }: { version: LawVersionItem | undefined }) {
  if (!version) {
    return <span>current: не выбрана</span>;
  }

  return (
    <span>
      current: {version.id.slice(0, 10)} · imported {formatDateTime(version.importedAt)}
    </span>
  );
}

function RetrievalPreviewSection({
  previewQuery,
  retrievalPreview,
  selectedPreviewServerId,
  servers,
}: {
  previewQuery?: string | null;
  retrievalPreview?: RetrievalPreview | null;
  selectedPreviewServerId?: string | null;
  servers: ServerItem[];
}) {
  const defaultServerId = selectedPreviewServerId ?? servers[0]?.id ?? "";

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Retrieval Preview</p>
        <h2 className="text-2xl font-semibold">Current Primary Law Retrieval</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Это внутренний preview lexical retrieval по `current` primary laws выбранного сервера.
          Supplements, imported_draft и superseded сюда по умолчанию не попадают.
        </p>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.45fr)_auto]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Сервер</span>
          <select
            className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
            defaultValue={defaultServerId}
            name="previewServerId"
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Запрос</span>
          <input
            className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
            defaultValue={previewQuery ?? ""}
            name="previewQuery"
            placeholder="Например: статья 1 или общие положения"
          />
        </label>

        <div className="flex items-end">
          <Button type="submit" variant="secondary">
            Проверить retrieval
          </Button>
        </div>
      </form>

      {retrievalPreview ? (
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-4">
          <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
            <p>
              Сервер: <span className="font-medium text-[var(--foreground)]">{retrievalPreview.serverName}</span>
            </p>
            <p>
              Query: <span className="font-medium text-[var(--foreground)]">{retrievalPreview.query}</span>
            </p>
            <p>
              Corpus snapshot:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {retrievalPreview.corpusSnapshotHash.slice(0, 16)}
              </span>{" "}
              · current versions: {retrievalPreview.currentVersionIds.length}
            </p>
          </div>

          {retrievalPreview.results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              По текущему primary corpus подходящих блоков не найдено.
            </div>
          ) : (
            <div className="space-y-3">
              {retrievalPreview.results.map((result) => (
                <div
                  className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-4"
                  key={result.lawBlockId}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                    <span>{result.blockType}</span>
                    {result.articleNumberNormalized ? (
                      <>
                        <span>·</span>
                        <span>article {result.articleNumberNormalized}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>{result.lawKey}</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{result.lawTitle}</p>
                  <p className="text-sm leading-6 text-[var(--foreground)]">{result.snippet}</p>
                  <div className="space-y-1 text-xs leading-5 text-[var(--muted)]">
                    <p className="break-all">Тема: {result.sourceTopicUrl}</p>
                    <p className="break-all">
                      Grounding: version {result.lawVersionId.slice(0, 10)} · block{" "}
                      {result.lawBlockId.slice(0, 10)} · snapshot{" "}
                      {result.metadata.corpusSnapshotHash.slice(0, 16)}
                    </p>
                    <p>
                      Source posts:{" "}
                      {result.sourcePosts.map((sourcePost) => `#${sourcePost.postOrder}`).join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          Здесь можно проверить, что retrieval работает только по current primary laws выбранного
          сервера и возвращает grounded metadata для будущего legal assistant.
        </div>
      )}
    </Card>
  );
}

export function LawSourceManagementSection({
  servers,
  sourceIndexes,
  laws,
  bootstrapHealthByServerId,
  status,
  selectedPreviewServerId,
  previewQuery,
  retrievalPreview,
  redirectTo = "/app/admin-laws",
}: LawSourceManagementSectionProps) {
  const statusMessage = resolveStatusMessage(status);

  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Law Corpus</p>
          <h1 className="text-3xl font-semibold">Internal Source Management</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На этом шаге доступны ручные `discovery`, `import`, подтверждение `current` версии и
            внутренний retrieval preview для `super_admin`. Public assistant UI и OpenAI-вызовы
            пока не входят в scope.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Источники законов, discovery, import, review current-version workflow и retrieval preview
          доступны только `super_admin`. Текст закона вручную на сайте не редактируется.
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

      {servers.length > 0 ? (
        <RetrievalPreviewSection
          previewQuery={previewQuery}
          retrievalPreview={retrievalPreview}
          selectedPreviewServerId={selectedPreviewServerId}
          servers={servers}
        />
      ) : null}

      {servers.map((server) => {
        const serverSourceIndexes = sourceIndexes.filter((sourceIndex) => sourceIndex.serverId === server.id);
        const serverLaws = laws.filter((law) => law.serverId === server.id);
        const sourceLimitReached = serverSourceIndexes.length >= 2;
        const bootstrapHealth = bootstrapHealthByServerId?.[server.id];

        return (
          <Card className="space-y-5" key={server.id}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server</p>
              <h2 className="text-2xl font-semibold">{server.name}</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для одного сервера можно хранить максимум 2 index URL с домена `forum.gta5rp.com`.
                Discovery и import запускаются вручную. Current-version promotion выполняется
                только вручную и только для imported_draft.
              </p>
            </div>

            {bootstrapHealth ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white/65 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                  <span>Bootstrap Health</span>
                  <span>·</span>
                  <span>{resolveBootstrapStatusLabel(bootstrapHealth.status)}</span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <p>Primary laws: {bootstrapHealth.primaryLawCount}</p>
                  <p>Current primary: {bootstrapHealth.currentPrimaryCount}</p>
                  <p>Draft only: {bootstrapHealth.draftOnlyPrimaryCount}</p>
                  <p>Missing import: {bootstrapHealth.missingImportPrimaryCount}</p>
                  <p>Supplements: {bootstrapHealth.supplementCount}</p>
                  <p>Ignored entries: {bootstrapHealth.ignoredCount}</p>
                  <p>Discovery failures: {bootstrapHealth.hasDiscoveryFailure ? "есть" : "нет"}</p>
                </div>
              </div>
            ) : null}

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
                          <input name="redirectTo" type="hidden" value={redirectTo} />
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
                          <input name="redirectTo" type="hidden" value={redirectTo} />
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
                <input name="redirectTo" type="hidden" value={redirectTo} />
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
                  {serverLaws.map((law) => {
                    const currentVersion = law.versions.find((version) => version.id === law.currentVersionId);

                    return (
                      <div
                        className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
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
                            <span>·</span>
                            <CurrentVersionBadge version={currentVersion} />
                          </div>
                          <p className="text-sm font-medium text-[var(--foreground)]">{law.title}</p>
                          <p className="break-all text-xs leading-5 text-[var(--muted)]">{law.topicUrl}</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <form action={runLawTopicImportAction}>
                            <input name="redirectTo" type="hidden" value={redirectTo} />
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

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-[var(--foreground)]">Версии закона</h4>
                            <p className="text-xs leading-5 text-[var(--muted)]">
                              Только `imported_draft` версия может быть вручную подтверждена как
                              `current`. Автоматического promote нет.
                            </p>
                          </div>

                          {law.versions.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/75 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                              У этого закона пока нет импортированных версий.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {law.versions.map((version) => (
                                <div
                                  className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/85 px-4 py-4"
                                  key={version.id}
                                >
                                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                                    <span>{version.status}</span>
                                    <span>·</span>
                                    <span>{version.id.slice(0, 12)}</span>
                                    <span>·</span>
                                    <span>imported {formatDateTime(version.importedAt)}</span>
                                  </div>

                                  <div className="grid gap-2 text-sm leading-6 text-[var(--muted)] md:grid-cols-2">
                                    <p>Source posts: {version.sourcePostsCount}</p>
                                    <p>Blocks: {version.blocksCount}</p>
                                    <p className="break-all">
                                      source_snapshot_hash: {version.sourceSnapshotHash}
                                    </p>
                                    <p className="break-all">
                                      normalized_text_hash: {version.normalizedTextHash}
                                    </p>
                                    <p>
                                      confirmed_at: {formatDateTime(version.confirmedAt)}
                                    </p>
                                    <p>
                                      confirmed_by:{" "}
                                      <span className="font-medium text-[var(--foreground)]">
                                        {version.confirmedByAccountEmail ?? "—"}
                                      </span>
                                    </p>
                                  </div>

                                  {version.status === "imported_draft" ? (
                                    <form action={confirmCurrentLawVersionAction}>
                                      <input name="redirectTo" type="hidden" value={redirectTo} />
                                      <input name="lawVersionId" type="hidden" value={version.id} />
                                      <Button type="submit">Подтвердить как current</Button>
                                    </form>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
