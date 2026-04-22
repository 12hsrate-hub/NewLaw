import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmCurrentPrecedentVersionAction,
  rollbackPrecedentCurrentVersionAction,
  runPrecedentSourceDiscoveryAction,
  runPrecedentSourceTopicImportAction,
  updatePrecedentValidityStatusAction,
} from "@/server/actions/precedent-corpus";
import {
  createPrecedentSourceTopicAction,
  updatePrecedentSourceTopicAction,
} from "@/server/actions/precedent-sources";
import { isStructurallyWeakPrecedentVersion } from "@/server/precedent-corpus/current-review";

type ServerItem = {
  id: string;
  name: string;
};

type LawSourceIndexItem = {
  id: string;
  serverId: string;
  indexUrl: string;
  isEnabled: boolean;
};

type PrecedentVersionItem = {
  id: string;
  status: "imported_draft" | "current" | "superseded";
  importedAt: Date;
  confirmedAt: Date | null;
  confirmedByAccountEmail: string | null;
  sourcePostsCount: number;
  blocksCount: number;
  sourceSnapshotHash: string;
  normalizedTextHash: string;
  blockTypes: Array<"facts" | "issue" | "holding" | "reasoning" | "resolution" | "unstructured">;
};

type PrecedentSourceTopicItem = {
  id: string;
  serverId: string;
  sourceIndexId: string;
  topicUrl: string;
  topicExternalId: string;
  title: string;
  isExcluded: boolean;
  classificationOverride: "precedent" | "ignored" | null;
  internalNote: string | null;
  lastDiscoveredAt: Date | null;
  lastDiscoveryStatus: "running" | "success" | "failure" | null;
  lastDiscoveryError: string | null;
  sourceIndexUrl: string;
  precedentsCount: number;
  latestImportRun:
    | {
        status: "running" | "success" | "failure";
        startedAt: Date;
        summary: string | null;
        error: string | null;
      }
    | null;
  precedents: Array<{
    id: string;
    displayTitle: string;
    precedentKey: string;
    precedentLocatorKey: string;
    validityStatus: "applicable" | "limited" | "obsolete";
    currentVersionId: string | null;
    latestVersionStatus: "imported_draft" | "current" | "superseded" | null;
    versionCount: number;
    versions: PrecedentVersionItem[];
  }>;
};

type PrecedentSourceFoundationSectionProps = {
  servers: ServerItem[];
  sourceIndexes: LawSourceIndexItem[];
  sourceTopics: PrecedentSourceTopicItem[];
  status?: string;
  redirectTo?: string;
};

function resolveStatusMessage(status?: string) {
  switch (status) {
    case "precedent-source-created":
      return "Precedent source topic добавлен.";
    case "precedent-source-updated":
      return "Manual override поля precedent source topic обновлены.";
    case "precedent-source-index-not-found":
      return "Источник законодательной базы для precedent source topic не найден.";
    case "precedent-source-duplicate":
      return "Такой precedent source topic уже существует для этого сервера.";
    case "precedent-source-not-found":
      return "Precedent source topic не найден.";
    case "precedent-source-create-error":
      return "Не удалось добавить precedent source topic. Проверь topic URL и попробуй ещё раз.";
    case "precedent-source-update-error":
      return "Не удалось обновить manual override поля precedent source topic.";
    case "precedent-discovery-success":
      return "Precedent discovery завершён. Source topics обновлены через отдельный precedent pipeline.";
    case "precedent-discovery-running":
      return "Precedent discovery уже выполняется для этого index URL.";
    case "precedent-discovery-error":
      return "Precedent discovery завершился с ошибкой.";
    case "precedent-import-created":
      return "Precedent import завершён. Созданы новые imported_draft версии.";
    case "precedent-import-unchanged":
      return "Precedent import завершён без новых версий: normalized text не изменился.";
    case "precedent-import-running":
      return "Precedent import уже выполняется для этого source topic.";
    case "precedent-source-topic-not-found":
      return "Precedent source topic для import не найден.";
    case "precedent-import-no-posts":
      return "Не удалось собрать topic snapshot для precedent import.";
    case "precedent-import-excluded":
      return "Этот precedent source topic помечен как excluded и не должен импортироваться через обычный workflow.";
    case "precedent-import-error":
      return "Precedent import завершился с ошибкой.";
    case "precedent-version-confirmed":
      return "Imported draft precedent version подтверждена как current.";
    case "precedent-version-not-found":
      return "Версия прецедента для review не найдена.";
    case "precedent-version-invalid-status":
      return "Подтвердить как current можно только imported_draft версию прецедента.";
    case "precedent-version-confirm-error":
      return "Не удалось подтвердить precedent version как current.";
    case "precedent-validity-updated":
      return "Validity status прецедента обновлён.";
    case "precedent-validity-current-required":
      return "Сначала нужно выбрать current версию прецедента, а уже потом менять validity status.";
    case "precedent-validity-update-error":
      return "Не удалось обновить validity status прецедента.";
    case "precedent-version-rolled-back":
      return "Rollback precedent version выполнен: superseded версия восстановлена как current.";
    case "precedent-rollback-target-not-found":
      return "Версия прецедента для rollback не найдена.";
    case "precedent-rollback-invalid-status":
      return "Rollback доступен только для superseded precedent version.";
    case "precedent-rollback-error":
      return "Не удалось выполнить rollback precedent version.";
    default:
      return null;
  }
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return value.toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getVersionDiffSummary(
  version: PrecedentVersionItem,
  currentVersion: PrecedentVersionItem | null,
) {
  if (!currentVersion) {
    return "Current version ещё не выбрана, поэтому confirm идёт как первый подтверждённый snapshot.";
  }

  if (currentVersion.id === version.id) {
    return "Это текущая подтверждённая версия precedent.";
  }

  if (currentVersion.normalizedTextHash === version.normalizedTextHash) {
    return "normalized_text_hash совпадает с current версией. Review нужен только на случай ручного rollback.";
  }

  return "normalized_text_hash отличается от current версии. Перед confirm или rollback проверь summary, hashes и block structure.";
}

export function PrecedentSourceFoundationSection({
  servers,
  sourceIndexes,
  sourceTopics,
  status,
  redirectTo = "/internal/laws",
}: PrecedentSourceFoundationSectionProps) {
  const statusMessage = resolveStatusMessage(status);

  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Judicial Precedents
          </p>
          <h2 className="text-2xl font-semibold">Precedent Corpus Review</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На этом шаге доступны separate precedent pipeline, manual current-review, отдельный
            validity workflow и минимальный rollback foundation. Assistant integration и unified
            law + precedent retrieval сюда по-прежнему не входят.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Precedents остаются отдельным corpus. Они не сохраняются как `law_kind`, не смешиваются
          с `supplement` и не попадают в текущий assistant автоматически. Review идёт только через
          `super_admin`, а текст precedent по-прежнему не редактируется руками.
        </div>

        {statusMessage ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6">
            {statusMessage}
          </div>
        ) : null}
      </Card>

      {servers.map((server) => {
        const serverSourceIndexes = sourceIndexes.filter((sourceIndex) => sourceIndex.serverId === server.id);
        const serverSourceTopics = sourceTopics.filter((sourceTopic) => sourceTopic.serverId === server.id);

        return (
          <Card className="space-y-5" key={server.id}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server</p>
              <h3 className="text-2xl font-semibold">{server.name}</h3>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Здесь собраны source topic foundation, import summary, extracted precedents,
                imported_draft review, current workflow, validity status и безопасный rollback на
                superseded snapshots.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-3">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-[var(--foreground)]">
                    Precedent discovery по source indexes
                  </h4>

                  {serverSourceIndexes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                      Для этого сервера нет доступных `LawSourceIndex`, через которые можно
                      запустить отдельный precedent discovery pipeline.
                    </div>
                  ) : (
                    serverSourceIndexes.map((sourceIndex) => (
                      <div
                        className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
                        key={sourceIndex.id}
                      >
                        <p className="break-all text-sm font-medium text-[var(--foreground)]">
                          {sourceIndex.indexUrl}
                        </p>
                        <p className="text-xs leading-5 text-[var(--muted)]">
                          Статус source index: {sourceIndex.isEnabled ? "enabled" : "disabled"}
                        </p>
                        <form action={runPrecedentSourceDiscoveryAction}>
                          <input name="redirectTo" type="hidden" value={redirectTo} />
                          <input name="sourceIndexId" type="hidden" value={sourceIndex.id} />
                          <Button disabled={!sourceIndex.isEnabled} type="submit" variant="secondary">
                            Запустить precedent discovery
                          </Button>
                        </form>
                      </div>
                    ))
                  )}
                </div>

                <h4 className="text-sm font-medium text-[var(--foreground)]">
                  Precedent source topics и review
                </h4>

                {serverSourceTopics.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                    Для этого сервера precedent source topics пока не заведены.
                  </div>
                ) : (
                  serverSourceTopics.map((sourceTopic) => (
                    <div
                      className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4"
                      key={sourceTopic.id}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                          <span>{sourceTopic.classificationOverride ?? "precedent"}</span>
                          <span>·</span>
                          <span>{sourceTopic.isExcluded ? "excluded" : "included"}</span>
                          <span>·</span>
                          <span>precedents: {sourceTopic.precedentsCount}</span>
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{sourceTopic.title}</p>
                        <p className="break-all text-xs leading-5 text-[var(--muted)]">
                          topic_url: {sourceTopic.topicUrl}
                        </p>
                        <p className="break-all text-xs leading-5 text-[var(--muted)]">
                          topic_external_id: {sourceTopic.topicExternalId} · source index:{" "}
                          {sourceTopic.sourceIndexUrl}
                        </p>
                        <p className="text-xs leading-5 text-[var(--muted)]">
                          last discovery: {sourceTopic.lastDiscoveryStatus ?? "—"} ·{" "}
                          {formatDateTime(sourceTopic.lastDiscoveredAt)}
                        </p>
                        {sourceTopic.latestImportRun ? (
                          <p className="text-xs leading-5 text-[var(--muted)]">
                            last import: {sourceTopic.latestImportRun.status} ·{" "}
                            {formatDateTime(sourceTopic.latestImportRun.startedAt)}
                          </p>
                        ) : null}
                        {sourceTopic.latestImportRun?.summary ? (
                          <p className="text-xs leading-5 text-[var(--muted)]">
                            import summary: {sourceTopic.latestImportRun.summary}
                          </p>
                        ) : null}
                        {sourceTopic.latestImportRun?.error ? (
                          <p className="text-xs leading-5 text-[#9f3d22]">
                            Последняя ошибка import: {sourceTopic.latestImportRun.error}
                          </p>
                        ) : null}
                        {sourceTopic.lastDiscoveryError ? (
                          <p className="text-xs leading-5 text-[#9f3d22]">
                            Последняя ошибка discovery: {sourceTopic.lastDiscoveryError}
                          </p>
                        ) : null}
                      </div>

                      <form action={updatePrecedentSourceTopicAction} className="space-y-3">
                        <input name="redirectTo" type="hidden" value={redirectTo} />
                        <input name="sourceTopicId" type="hidden" value={sourceTopic.id} />

                        <div className="grid gap-3 lg:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-sm font-medium text-[var(--foreground)]">
                              Include / exclude
                            </span>
                            <select
                              className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                              defaultValue={sourceTopic.isExcluded ? "true" : "false"}
                              name="isExcluded"
                            >
                              <option value="false">included</option>
                              <option value="true">excluded</option>
                            </select>
                          </label>

                          <label className="space-y-2">
                            <span className="text-sm font-medium text-[var(--foreground)]">
                              classification override
                            </span>
                            <select
                              className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                              defaultValue={sourceTopic.classificationOverride ?? ""}
                              name="classificationOverride"
                            >
                              <option value="">auto / none</option>
                              <option value="precedent">precedent</option>
                              <option value="ignored">ignored</option>
                            </select>
                          </label>
                        </div>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-[var(--foreground)]">
                            internal note
                          </span>
                          <Textarea
                            className="min-h-24"
                            defaultValue={sourceTopic.internalNote ?? ""}
                            name="internalNote"
                            placeholder="Короткая внутренняя пометка для будущего review/discovery."
                          />
                        </label>

                        <Button type="submit" variant="secondary">
                          Сохранить manual override
                        </Button>
                      </form>

                      <div className="flex flex-wrap gap-3">
                        <form action={runPrecedentSourceTopicImportAction}>
                          <input name="redirectTo" type="hidden" value={redirectTo} />
                          <input name="sourceTopicId" type="hidden" value={sourceTopic.id} />
                          <Button disabled={sourceTopic.isExcluded} type="submit" variant="secondary">
                            Импортировать source topic
                          </Button>
                        </form>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          Извлечённые precedents
                        </p>

                        {sourceTopic.precedents.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/75 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                            После import здесь появятся extracted precedents и их review summary.
                          </div>
                        ) : (
                          sourceTopic.precedents.map((precedent) => {
                            const currentVersion =
                              precedent.versions.find((version) => version.id === precedent.currentVersionId) ??
                              null;

                            return (
                              <div
                                className="space-y-4 rounded-2xl border border-[var(--border)] bg-white/85 px-4 py-4"
                                key={precedent.id}
                              >
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                                      <span>{precedent.validityStatus}</span>
                                      <span>·</span>
                                      <span>{precedent.precedentKey}</span>
                                      <span>·</span>
                                      <span>locator: {precedent.precedentLocatorKey}</span>
                                      <span>·</span>
                                      <span>versions: {precedent.versionCount}</span>
                                      {precedent.latestVersionStatus ? (
                                        <>
                                          <span>·</span>
                                          <span>latest: {precedent.latestVersionStatus}</span>
                                        </>
                                      ) : null}
                                    </div>
                                    <p className="text-sm font-medium text-[var(--foreground)]">
                                      {precedent.displayTitle}
                                    </p>
                                    <p className="text-xs leading-5 text-[var(--muted)]">
                                      source topic: {sourceTopic.title}
                                    </p>
                                    <p className="text-xs leading-5 text-[var(--muted)]">
                                      current: {precedent.currentVersionId ?? "не выбрана"}
                                    </p>
                                  </div>

                                  <form action={updatePrecedentValidityStatusAction} className="space-y-2">
                                    <input name="redirectTo" type="hidden" value={redirectTo} />
                                    <input name="precedentId" type="hidden" value={precedent.id} />
                                    <label className="space-y-2">
                                      <span className="text-sm font-medium text-[var(--foreground)]">
                                        validity status
                                      </span>
                                      <select
                                        className="w-full min-w-52 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                                        defaultValue={precedent.validityStatus}
                                        name="validityStatus"
                                      >
                                        <option value="applicable">applicable</option>
                                        <option value="limited">limited</option>
                                        <option value="obsolete">obsolete</option>
                                      </select>
                                    </label>
                                    <Button type="submit" variant="secondary">
                                      Обновить validity
                                    </Button>
                                  </form>
                                </div>

                                <div className="space-y-3">
                                  {precedent.versions.map((version) => {
                                    const structurallyWeak = isStructurallyWeakPrecedentVersion({
                                      status: version.status,
                                      blocks: version.blockTypes.map((blockType) => ({ blockType })),
                                    });

                                    return (
                                      <div
                                        className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/95 px-4 py-4"
                                        key={version.id}
                                      >
                                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                                          <span>{version.status}</span>
                                          <span>·</span>
                                          <span>posts: {version.sourcePostsCount}</span>
                                          <span>·</span>
                                          <span>blocks: {version.blocksCount}</span>
                                          {precedent.currentVersionId === version.id ? (
                                            <>
                                              <span>·</span>
                                              <span>current</span>
                                            </>
                                          ) : null}
                                          {structurallyWeak ? (
                                            <>
                                              <span>·</span>
                                              <span>weak-structure warning</span>
                                            </>
                                          ) : null}
                                        </div>

                                        <div className="grid gap-2 text-xs leading-5 text-[var(--muted)]">
                                          <p>imported_at: {formatDateTime(version.importedAt)}</p>
                                          <p>confirmed_at: {formatDateTime(version.confirmedAt)}</p>
                                          <p>
                                            confirmed_by: {version.confirmedByAccountEmail ?? "—"}
                                          </p>
                                          <p className="break-all">
                                            source_snapshot_hash: {version.sourceSnapshotHash}
                                          </p>
                                          <p className="break-all">
                                            normalized_text_hash: {version.normalizedTextHash}
                                          </p>
                                          <p>block types: {version.blockTypes.join(", ") || "—"}</p>
                                          <p>{getVersionDiffSummary(version, currentVersion)}</p>
                                          {structurallyWeak ? (
                                            <p className="text-[#9f3d22]">
                                              Структура precedent draft выглядит слабой: blocks либо
                                              отсутствуют, либо почти полностью `unstructured`.
                                              Это warning для review, а не автоматический запрет.
                                            </p>
                                          ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                          {version.status === "imported_draft" ? (
                                            <form action={confirmCurrentPrecedentVersionAction}>
                                              <input name="redirectTo" type="hidden" value={redirectTo} />
                                              <input name="precedentVersionId" type="hidden" value={version.id} />
                                              <Button type="submit" variant="secondary">
                                                Подтвердить как current
                                              </Button>
                                            </form>
                                          ) : null}

                                          {version.status === "superseded" ? (
                                            <form action={rollbackPrecedentCurrentVersionAction}>
                                              <input name="redirectTo" type="hidden" value={redirectTo} />
                                              <input name="precedentVersionId" type="hidden" value={version.id} />
                                              <Button type="submit" variant="secondary">
                                                Rollback на эту версию
                                              </Button>
                                            </form>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                action={createPrecedentSourceTopicAction}
                className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-4"
              >
                <input name="redirectTo" type="hidden" value={redirectTo} />

                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-[var(--foreground)]">
                    Добавить precedent source topic
                  </h4>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Source topic должен ссылаться на тему форума и привязывается к уже существующему
                    `LawSourceIndex` этого сервера.
                  </p>
                </div>

                {serverSourceIndexes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/75 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                    Сначала добавь хотя бы один `LawSourceIndex` для этого сервера. Без него
                    precedent source topic foundation не создаётся.
                  </div>
                ) : (
                  <>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        Source index
                      </span>
                      <select
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white"
                        defaultValue={serverSourceIndexes[0]?.id ?? ""}
                        name="sourceIndexId"
                      >
                        {serverSourceIndexes.map((sourceIndex) => (
                          <option key={sourceIndex.id} value={sourceIndex.id}>
                            {sourceIndex.indexUrl}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">Topic URL</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
                        name="topicUrl"
                        placeholder="https://forum.gta5rp.com/threads/..."
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">Title</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-white"
                        name="title"
                        placeholder="Например: Решение Верховного суда ..."
                      />
                    </label>

                    <Button type="submit">Добавить precedent source topic</Button>
                  </>
                )}
              </form>
            </div>
          </Card>
        );
      })}
    </section>
  );
}
