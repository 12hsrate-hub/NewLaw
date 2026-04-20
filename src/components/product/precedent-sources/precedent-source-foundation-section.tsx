import {
  createPrecedentSourceTopicAction,
  updatePrecedentSourceTopicAction,
} from "@/server/actions/precedent-sources";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
};

type PrecedentSourceFoundationSectionProps = {
  servers: ServerItem[];
  sourceIndexes: LawSourceIndexItem[];
  sourceTopics: PrecedentSourceTopicItem[];
  status?: string;
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

export function PrecedentSourceFoundationSection({
  servers,
  sourceIndexes,
  sourceTopics,
  status,
}: PrecedentSourceFoundationSectionProps) {
  const statusMessage = resolveStatusMessage(status);

  return (
    <section className="space-y-6">
      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Judicial Precedents
          </p>
          <h2 className="text-2xl font-semibold">Precedent Source Topic Foundation</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            На этом шаге доступны только foundation-данные precedents corpus: отдельные source
            topics, manual override поля и признак включения или исключения. Discovery, import,
            split topic на несколько precedents, current review и assistant integration сюда пока
            не входят.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Precedents остаются отдельным corpus. Они не сохраняются как `law_kind`, не смешиваются
          с `supplement` и не попадают в текущий assistant автоматически. Текст precedent вручную
          на сайте не редактируется.
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
                Source topic precedents привязываются к уже существующим `LawSourceIndex`, но
                остаются отдельной доменной сущностью. На этом шаге их можно завести вручную и
                подготовить manual override foundation для будущего precedent discovery/import.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-[var(--foreground)]">
                  Precedent source topics
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
                        {sourceTopic.lastDiscoveryError ? (
                          <p className="text-xs leading-5 text-[#9f3d22]">
                            Последняя ошибка discovery: {sourceTopic.lastDiscoveryError}
                          </p>
                        ) : null}
                      </div>

                      <form action={updatePrecedentSourceTopicAction} className="space-y-3">
                        <input name="redirectTo" type="hidden" value="/app/admin-laws" />
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
                    </div>
                  ))
                )}
              </div>

              <form
                action={createPrecedentSourceTopicAction}
                className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-4"
              >
                <input name="redirectTo" type="hidden" value="/app/admin-laws" />

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
