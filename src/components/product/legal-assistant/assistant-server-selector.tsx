import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Серверы пока недоступны</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Для юридического помощника пока нет доступных серверов.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {servers.map((server) => {
        const href = `/assistant/${server.code}`;
        const isCurrent = currentServerCode === server.code;

        return (
          <Link key={server.id} href={href}>
            <Card className="h-full space-y-3 transition hover:translate-y-[-1px] hover:bg-white/80">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{server.name}</Badge>
                {isCurrent ? <Badge className="bg-[rgba(32,99,69,0.12)] text-[#206345]">Текущий сервер</Badge> : null}
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">
                {server.hasUsableAssistantCorpus
                  ? `Доступно: ${server.currentPrimaryLawCount} норм закона и ${server.currentPrecedentCount} судебных прецедентов.`
                  : "Для этого сервера пока не хватает подтверждённых правовых материалов."}
              </p>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                Открыть помощника
              </p>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
