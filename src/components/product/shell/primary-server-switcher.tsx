"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { selectActiveServerAction } from "@/server/actions/shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type PrimaryServerSwitcherProps = {
  activeServerId: string | null;
  availableServers: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  compact?: boolean;
};

function buildRedirectTo(pathname: string | null, searchParams: { toString(): string } | null) {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/servers";
  }

  const query = searchParams?.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function PrimaryServerSwitcher({
  activeServerId,
  availableServers,
  compact = false,
}: PrimaryServerSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectTo = buildRedirectTo(pathname, searchParams);
  const hasAvailableServers = availableServers.length > 0;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p
        className={
          compact
            ? "text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--muted)]"
            : "text-sm font-medium text-[var(--foreground)]"
        }
      >
        Сервер
      </p>
      <form
        action={selectActiveServerAction}
        className={compact ? "flex items-center gap-2" : "flex flex-col gap-2 sm:flex-row sm:items-center"}
      >
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <Select
          className={compact ? "min-w-[148px] rounded-xl px-3 py-2 text-xs sm:min-w-[170px]" : undefined}
          defaultValue={activeServerId ?? availableServers[0]?.id ?? ""}
          disabled={!hasAvailableServers}
          name="serverId"
        >
          {!hasAvailableServers ? (
            <option value="">Серверов пока нет</option>
          ) : (
            availableServers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))
          )}
        </Select>
        <Button
          className={compact ? "rounded-xl px-3 py-2 text-xs" : undefined}
          disabled={!hasAvailableServers}
          type="submit"
          variant="secondary"
        >
          {compact ? "Ок" : "Переключить"}
        </Button>
      </form>
      {compact ? null : !hasAvailableServers ? (
        <p className="text-sm leading-6 text-[var(--muted)]">
          Пока нет доступных серверов для переключения.
        </p>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          Текущий выбор влияет на серверные разделы и документы.
        </p>
      )}
    </div>
  );
}
