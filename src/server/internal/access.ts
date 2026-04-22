import { requireProtectedAccountContext } from "@/server/auth/protected";

type InternalViewer = {
  accountId: string;
  email: string;
  login: string;
};

type GrantedInternalAccessContext = {
  status: "granted";
  viewer: InternalViewer;
};

type DeniedInternalAccessContext = {
  status: "denied";
  viewer: InternalViewer;
};

export type InternalAccessContext =
  | GrantedInternalAccessContext
  | DeniedInternalAccessContext;

export async function getInternalAccessContext(
  nextPath: string,
): Promise<InternalAccessContext> {
  const protectedContext = await requireProtectedAccountContext(
    nextPath,
    undefined,
    {
      allowMustChangePassword: true,
    },
  );

  const viewer = {
    accountId: protectedContext.account.id,
    email: protectedContext.account.email,
    login: protectedContext.account.login,
  };

  if (!protectedContext.account.isSuperAdmin) {
    return {
      status: "denied",
      viewer,
    };
  }

  return {
    status: "granted",
    viewer,
  };
}
