import { listPendingCharacterAccessRequestsForInternal } from "@/db/repositories/character-access-request.repository";
import { listCharactersForInternalAssignmentReview } from "@/db/repositories/character.repository";

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
  assignmentReviewCharacters: {
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
    roleKeys: string[];
    accessFlags: string[];
    createdAt: string;
  }[];
};

export async function getInternalAccessRequestsContext(): Promise<InternalAccessRequestsContext> {
  const [pendingRequests, assignmentReviewCharacters] = await Promise.all([
    listPendingCharacterAccessRequestsForInternal(),
    listCharactersForInternalAssignmentReview(),
  ]);

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
    assignmentReviewCharacters: assignmentReviewCharacters.map((character) => ({
      id: character.id,
      account: {
        id: character.account.id,
        email: character.account.email,
        login: character.account.login,
      },
      server: {
        id: character.server.id,
        code: character.server.code,
        name: character.server.name,
      },
      character: {
        id: character.id,
        fullName: character.fullName,
        passportNumber: character.passportNumber,
      },
      roleKeys: character.roles.map((role) => role.roleKey),
      accessFlags: character.accessFlags.map((flag) => flag.flagKey),
      createdAt: character.createdAt.toISOString(),
    })),
  };
}
