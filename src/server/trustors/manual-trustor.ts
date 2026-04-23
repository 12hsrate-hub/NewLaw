import {
  normalizeIcEmail,
  normalizePassportNumber,
  normalizePhone,
  normalizeSafeUrl,
  normalizeOptionalText as normalizeOptionalTextForOgp,
} from "@/lib/ogp/generation-contract";
import {
  createTrustorRecord,
  getTrustorByIdForAccount,
  softDeleteTrustorRecord,
  updateTrustorRecord,
} from "@/db/repositories/trustor.repository";
import {
  createTrustorInputSchema,
  type CreateTrustorInput,
  softDeleteTrustorInputSchema,
  type SoftDeleteTrustorInput,
  type UpdateTrustorInput,
  updateTrustorInputSchema,
} from "@/schemas/trustor";

type TrustorMutationRepository = {
  getTrustorByIdForAccount: typeof getTrustorByIdForAccount;
  createTrustorRecord: typeof createTrustorRecord;
  updateTrustorRecord: typeof updateTrustorRecord;
  softDeleteTrustorRecord: typeof softDeleteTrustorRecord;
};

const defaultRepository: TrustorMutationRepository = {
  getTrustorByIdForAccount,
  createTrustorRecord,
  updateTrustorRecord,
  softDeleteTrustorRecord,
};

export class TrustorNotFoundError extends Error {
  constructor() {
    super("Trustor not found");
    this.name = "TrustorNotFoundError";
  }
}

function normalizeFullName(fullName: string) {
  return fullName
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeOptionalText(value: string) {
  const normalized = normalizeOptionalTextForOgp(value);

  return normalized;
}

export async function createTrustorManually(
  input: CreateTrustorInput,
  repository: TrustorMutationRepository = defaultRepository,
) {
  const parsed = createTrustorInputSchema.parse(input);

  return repository.createTrustorRecord({
    accountId: parsed.accountId,
    serverId: parsed.serverId,
    fullName: normalizeFullName(parsed.fullName),
    passportNumber: normalizePassportNumber(parsed.passportNumber),
    phone: normalizeOptionalText(normalizePhone(parsed.phone)),
    icEmail: normalizeOptionalText(normalizeIcEmail(parsed.icEmail)),
    passportImageUrl: normalizeOptionalText(normalizeSafeUrl(parsed.passportImageUrl)),
    note: normalizeOptionalText(parsed.note),
  });
}

export async function updateTrustorManually(
  input: UpdateTrustorInput,
  repository: TrustorMutationRepository = defaultRepository,
) {
  const parsed = updateTrustorInputSchema.parse(input);
  const existingTrustor = await repository.getTrustorByIdForAccount({
    accountId: parsed.accountId,
    trustorId: parsed.trustorId,
  });

  if (!existingTrustor || existingTrustor.serverId !== parsed.serverId) {
    throw new TrustorNotFoundError();
  }

    return repository.updateTrustorRecord({
    trustorId: parsed.trustorId,
    fullName: normalizeFullName(parsed.fullName),
    passportNumber: normalizePassportNumber(parsed.passportNumber),
    phone: normalizeOptionalText(normalizePhone(parsed.phone)),
    icEmail: normalizeOptionalText(normalizeIcEmail(parsed.icEmail)),
    passportImageUrl: normalizeOptionalText(normalizeSafeUrl(parsed.passportImageUrl)),
    note: normalizeOptionalText(parsed.note),
  });
}

export async function softDeleteTrustorManually(
  input: SoftDeleteTrustorInput,
  repository: TrustorMutationRepository = defaultRepository,
) {
  const parsed = softDeleteTrustorInputSchema.parse(input);
  const existingTrustor = await repository.getTrustorByIdForAccount({
    accountId: parsed.accountId,
    trustorId: parsed.trustorId,
  });

  if (!existingTrustor) {
    throw new TrustorNotFoundError();
  }

  await repository.softDeleteTrustorRecord({
    trustorId: parsed.trustorId,
  });
}
