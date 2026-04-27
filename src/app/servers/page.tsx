import { PublicServerDirectory } from "@/components/product/server-directory/public-server-directory";
import { PageContainer } from "@/components/ui/page-container";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { SectionHeader } from "@/components/ui/section-header";
import { getPublicServerDirectoryContext } from "@/server/server-directory/context";

export const dynamic = "force-dynamic";

export default async function ServersDirectoryPage() {
  const context = await getPublicServerDirectoryContext();

  return (
    <PageContainer as="main" contentClassName="flex flex-col gap-6" variant="wide">
      <EmbeddedCard className="space-y-4">
        <SectionHeader
          description="Выберите сервер, чтобы перейти к юридическому помощнику или открыть документы по этому серверу."
          eyebrow="Серверы"
          title="Серверы"
        />
        <p className="text-sm leading-7 text-[var(--muted)]">
          {context.viewer.isAuthenticated
            ? "Если у вас уже есть доступ и персонаж, нужные разделы можно открыть сразу."
            : "Без входа можно пользоваться юридическим помощником. Для документов по серверу понадобится вход в аккаунт."}
        </p>
      </EmbeddedCard>

      <PublicServerDirectory servers={context.servers} />
    </PageContainer>
  );
}
