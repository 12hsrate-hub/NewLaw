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
  activeCharacterId: string | null;
  activeCharacterName: string | null;
  activeServerId: string | null;
  activeServerName: string | null;
  characters: CharacterOption[];
  servers: ServerOption[];
};

export function AppShellHeader({
  accountEmail,
  activeCharacterId,
  activeCharacterName,
  activeServerId,
  activeServerName,
  characters,
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

        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Выйти
          </Button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={selectActiveServerAction} className="space-y-3">
          <input name="redirectTo" type="hidden" value="/app" />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="serverId">
              Активный сервер
            </label>
            <Select defaultValue={activeServerId ?? ""} id="serverId" name="serverId" required>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Выбрать сервер
          </Button>
        </form>

        <form action={selectActiveCharacterAction} className="space-y-3">
          <input name="redirectTo" type="hidden" value="/app" />
          <input name="serverId" type="hidden" value={activeServerId ?? ""} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="characterId">
              Активный персонаж
            </label>
            <Select
              defaultValue={activeCharacterId ?? ""}
              disabled={!characters.length || !activeServerId}
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
          <Button disabled={!characters.length || !activeServerId} type="submit" variant="secondary">
            Выбрать персонажа
          </Button>
        </form>
      </div>
    </Card>
  );
}
