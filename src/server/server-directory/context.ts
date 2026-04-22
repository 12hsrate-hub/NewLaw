import { countCharactersByServer } from "@/db/repositories/character.repository";
import { listServerDirectoryServers } from "@/db/repositories/server.repository";
import { syncAccountFromSupabaseUser } from "@/server/auth/account";
import { getCurrentUser } from "@/server/auth/helpers";
import { buildLawCorpusBootstrapHealth } from "@/server/law-corpus/bootstrap-status";

type ServerDirectoryRecord = Awaited<ReturnType<typeof listServerDirectoryServers>>[number];

export type ServerDirectoryAvailability = "active" | "maintenance" | "unavailable";
export type ServerAssistantStatus =
  | "no_corpus"
  | "corpus_bootstrap_incomplete"
  | "current_corpus_ready"
  | "corpus_stale"
  | "assistant_disabled"
  | "maintenance_mode";
export type ServerDocumentsAvailabilityForViewer =
  | "requires_auth"
  | "needs_character"
  | "available"
  | "unavailable";

export type PublicServerDirectoryItem = {
  id: string;
  code: string;
  slug: string;
  name: string;
  directoryAvailability: ServerDirectoryAvailability;
  assistantStatus: ServerAssistantStatus;
  documentsAvailabilityForViewer: ServerDocumentsAvailabilityForViewer;
  availableModules: Array<"assistant" | "documents">;
};

export type PublicServerDirectoryContext = {
  viewer: {
    isAuthenticated: boolean;
    accountId: string | null;
  };
  servers: PublicServerDirectoryItem[];
};

function resolveServerDirectoryAvailability(server: Pick<ServerDirectoryRecord, "isActive">) {
  return server.isActive ? "active" : "unavailable";
}

export function resolveAssistantStatus(
  server: Pick<ServerDirectoryRecord, "isActive" | "laws">,
): ServerAssistantStatus {
  if (!server.isActive) {
    return "assistant_disabled";
  }

  const bootstrapHealth = buildLawCorpusBootstrapHealth(
    server.laws.map((law) => ({
      lawKind: law.lawKind,
      isExcluded: law.isExcluded,
      classificationOverride: law.classificationOverride,
      currentVersionId: law.currentVersionId,
      versionCount: law._count.versions,
    })),
  );

  if (bootstrapHealth.primaryLawCount === 0 && bootstrapHealth.currentPrimaryCount === 0) {
    return "no_corpus";
  }

  if (bootstrapHealth.status === "current_corpus_ready") {
    return "current_corpus_ready";
  }

  return "corpus_bootstrap_incomplete";
}

async function buildOptionalDirectoryViewer() {
  const user = await getCurrentUser();

  if (!user?.id || !user.email) {
    return {
      isAuthenticated: false,
      accountId: null,
    };
  }

  const account = await syncAccountFromSupabaseUser(user);

  return {
    isAuthenticated: true,
    accountId: account.id,
  };
}

async function resolveDocumentsAvailabilityForViewer(input: {
  server: Pick<ServerDirectoryRecord, "id" | "isActive">;
  viewer: {
    isAuthenticated: boolean;
    accountId: string | null;
  };
}): Promise<ServerDocumentsAvailabilityForViewer> {
  if (!input.server.isActive) {
    return "unavailable";
  }

  if (!input.viewer.isAuthenticated || !input.viewer.accountId) {
    return "requires_auth";
  }

  const characterCount = await countCharactersByServer({
    accountId: input.viewer.accountId,
    serverId: input.server.id,
  });

  return characterCount > 0 ? "available" : "needs_character";
}

export async function getPublicServerDirectoryContext(): Promise<PublicServerDirectoryContext> {
  const [viewer, servers] = await Promise.all([
    buildOptionalDirectoryViewer(),
    listServerDirectoryServers(),
  ]);

  const items = await Promise.all(
    servers.map(async (server) =>
      ({
        id: server.id,
        code: server.code,
        slug: server.code,
        name: server.name,
        directoryAvailability: resolveServerDirectoryAvailability(server),
        assistantStatus: resolveAssistantStatus(server),
        documentsAvailabilityForViewer: await resolveDocumentsAvailabilityForViewer({
          server,
          viewer,
        }),
        availableModules: ["assistant", "documents"],
      }) satisfies PublicServerDirectoryItem,
    ),
  );

  return {
    viewer,
    servers: items,
  };
}
