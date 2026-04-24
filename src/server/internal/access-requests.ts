import { listPendingCharacterAccessRequestsForInternal } from "@/db/repositories/character-access-request.repository";

export type InternalAccessRequestListItem = {
  id: string;
  account: {
    id: string;
    email: string;
    login: string;
  };
  server: {
    id: string;
    code: string;
    name: string;
  };
  character: {
    id: string;
    fullName: string;
    passportNumber: string;
  };
  requestType: "advocate_access";
  requestComment: string | null;
  createdAt: string;
};

export type InternalAccessRequestsContext = {
  pendingRequests: InternalAccessRequestListItem[];
};

export async function getInternalAccessRequestsContext(): Promise<InternalAccessRequestsContext> {
  const pendingRequests = await listPendingCharacterAccessRequestsForInternal();

  return {
    pendingRequests: pendingRequests.map((request) => ({
      id: request.id,
      account: {
        id: request.account.id,
        email: request.account.email,
        login: request.account.login,
      },
      server: {
        id: request.server.id,
        code: request.server.code,
        name: request.server.name,
      },
      character: {
        id: request.character.id,
        fullName: request.character.fullName,
        passportNumber: request.character.passportNumber,
      },
      requestType: request.requestType,
      requestComment: request.requestComment,
      createdAt: request.createdAt.toISOString(),
    })),
  };
}
