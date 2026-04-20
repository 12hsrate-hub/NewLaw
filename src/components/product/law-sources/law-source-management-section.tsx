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

type LawSourceManagementSectionProps = {
  servers: ServerItem[];
  sourceIndexes: LawSourceIndexItem[];
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
    default:
      return null;
  }
}

export function LawSourceManagementSection({
  servers,
  sourceIndexes,
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
            На этом шаге доступны только server-scoped источники законодательной базы. Discovery,
            import темы, нормализация и retrieval пока не входят в scope.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Источники законов, import и подтверждение версий доступны только `super_admin`. Текст
          закона вручную на сайте не редактируется.
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
            здесь можно будет привязать к нему 1–2 index URL форума.
          </p>
        </Card>
      ) : null}

      {servers.map((server) => {
        const serverSourceIndexes = sourceIndexes.filter((sourceIndex) => sourceIndex.serverId === server.id);
        const sourceLimitReached = serverSourceIndexes.length >= 2;

        return (
          <Card className="space-y-5" key={server.id}>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Server</p>
              <h2 className="text-2xl font-semibold">{server.name}</h2>
              <p className="text-sm leading-6 text-[var(--muted)]">
                Для одного сервера можно хранить максимум 2 index URL с домена `forum.gta5rp.com`.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
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
                            ? ` · last discovery: ${sourceIndex.lastDiscoveryStatus}`
                            : ""}
                        </p>
                        {sourceIndex.lastDiscoveryError ? (
                          <p className="text-xs leading-5 text-[#9f3d22]">
                            Последняя ошибка discovery: {sourceIndex.lastDiscoveryError}
                          </p>
                        ) : null}
                      </div>

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
                    </div>
                  ))
                )}
              </div>

              <form action={createLawSourceIndexAction} className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/55 px-4 py-4">
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
                    Лимит 2 источника уже достигнут. Сначала отключи или замени один из текущих URL
                    на следующем шаге.
                  </p>
                ) : null}
              </form>
            </div>
          </Card>
        );
      })}
    </section>
  );
}
