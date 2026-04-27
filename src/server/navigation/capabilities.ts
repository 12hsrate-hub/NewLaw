export type CapabilityBlockReason =
  | "auth_required"
  | "server_required"
  | "character_required"
  | "advocate_character_required"
  | "trustor_required_temporarily"
  | "materials_unavailable"
  | "access_request_required";

export type WorkspaceCapabilities = {
  canOpenAssistant: boolean;
  canOpenDocumentsWorkspace: boolean;
  canOpenLawyerWorkspace: boolean;
  canManageCharacters: boolean;
  canManageTrustors: boolean;
  requiresServer: boolean;
  requiresCharacter: boolean;
  requiresAdvocateCharacter: boolean;
  blockReasons: CapabilityBlockReason[];
};

export type DocumentEntryCapabilities = {
  canCreateSelfComplaint: boolean;
  canCreateClaims: boolean;
  canCreateAttorneyRequest: boolean;
  canCreateLegalServicesAgreement: boolean;
  requiresServer: boolean;
  requiresCharacter: boolean;
  requiresAdvocateCharacter: boolean;
  blockReasons: CapabilityBlockReason[];
};

type WorkspaceCapabilityInput = {
  isAuthenticated: boolean;
  hasServer: boolean;
  hasAssistantMaterials: boolean;
  hasSelectedCharacter?: boolean;
  hasAdvocateCharacter: boolean;
  canManageCharacters?: boolean;
  canManageTrustors?: boolean;
  includeAccessRequestRequired?: boolean;
};

type DocumentEntryCapabilityInput = {
  isAuthenticated: boolean;
  hasServer: boolean;
  hasSelectedCharacter: boolean;
  hasAdvocateCharacter: boolean;
  hasTrustorRegistry: boolean;
  canCreateAttorneyRequestLegacy: boolean;
  compatibilityRequiresTrustorRegistryForLegalServicesAgreement?: boolean;
  includeAccessRequestRequired?: boolean;
};

function pushReason(target: CapabilityBlockReason[], reason: CapabilityBlockReason) {
  if (!target.includes(reason)) {
    target.push(reason);
  }
}

export function buildWorkspaceCapabilities(
  input: WorkspaceCapabilityInput,
): WorkspaceCapabilities {
  const blockReasons: CapabilityBlockReason[] = [];

  if (!input.isAuthenticated) {
    pushReason(blockReasons, "auth_required");
  }

  if (!input.hasServer) {
    pushReason(blockReasons, "server_required");
  }

  if (input.hasServer && !input.hasAssistantMaterials) {
    pushReason(blockReasons, "materials_unavailable");
  }

  if (input.isAuthenticated && input.hasServer) {
    if (input.hasSelectedCharacter === false) {
      pushReason(blockReasons, "character_required");
    } else if (!input.hasAdvocateCharacter) {
      pushReason(blockReasons, "advocate_character_required");

      if (input.includeAccessRequestRequired) {
        pushReason(blockReasons, "access_request_required");
      }
    }
  }

  return {
    canOpenAssistant: input.hasServer && input.hasAssistantMaterials,
    canOpenDocumentsWorkspace: input.isAuthenticated && input.hasServer,
    canOpenLawyerWorkspace:
      input.isAuthenticated && input.hasServer && input.hasAdvocateCharacter,
    canManageCharacters: input.isAuthenticated && (input.canManageCharacters ?? true),
    canManageTrustors: input.isAuthenticated && (input.canManageTrustors ?? true),
    requiresServer: true,
    requiresCharacter: false,
    requiresAdvocateCharacter: false,
    blockReasons,
  };
}

export function buildDocumentEntryCapabilities(
  input: DocumentEntryCapabilityInput,
): DocumentEntryCapabilities {
  const blockReasons: CapabilityBlockReason[] = [];
  const compatibilityRequiresTrustorRegistryForLegalServicesAgreement =
    input.compatibilityRequiresTrustorRegistryForLegalServicesAgreement ?? false;

  if (!input.isAuthenticated) {
    pushReason(blockReasons, "auth_required");
  }

  if (!input.hasServer) {
    pushReason(blockReasons, "server_required");
  }

  if (input.isAuthenticated && input.hasServer && !input.hasSelectedCharacter) {
    pushReason(blockReasons, "character_required");
  }

  if (
    input.isAuthenticated &&
    input.hasServer &&
    input.hasSelectedCharacter &&
    !input.hasAdvocateCharacter
  ) {
    pushReason(blockReasons, "advocate_character_required");

    if (input.includeAccessRequestRequired) {
      pushReason(blockReasons, "access_request_required");
    }
  }

  if (
    input.isAuthenticated &&
    input.hasServer &&
    input.hasSelectedCharacter &&
    input.hasAdvocateCharacter &&
    compatibilityRequiresTrustorRegistryForLegalServicesAgreement &&
    !input.hasTrustorRegistry
  ) {
    pushReason(blockReasons, "trustor_required_temporarily");
  }

  return {
    canCreateSelfComplaint:
      input.isAuthenticated && input.hasServer && input.hasSelectedCharacter,
    canCreateClaims: input.isAuthenticated && input.hasServer && input.hasSelectedCharacter,
    canCreateAttorneyRequest:
      input.isAuthenticated &&
      input.hasServer &&
      input.canCreateAttorneyRequestLegacy &&
      input.hasTrustorRegistry,
    canCreateLegalServicesAgreement:
      input.isAuthenticated &&
      input.hasServer &&
      input.hasAdvocateCharacter &&
      (!compatibilityRequiresTrustorRegistryForLegalServicesAgreement ||
        input.hasTrustorRegistry),
    requiresServer: true,
    requiresCharacter: true,
    requiresAdvocateCharacter: false,
    blockReasons,
  };
}
