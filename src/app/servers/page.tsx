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
              Server Directory
            </p>
            <h1 className="text-4xl font-semibold">Публичный каталог серверов</h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Это общая входная точка в server-scoped зону. Отсюда можно перейти в уже
              существующий assistant или понять, готов ли documents flow для конкретного
              сервера и текущего viewer.
            </p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              {context.viewer.isAuthenticated
                ? "Ты авторизован, поэтому directory уже показывает, где documents доступны сразу, а где сначала нужен персонаж."
                : "Без входа directory остаётся публичным: assistant можно открыть сразу, а documents честно помечаются как private route."}
            </p>
          </Card>

          <PublicServerDirectory servers={context.servers} />
        </div>
      </main>
    </PageContainer>
  );
}
