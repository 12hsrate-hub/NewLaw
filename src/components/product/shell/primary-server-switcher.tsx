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
}: PrimaryServerSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectTo = buildRedirectTo(pathname, searchParams);
  const hasAvailableServers = availableServers.length > 0;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--foreground)]">Сервер</p>
      <form action={selectActiveServerAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <Select
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
        <Button disabled={!hasAvailableServers} type="submit" variant="secondary">
          Переключить
        </Button>
      </form>
      {!hasAvailableServers ? (
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
