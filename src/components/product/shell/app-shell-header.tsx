import Link from "next/link";

import { signOutAction } from "@/server/actions/auth";
import {
  selectActiveCharacterAction,
  selectActiveServerAction,
} from "@/server/actions/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type ServerOption = {
  id: string;
  name: string;
};

type CharacterOption = {
  id: string;
  fullName: string;
  passportNumber: string;
};

type AppShellHeaderProps = {
  accountEmail: string;
  accountLogin: string;
  activeCharacterId: string | null;
  activeCharacterName: string | null;
  activeServerId: string | null;
  activeServerName: string | null;
  characters: CharacterOption[];
  currentPath: string;
  isSuperAdmin?: boolean;
  mustChangePassword: boolean;
  servers: ServerOption[];
};

export function AppShellHeader({
  accountEmail,
  accountLogin,
  activeCharacterId,
  activeCharacterName,
  activeServerId,
  activeServerName,
  characters,
  currentPath,
  isSuperAdmin = false,
  mustChangePassword,
  servers,
}: AppShellHeaderProps) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Внутренний контур</p>
          <h1 className="text-3xl font-semibold">Lawyer5RP MVP</h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Аккаунт: <span className="font-medium text-[var(--foreground)]">{accountEmail}</span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Login: <span className="font-medium text-[var(--foreground)]">{accountLogin}</span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Активный сервер:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {activeServerName ?? "Сервер ещё не выбран"}
            </span>
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Активный персонаж:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {activeCharacterName ?? "Персонаж ещё не выбран"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
            href="/app/security"
          >
            Безопасность
          </Link>
          {isSuperAdmin ? (
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white"
              href="/app/admin-security"
            >
              Admin Security
            </Link>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              Выйти
            </Button>
          </form>
        </div>
      </div>

      {mustChangePassword ? (
        <div className="rounded-2xl border border-[#d7c4b6] bg-[#fff5eb] px-4 py-3 text-sm leading-6 text-[#7a3f1d]">
          Для продолжения работы сначала обнови пароль аккаунта. Пока пароль не изменён, остальные действия внутри защищённой части временно заблокированы.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={selectActiveServerAction} className="space-y-3">
          <input name="redirectTo" type="hidden" value={currentPath} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="serverId">
              Активный сервер
            </label>
            <Select
              defaultValue={activeServerId ?? ""}
              disabled={mustChangePassword}
              id="serverId"
              name="serverId"
              required
            >
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </Select>
          </div>
          <Button disabled={mustChangePassword} type="submit" variant="secondary">
            Выбрать сервер
          </Button>
        </form>

        <form action={selectActiveCharacterAction} className="space-y-3">
          <input name="redirectTo" type="hidden" value={currentPath} />
          <input name="serverId" type="hidden" value={activeServerId ?? ""} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="characterId">
              Активный персонаж
            </label>
            <Select
              defaultValue={activeCharacterId ?? ""}
              disabled={!characters.length || !activeServerId || mustChangePassword}
              id="characterId"
              name="characterId"
              required
            >
              {characters.length ? null : <option value="">На этом сервере пока нет персонажей</option>}
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.fullName} · {character.passportNumber}
                </option>
              ))}
            </Select>
          </div>
          <Button
            disabled={!characters.length || !activeServerId || mustChangePassword}
            type="submit"
            variant="secondary"
          >
            Выбрать персонажа
          </Button>
        </form>
      </div>
    </Card>
  );
}
