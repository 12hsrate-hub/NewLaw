import { AssistantServerSelector } from "@/components/product/legal-assistant/assistant-server-selector";
import { PageContainer } from "@/components/ui/page-container";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
import { listAssistantServers } from "@/db/repositories/server.repository";
import { getAssistantViewerContext } from "@/server/legal-assistant/viewer";

export const dynamic = "force-dynamic";

export default async function AssistantLandingPage() {
  const [viewer, servers] = await Promise.all([
    getAssistantViewerContext(),
    listAssistantServers(),
  ]);

  return (
    <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
      <EmbeddedCard className="space-y-4">
        <SectionHeader
          description="Выберите сервер, чтобы задать вопрос по его законодательству и судебной практике. Если части материалов не хватает, помощник предупредит об этом в ответе."
          eyebrow="Юридический помощник"
          title="Юридический помощник по законодательству сервера"
        />
        <p className="text-sm leading-7 text-[var(--muted)]">
          {viewer.isAuthenticated
            ? `Вы вошли как ${viewer.account?.login ?? "аккаунт"}. Гостевой лимит на вас не распространяется.`
            : "Без входа доступен 1 тестовый вопрос. После этого старый ответ останется доступным, а для нового вопроса понадобится вход или регистрация."}
        </p>
      </EmbeddedCard>

      <AssistantServerSelector servers={servers} />
    </PageContainer>
  );
}
