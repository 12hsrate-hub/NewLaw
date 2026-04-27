import { PublicServerDirectory } from "@/components/product/server-directory/public-server-directory";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { getPublicServerDirectoryContext } from "@/server/server-directory/context";

export const dynamic = "force-dynamic";

export default async function ServersDirectoryPage() {
  const context = await getPublicServerDirectoryContext();

  return (
    <PageContainer>
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <Card className="space-y-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
              Серверы
            </p>
            <h1 className="text-4xl font-semibold">Серверы</h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Выберите сервер, чтобы перейти к юридическому помощнику или открыть документы по
              этому серверу.
            </p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              {context.viewer.isAuthenticated
                ? "Если у вас уже есть доступ и персонаж, нужные разделы можно открыть сразу."
                : "Без входа можно пользоваться юридическим помощником. Для документов по серверу понадобится вход в аккаунт."}
            </p>
          </Card>

          <PublicServerDirectory servers={context.servers} />
        </div>
      </main>
    </PageContainer>
  );
}
