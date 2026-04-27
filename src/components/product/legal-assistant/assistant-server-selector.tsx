import Link from "next/link";

import { EmptyStateCard } from "@/components/product/foundation/empty-state-card";
import { WorkspaceCard } from "@/components/product/foundation/workspace-card";
import { StatusBadge } from "@/components/ui/status-badge";

type AssistantServerSelectorProps = {
  servers: Array<{
    id: string;
    code: string;
    name: string;
    hasCurrentLawCorpus: boolean;
    currentPrimaryLawCount: number;
    hasUsablePrecedentCorpus: boolean;
    currentPrecedentCount: number;
    hasUsableAssistantCorpus: boolean;
  }>;
  currentServerCode?: string | null;
};

export function AssistantServerSelector({
  servers,
  currentServerCode = null,
}: AssistantServerSelectorProps) {
  if (servers.length === 0) {
    return (
      <EmptyStateCard
        description="Для юридического помощника сейчас нет доступных серверов. Попробуйте открыть другой раздел или вернитесь позже."
        eyebrow="Юридический помощник"
        primaryAction={{
          href: "/servers",
          label: "Открыть серверы",
        }}
        title="Пока нет доступных серверов"
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {servers.map((server) => {
        const href = `/assistant/${server.code}`;
        const isCurrent = currentServerCode === server.code;

        return (
          <Link key={server.id} href={href}>
            <WorkspaceCard
              className="h-full transition hover:translate-y-[-1px] hover:bg-[var(--surface-hover)]"
              description={
                server.hasUsableAssistantCorpus
                  ? `Доступно: ${server.currentPrimaryLawCount} норм закона и ${server.currentPrecedentCount} судебных прецедентов.`
                  : "Для этого сервера пока не хватает подтверждённых правовых материалов."
              }
              eyebrow="Сервер"
              meta={
                <>
                  <StatusBadge tone="warning">{server.name}</StatusBadge>
                  {isCurrent ? <StatusBadge tone="success">Текущий сервер</StatusBadge> : null}
                </>
              }
              title="Открыть помощника"
            />
          </Link>
        );
      })}
    </div>
  );
}
