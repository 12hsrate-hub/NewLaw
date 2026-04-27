import { AssistantServerSelector } from "@/components/product/legal-assistant/assistant-server-selector";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { listAssistantServers } from "@/db/repositories/server.repository";
import { getAssistantViewerContext } from "@/server/legal-assistant/viewer";

export const dynamic = "force-dynamic";

export default async function AssistantLandingPage() {
  const [viewer, servers] = await Promise.all([
    getAssistantViewerContext(),
    listAssistantServers(),
  ]);

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <Card className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
              Юридический помощник
            </p>
            <h1 className="text-4xl font-semibold">Юридический помощник по законодательству сервера</h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Выберите сервер, чтобы задать вопрос по его законодательству и судебной практике.
              Если части материалов не хватает, помощник предупредит об этом в ответе.
            </p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              {viewer.isAuthenticated
                ? `Вы вошли как ${viewer.account?.login ?? "аккаунт"}. Гостевой лимит на вас не распространяется.`
                : "Без входа доступен 1 тестовый вопрос. После этого старый ответ останется доступным, а для нового вопроса понадобится вход или регистрация."}
            </p>
          </Card>

          <AssistantServerSelector servers={servers} />
        </div>
      </main>
    </PageContainer>
  );
}
